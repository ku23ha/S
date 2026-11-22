/**
 * Payment webhook handling (docs/DATA_MODEL.md, "Reservation and claim flow"
 * steps 2 and 3). This is the only place a title becomes claimed.
 *
 * Everything that changes the database runs in one transaction that starts by
 * recording the event id in webhook_events. A conflict means the event was
 * already handled, so nothing else happens. If anything fails (including a
 * provider refund) the transaction rolls back, the event id is not recorded,
 * and the provider's retry runs the handler again. Emails go out only after
 * commit, with an idempotency key, so a retry never double-sends.
 */
import { type Db, isUniqueViolation } from "@/lib/db";
import { type OutgoingEmail, claimEmail, refundEmail, sendWithRetry } from "@/lib/email";
import { certificatePath } from "@/lib/format";
import { moderateClaim } from "@/lib/moderation";
import type { PaymentEvent, PaymentProvider } from "@/lib/payments/index";
import { findFreeKeys, loadBlockedTerms } from "@/lib/queries";
import { type ParsedTitle, suggestVariants } from "@/lib/titles";

export type WebhookOutcome =
  | "duplicate"
  | "claimed"
  | "in_review"
  | "reclaimed"
  | "already_claimed"
  | "refunded_taken"
  | "refunded_extra_payment"
  | "unmatched"
  | "removed"
  | "nothing_to_remove"
  | "ignored";

interface TitleRow extends Record<string, unknown> {
  id: string;
  title_key: string;
  title_display: string;
  slug: string;
  status: string;
  recipient_name: string;
  giver_name: string | null;
  dedication: string | null;
  buyer_email: string;
  manage_token: string;
  price_cents: number;
  payment_id: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function eventType(e: PaymentEvent): string {
  return e.kind === "ignored" ? e.type : e.kind;
}

async function findPaymentRow(tx: Db, e: Extract<PaymentEvent, { kind: "payment_succeeded" }>): Promise<TitleRow | null> {
  const cols = `id, title_key, title_display, slug, status, recipient_name, giver_name, dedication, buyer_email,
    manage_token, price_cents, payment_id`;
  if (e.titleId && UUID_RE.test(e.titleId)) {
    const rows = await tx.query<TitleRow>(`select ${cols} from titles where id = $1 for update`, [e.titleId]);
    if (rows[0]) return rows[0];
  }
  if (e.checkoutId) {
    const rows = await tx.query<TitleRow>(`select ${cols} from titles where checkout_id = $1 for update`, [e.checkoutId]);
    if (rows[0]) return rows[0];
  }
  return null;
}

/** Claim the row: moderation decides claimed or in_review; next registry number. */
async function claimRow(tx: Db, row: TitleRow, paymentId: string): Promise<{ status: "claimed" | "in_review"; registryNo: number }> {
  const blocked = await loadBlockedTerms(tx);
  const mod = moderateClaim(
    { titleKey: row.title_key, recipientName: row.recipient_name, giverName: row.giver_name, dedication: row.dedication },
    blocked,
  );
  const status = mod.flagged ? "in_review" : "claimed";
  const rows = await tx.query<{ registry_no: number }>(
    `update titles set status = $2, registry_no = nextval('registry_no_seq'), claimed_at = now(),
       payment_id = $3, reserved_until = null, updated_at = now()
     where id = $1 returning registry_no::int as registry_no`,
    [row.id, status, paymentId],
  );
  return { status, registryNo: rows[0].registry_no };
}

/** Run fn inside a savepoint so a unique violation doesn't abort the whole transaction. */
async function withSavepoint<T>(tx: Db, fn: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; err: unknown }> {
  await tx.query(`savepoint reclaim`);
  try {
    const value = await fn();
    await tx.query(`release savepoint reclaim`);
    return { ok: true, value };
  } catch (err) {
    await tx.query(`rollback to savepoint reclaim`);
    return { ok: false, err };
  }
}

async function freeVariants(tx: Db, row: TitleRow, site: string): Promise<{ display: string; claimUrl: string }[]> {
  const blocked = await loadBlockedTerms(tx);
  const title: ParsedTitle = { key: row.title_key, display: row.title_display, slug: row.slug };
  const variants = await suggestVariants(title, blocked, (keys) => findFreeKeys(tx, keys));
  return variants.flatMap((v) =>
    v.kind === "place"
      ? []
      : [{ display: v.title.display, claimUrl: `${site}/claim?${new URLSearchParams({ title: v.title.display }).toString()}` }],
  );
}

export async function handlePaymentEvent(
  db: Db,
  provider: PaymentProvider,
  event: PaymentEvent,
  payload: unknown,
  site: string,
): Promise<WebhookOutcome> {
  const emails: OutgoingEmail[] = [];

  const outcome = await db.transaction<WebhookOutcome>(async (tx) => {
    const inserted = await tx.query(
      `insert into webhook_events (event_id, type, payload) values ($1, $2, $3::jsonb)
       on conflict (event_id) do nothing returning event_id`,
      [event.eventId, eventType(event), JSON.stringify(payload ?? {})],
    );
    if (inserted.length === 0) return "duplicate";

    if (event.kind === "ignored") return "ignored";

    if (event.kind === "payment_reversed") {
      const rows = await tx.query(
        `update titles set status = 'removed', updated_at = now()
         where payment_id = $1 and status <> 'removed' returning id`,
        [event.paymentId],
      );
      return rows.length ? "removed" : "nothing_to_remove";
    }

    // payment_succeeded
    const row = await findPaymentRow(tx, event);
    if (!row) {
      console.error("webhook: payment matched no title", { paymentId: event.paymentId, checkoutId: event.checkoutId });
      return "unmatched";
    }

    if (row.payment_id === event.paymentId && (row.status === "claimed" || row.status === "in_review")) {
      return "already_claimed";
    }

    if (
      event.totalAmountCents != null &&
      event.taxCents != null &&
      event.totalAmountCents - event.taxCents !== row.price_cents
    ) {
      console.warn("webhook: paid amount differs from server price; check Dodo product prices", {
        titleId: row.id,
        expected: row.price_cents,
        paidBeforeTax: event.totalAmountCents - event.taxCents,
      });
    }

    const sendClaim = (status: "claimed" | "in_review", registryNo: number) =>
      emails.push(
        claimEmail({
          to: row.buyer_email,
          titleId: row.id,
          titleDisplay: row.title_display,
          recipientName: row.recipient_name,
          registryNo,
          certificateUrl: `${site}${certificatePath(row.slug)}`,
          manageUrl: `${site}/manage/${row.manage_token}`,
          inReview: status === "in_review",
        }),
      );

    const refundTaken = async (): Promise<WebhookOutcome> => {
      await provider.refund(event.paymentId, "Title was claimed by someone else before this payment arrived.");
      await tx.query(`update titles set payment_id = $2, updated_at = now() where id = $1`, [row.id, event.paymentId]);
      emails.push(
        refundEmail({
          to: row.buyer_email,
          titleId: row.id,
          titleDisplay: row.title_display,
          variants: await freeVariants(tx, row, site),
          searchUrl: `${site}/`,
        }),
      );
      return "refunded_taken";
    };

    if (row.payment_id && row.payment_id !== event.paymentId) {
      // A second payment for one reservation. Keep the first, refund this one.
      await provider.refund(event.paymentId, "Duplicate payment for a title that was already paid for.");
      return "refunded_extra_payment";
    }

    if (row.status === "reserved") {
      const { status, registryNo } = await claimRow(tx, row, event.paymentId);
      sendClaim(status, registryNo);
      return status;
    }

    if (row.status === "expired") {
      // Another buyer's hold that has run out must not block the reclaim.
      await tx.query(
        `update titles set status = 'expired', updated_at = now()
         where title_key = $1 and id <> $2 and status = 'reserved' and reserved_until < now()`,
        [row.title_key, row.id],
      );
      const attempt = await withSavepoint(tx, () => claimRow(tx, row, event.paymentId));
      if (attempt.ok) {
        sendClaim(attempt.value.status, attempt.value.registryNo);
        return attempt.value.status === "claimed" ? "reclaimed" : "in_review";
      }
      if (!isUniqueViolation(attempt.err)) throw attempt.err;
      return refundTaken();
    }

    // removed or rejected before payment arrived: nothing to give, so refund.
    return refundTaken();
  });

  for (const email of emails) await sendWithRetry(email);
  return outcome;
}

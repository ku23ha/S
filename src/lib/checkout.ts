/**
 * POST /api/checkout logic (docs/DATA_MODEL.md, "Reservation and claim flow" step 1).
 * One transaction: expire stale reservations for the key, insert a reserved
 * row for RESERVATION_MINUTES, create the hosted checkout. A unique violation
 * on titles_one_holder means the title is taken. If checkout creation fails
 * the transaction rolls back, so the reservation is released.
 */
import { randomBytes } from "node:crypto";
import { trackServer } from "@/lib/analytics-server";
import type { ClaimInput } from "@/lib/claim";
import { type CheckResult, checkTitle } from "@/lib/check";
import { type Db, isUniqueViolation } from "@/lib/db";
import type { PaymentProvider } from "@/lib/payments/index";
import { loadBlockedTerms, loadTierMap } from "@/lib/queries";
import { CURRENCY, getTier, parseTitle, priceCents } from "@/lib/titles";
import { errorSummary } from "@/lib/log";

export const MAX_CLAIMS_PER_EMAIL_PER_DAY = 5;

export function reservationMinutes(): number {
  const n = Number(process.env.RESERVATION_MINUTES ?? 15);
  return Number.isFinite(n) && n > 0 && n <= 60 ? n : 15;
}

export function newManageToken(): string {
  return randomBytes(32).toString("base64url");
}

export type StartCheckoutResult =
  | { ok: true; titleId: string; checkoutUrl: string; reservedUntil: string }
  | { ok: false; status: 400 | 409 | 429 | 503; error: string; check?: CheckResult };

class TitleTaken extends Error {}

export async function startCheckout(
  db: Db,
  provider: PaymentProvider,
  input: ClaimInput,
  siteUrl: string,
): Promise<StartCheckoutResult> {
  const [blocked, tiers] = await Promise.all([loadBlockedTerms(db), loadTierMap(db)]);
  const parsed = parseTitle(input.title, blocked);
  if (!parsed.ok) return { ok: false, status: 400, error: parsed.message };
  const title = parsed.title;

  const recent = await db.query<{ c: number }>(
    `select count(*)::int as c from titles
     where lower(buyer_email) = lower($1) and created_at > now() - interval '1 day'
       and status in ('reserved','claimed','in_review')`,
    [input.email],
  );
  if ((recent[0]?.c ?? 0) >= MAX_CLAIMS_PER_EMAIL_PER_DAY) {
    return { ok: false, status: 429, error: "You've claimed the most titles allowed for one email today. Try again tomorrow." };
  }

  let refTitleId: string | null = null;
  if (input.refSlug) {
    const ref = await db.query<{ id: string }>(`select id from titles where slug = $1 and status = 'claimed' limit 1`, [
      input.refSlug,
    ]);
    refTitleId = ref[0]?.id ?? null;
  }

  // Server-side price; anything the client sent about price was never read.
  const tier = getTier(title.key, tiers);
  const amount = priceCents(tier, input.addonPrint);
  const minutes = reservationMinutes();

  try {
    const result = await db.transaction(async (tx) => {
      await tx.query(
        `update titles set status = 'expired', updated_at = now()
         where title_key = $1 and status = 'reserved' and reserved_until < now()`,
        [title.key],
      );

      let row: { id: string; reserved_until: Date };
      try {
        const rows = await tx.query<{ id: string; reserved_until: Date }>(
          `insert into titles (title_key, title_display, slug, tier, status, recipient_name, giver_name, dedication,
             addon_print, buyer_email, price_cents, currency, manage_token, ref_title_id, reserved_until, analytics_id)
           values ($1, $2, $3, $4, 'reserved', $5, $6, $7, $8, $9, $10, $11, $12, $13,
             now() + ($14::int * interval '1 minute'), $15)
           returning id, reserved_until`,
          [
            title.key,
            title.display,
            title.slug,
            tier,
            input.recipientName,
            input.giverName || null,
            input.dedication || null,
            input.addonPrint,
            input.email,
            amount,
            CURRENCY,
            newManageToken(),
            refTitleId,
            minutes,
            input.analyticsId ?? null,
          ],
        );
        row = rows[0];
      } catch (err) {
        if (isUniqueViolation(err)) throw new TitleTaken();
        throw err;
      }

      const session = await provider.createCheckout({
        titleId: row.id,
        tier,
        addonPrint: input.addonPrint,
        customerEmail: input.email,
        returnUrl: `${siteUrl}/success?id=${row.id}`,
        amountMinor: amount,
        currency: CURRENCY,
        description: `World's Best ${title.display}${input.addonPrint ? " + print file" : ""}`,
      });
      await tx.query(`update titles set checkout_id = $2, updated_at = now() where id = $1`, [row.id, session.checkoutId]);
      return { titleId: row.id, checkoutUrl: session.checkoutUrl, reservedUntil: new Date(row.reserved_until).toISOString() };
    });
    await trackServer(input.analyticsId ?? `title:${result.titleId}`, "checkout_started", {
      tier,
      addon_print: input.addonPrint,
      price_cents: amount,
    });
    return { ok: true, ...result };
  } catch (err) {
    if (err instanceof TitleTaken) {
      const check = await checkTitle(db, input.title).catch(() => undefined);
      return { ok: false, status: 409, error: "Someone else got to this title first.", check };
    }
    console.error("checkout failed", errorSummary(err));
    return { ok: false, status: 503, error: "Checkout couldn't start. Please try again." };
  }
}

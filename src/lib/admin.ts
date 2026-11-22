/**
 * Admin data and actions. Buyer emails are used for search only and are
 * never returned to the page. Removing or rejecting frees the title; its
 * registry number stays retired because numbers come from a sequence.
 */
import type { Db } from "@/lib/db";
import { moderateClaim } from "@/lib/moderation";
import type { PaymentProvider } from "@/lib/payments/index";
import { loadBlockedTerms } from "@/lib/queries";
import { errorSummary } from "@/lib/log";

export interface AdminTitle {
  id: string;
  titleKey: string;
  titleDisplay: string;
  slug: string;
  status: string;
  tier: string;
  recipientName: string;
  giverName: string | null;
  dedication: string | null;
  registryNo: number | null;
  claimedAt: Date | null;
  createdAt: Date;
  paymentId: string | null;
  priceCents: number;
  removalReason: string | null;
  openReports: number;
  flags: string[];
}

interface Row extends Record<string, unknown> {
  id: string;
  title_key: string;
  title_display: string;
  slug: string;
  status: string;
  tier: string;
  recipient_name: string;
  giver_name: string | null;
  dedication: string | null;
  registry_no: number | null;
  claimed_at: Date | null;
  created_at: Date;
  payment_id: string | null;
  price_cents: number;
  removal_reason: string | null;
  open_reports: number;
}

const COLS = `t.id, t.title_key, t.title_display, t.slug, t.status, t.tier, t.recipient_name, t.giver_name,
  t.dedication, t.registry_no::int as registry_no, t.claimed_at, t.created_at, t.payment_id, t.price_cents,
  t.removal_reason,
  (select count(*)::int from reports r where r.title_id = t.id and not r.resolved) as open_reports`;

async function toAdmin(db: Db, rows: Row[]): Promise<AdminTitle[]> {
  const blocked = await loadBlockedTerms(db);
  return rows.map((r) => ({
    id: r.id,
    titleKey: r.title_key,
    titleDisplay: r.title_display,
    slug: r.slug,
    status: r.status,
    tier: r.tier,
    recipientName: r.recipient_name,
    giverName: r.giver_name,
    dedication: r.dedication,
    registryNo: r.registry_no,
    claimedAt: r.claimed_at,
    createdAt: r.created_at,
    paymentId: r.payment_id,
    priceCents: r.price_cents,
    removalReason: r.removal_reason,
    openReports: r.open_reports,
    flags: moderateClaim(
      { titleKey: r.title_key, recipientName: r.recipient_name, giverName: r.giver_name, dedication: r.dedication },
      blocked,
    ).reasons,
  }));
}

export async function reviewQueue(db: Db): Promise<AdminTitle[]> {
  const rows = await db.query<Row>(`select ${COLS} from titles t where t.status = 'in_review' order by t.claimed_at asc limit 200`);
  return toAdmin(db, rows);
}

export interface AdminReport {
  id: string;
  titleId: string;
  titleDisplay: string;
  slug: string;
  titleStatus: string;
  reason: string;
  hasReporterEmail: boolean;
  createdAt: Date;
}

export async function openReports(db: Db): Promise<AdminReport[]> {
  const rows = await db.query<{
    id: string;
    title_id: string;
    title_display: string;
    slug: string;
    status: string;
    reason: string;
    reporter_email: string | null;
    created_at: Date;
  }>(
    `select r.id, r.title_id, t.title_display, t.slug, t.status, r.reason, r.reporter_email, r.created_at
     from reports r join titles t on t.id = r.title_id
     where not r.resolved order by r.created_at asc limit 200`,
  );
  return rows.map((r) => ({
    id: r.id,
    titleId: r.title_id,
    titleDisplay: r.title_display,
    slug: r.slug,
    titleStatus: r.status,
    reason: r.reason,
    hasReporterEmail: !!r.reporter_email,
    createdAt: r.created_at,
  }));
}

/** Search by title, recipient, exact buyer email or exact payment id. */
export async function searchTitles(db: Db, q: string): Promise<AdminTitle[]> {
  const term = q.trim().slice(0, 200);
  if (!term) return [];
  const like = `%${term.toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const rows = await db.query<Row>(
    `select ${COLS} from titles t
     where t.status <> 'expired' and (
       t.title_key like $1 or lower(t.recipient_name) like $1
       or lower(t.buyer_email) = lower($2) or t.payment_id = $2 or t.slug = $2)
     order by t.created_at desc limit 50`,
    [like, term],
  );
  return toAdmin(db, rows);
}

export type ActionResult = { ok: true } | { ok: false; status: 400 | 404 | 409 | 502; error: string };

async function lockTitle(db: Db, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const rows = await db.query<{ id: string; status: string; payment_id: string | null }>(
    `select id, status, payment_id from titles where id = $1 for update`,
    [id],
  );
  return rows[0] ?? null;
}

export async function approveTitle(db: Db, id: string): Promise<ActionResult> {
  return db.transaction(async (tx) => {
    const t = await lockTitle(tx, id);
    if (!t) return { ok: false, status: 404, error: "Not found." };
    if (t.status !== "in_review") return { ok: false, status: 409, error: `Can't approve a ${t.status} entry.` };
    await tx.query(`update titles set status = 'claimed', updated_at = now() where id = $1`, [id]);
    await tx.query(`update reports set resolved = true where title_id = $1 and not resolved`, [id]);
    return { ok: true };
  });
}

/**
 * Reject an entry in review: refund the buyer, then mark it rejected (which
 * frees the title). If the refund fails nothing changes.
 */
export async function rejectTitle(db: Db, provider: PaymentProvider, id: string, reason: string): Promise<ActionResult> {
  return db.transaction(async (tx) => {
    const t = await lockTitle(tx, id);
    if (!t) return { ok: false, status: 404, error: "Not found." };
    if (t.status !== "in_review") return { ok: false, status: 409, error: `Can't reject a ${t.status} entry.` };
    if (t.payment_id) {
      try {
        await provider.refund(t.payment_id, `Rejected in review: ${reason}`);
      } catch (err) {
        console.error("admin reject refund failed", errorSummary(err));
        return { ok: false, status: 502, error: "The refund failed, so nothing was changed. Try again." };
      }
    }
    await tx.query(`update titles set status = 'rejected', removal_reason = $2, updated_at = now() where id = $1`, [id, reason]);
    await tx.query(`update reports set resolved = true where title_id = $1 and not resolved`, [id]);
    return { ok: true };
  });
}

/** Remove a published or in-review certificate, optionally refunding the buyer. */
export async function removeTitle(
  db: Db,
  provider: PaymentProvider,
  id: string,
  reason: string,
  refund: boolean,
): Promise<ActionResult> {
  return db.transaction(async (tx) => {
    const t = await lockTitle(tx, id);
    if (!t) return { ok: false, status: 404, error: "Not found." };
    if (t.status !== "claimed" && t.status !== "in_review") {
      return { ok: false, status: 409, error: `Can't remove a ${t.status} entry.` };
    }
    if (refund && t.payment_id) {
      try {
        await provider.refund(t.payment_id, `Removed: ${reason}`);
      } catch (err) {
        console.error("admin remove refund failed", errorSummary(err));
        return { ok: false, status: 502, error: "The refund failed, so nothing was changed. Try again, or remove without a refund." };
      }
    }
    await tx.query(`update titles set status = 'removed', removal_reason = $2, updated_at = now() where id = $1`, [id, reason]);
    await tx.query(`update reports set resolved = true where title_id = $1 and not resolved`, [id]);
    return { ok: true };
  });
}

export async function dismissReport(db: Db, reportId: string): Promise<ActionResult> {
  if (!/^[0-9a-f-]{36}$/i.test(reportId)) return { ok: false, status: 404, error: "Not found." };
  const rows = await db.query(`update reports set resolved = true where id = $1 and not resolved returning id`, [reportId]);
  return rows.length ? { ok: true } : { ok: false, status: 404, error: "Not found." };
}

export interface DayStats {
  day: string;
  checkouts: number;
  claims: number;
  grossCents: number;
  sharedClaims: number;
  loopClaims: number;
  certificateViews: number;
  searches: number;
  searchers: number;
}

/**
 * Daily numbers from the database, newest first. Share rate is the share of
 * a day's claims whose certificate got 3 or more unique outside views in the
 * 7 days from the claim. Searches come from the search rate-limit buckets.
 * Visitors are in PostHog.
 */
export async function dailyStats(db: Db, days = 14): Promise<DayStats[]> {
  const rows = await db.query<{
    day: string;
    checkouts: number;
    claims: number;
    gross_cents: number;
    shared_claims: number;
    loop_claims: number;
    certificate_views: number;
    searches: number;
    searchers: number;
  }>(
    `with d as (
       select generate_series(current_date - ($1::int - 1), current_date, interval '1 day')::date as day
     )
     select to_char(d.day, 'YYYY-MM-DD') as day,
       (select count(*)::int from titles t where t.created_at::date = d.day and t.checkout_id is not null) as checkouts,
       (select count(*)::int from titles t where t.claimed_at::date = d.day) as claims,
       (select coalesce(sum(t.price_cents), 0)::int from titles t where t.claimed_at::date = d.day) as gross_cents,
       (select count(*)::int from titles t where t.claimed_at::date = d.day
          and (select count(distinct v.viewer_hash) from certificate_views v
               where v.title_id = t.id and v.day between d.day and d.day + 6) >= 3) as shared_claims,
       (select count(*)::int from titles t where t.claimed_at::date = d.day and t.ref_title_id is not null) as loop_claims,
       (select count(*)::int from certificate_views v where v.day = d.day) as certificate_views,
       (select coalesce(sum(r.count), 0)::int from rate_limits r where r.bucket like 'search:%' and r.window_start::date = d.day) as searches,
       (select count(distinct r.bucket)::int from rate_limits r where r.bucket like 'search:%' and r.window_start::date = d.day) as searchers
     from d order by d.day desc`,
    [days],
  );
  return rows.map((r) => ({
    day: r.day,
    checkouts: r.checkouts,
    claims: r.claims,
    grossCents: r.gross_cents,
    sharedClaims: r.shared_claims,
    loopClaims: r.loop_claims,
    certificateViews: r.certificate_views,
    searches: r.searches,
    searchers: r.searchers,
  }));
}

/**
 * Read queries and reservation housekeeping. Every function takes a Db so
 * tests can pass a PGlite instance; callers in routes use getDb().
 * Never select buyer_email or manage_token into public results.
 */
import { timingSafeEqual } from "node:crypto";
import type { Db } from "@/lib/db";
import type { ListedTier, Tier } from "@/lib/titles";

const ACTIVE = `('reserved','claimed','in_review')`;

export interface PublicHolder {
  id: string;
  titleKey: string;
  titleDisplay: string;
  slug: string;
  tier: Tier;
  status: "reserved" | "claimed" | "in_review";
  recipientName: string;
  giverName: string | null;
  dedication: string | null;
  registryNo: number | null;
  claimedAt: Date | null;
  reservedUntil: Date | null;
}

interface HolderRow extends Record<string, unknown> {
  id: string;
  title_key: string;
  title_display: string;
  slug: string;
  tier: Tier;
  status: PublicHolder["status"];
  recipient_name: string;
  giver_name: string | null;
  dedication: string | null;
  registry_no: number | null;
  claimed_at: Date | null;
  reserved_until: Date | null;
}

const HOLDER_COLUMNS = `id, title_key, title_display, slug, tier, status, recipient_name, giver_name,
  dedication, registry_no::int as registry_no, claimed_at, reserved_until`;

function toHolder(r: HolderRow): PublicHolder {
  return {
    id: r.id,
    titleKey: r.title_key,
    titleDisplay: r.title_display,
    slug: r.slug,
    tier: r.tier,
    status: r.status,
    recipientName: r.recipient_name,
    giverName: r.giver_name,
    dedication: r.dedication,
    registryNo: r.registry_no,
    claimedAt: r.claimed_at,
    reservedUntil: r.reserved_until,
  };
}

// ---------------------------------------------------------------------------
// Reference lists (small, cached in memory for a few minutes)
// ---------------------------------------------------------------------------

const LIST_TTL_MS = 5 * 60 * 1000;
let blockedCache: { at: number; terms: string[] } | null = null;
let tierCache: { at: number; map: Map<string, ListedTier> } | null = null;

export async function loadBlockedTerms(db: Db): Promise<string[]> {
  if (blockedCache && Date.now() - blockedCache.at < LIST_TTL_MS) return blockedCache.terms;
  const rows = await db.query<{ term: string }>(`select term from blocked_terms`);
  blockedCache = { at: Date.now(), terms: rows.map((r) => r.term) };
  return blockedCache.terms;
}

export async function loadTierMap(db: Db): Promise<Map<string, ListedTier>> {
  if (tierCache && Date.now() - tierCache.at < LIST_TTL_MS) return tierCache.map;
  const rows = await db.query<{ title_key: string; tier: ListedTier }>(`select title_key, tier from tier_titles`);
  tierCache = { at: Date.now(), map: new Map(rows.map((r) => [r.title_key, r.tier])) };
  return tierCache.map;
}

/** Tests only. */
export function clearListCaches(): void {
  blockedCache = null;
  tierCache = null;
}

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------

/** Mark reservations for these keys whose 15 minutes have passed as expired. */
export async function expireStaleReservations(db: Db, keys: readonly string[]): Promise<number> {
  if (keys.length === 0) return 0;
  const rows = await db.query<{ id: string }>(
    `update titles set status = 'expired', updated_at = now()
     where title_key = any($1::text[]) and status = 'reserved' and reserved_until < now()
     returning id`,
    [keys],
  );
  return rows.length;
}

/** The current active row for a key, after expiring a stale reservation. */
export async function getActiveHolder(db: Db, key: string): Promise<PublicHolder | null> {
  await expireStaleReservations(db, [key]);
  const rows = await db.query<HolderRow>(
    `select ${HOLDER_COLUMNS} from titles where title_key = $1 and status in ${ACTIVE} limit 1`,
    [key],
  );
  return rows[0] ? toHolder(rows[0]) : null;
}

/** The subset of keys with no active holder. Stale reservations count as free. */
export async function findFreeKeys(db: Db, keys: readonly string[]): Promise<Set<string>> {
  if (keys.length === 0) return new Set();
  const rows = await db.query<{ title_key: string }>(
    `select title_key from titles
     where title_key = any($1::text[])
       and (status in ('claimed','in_review') or (status = 'reserved' and reserved_until >= now()))`,
    [keys],
  );
  const held = new Set(rows.map((r) => r.title_key));
  return new Set(keys.filter((k) => !held.has(k)));
}

// ---------------------------------------------------------------------------
// Certificates and registry
// ---------------------------------------------------------------------------

/** A public certificate: claimed or in review. Reserved rows are not pages yet. */
export async function getCertificateBySlug(db: Db, slug: string): Promise<PublicHolder | null> {
  const rows = await db.query<HolderRow>(
    `select ${HOLDER_COLUMNS} from titles where slug = $1 and status in ('claimed','in_review') limit 1`,
    [slug],
  );
  return rows[0] ? toHolder(rows[0]) : null;
}

export interface TitleStatusView extends Omit<PublicHolder, "status"> {
  status: "reserved" | "claimed" | "in_review" | "rejected" | "removed" | "expired";
}

/** Any row by id, for the success page. Public fields only. */
export async function getTitleById(db: Db, id: string): Promise<TitleStatusView | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const rows = await db.query<HolderRow>(`select ${HOLDER_COLUMNS} from titles where id = $1`, [id]);
  const r = rows[0];
  if (!r) return null;
  return { ...toHolder(r), status: r.status as TitleStatusView["status"] };
}

export interface PrivateTitle extends PublicHolder {
  manageToken: string;
  addonPrint: boolean;
}

/**
 * A claimed or in-review row looked up by its manage token, compared in
 * constant time. For the manage page and print downloads only.
 */
export async function getTitleByManageToken(db: Db, token: string): Promise<PrivateTitle | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const rows = await db.query<HolderRow & { manage_token: string; addon_print: boolean }>(
    `select ${HOLDER_COLUMNS}, manage_token, addon_print from titles
     where manage_token = $1 and status in ('claimed','in_review') limit 1`,
    [token],
  );
  const r = rows[0];
  if (!r || !tokensEqual(r.manage_token, token)) return null;
  return { ...toHolder(r), manageToken: r.manage_token, addonPrint: r.addon_print };
}

function tokensEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** "42", "No. 42", "#42", "№ 000042" -> 42. Anything else -> null. */
export function parseRegistryNumber(q: string): number | null {
  const m = q.trim().match(/^(?:no\.?|#|№)?\s*0*(\d{1,9})$/i);
  if (!m) return null;
  const n = Number(m[1]);
  return n > 0 ? n : null;
}

/** The claimed certificate with this registry number, if any. */
export async function getCertificateByNumber(db: Db, registryNo: number): Promise<PublicHolder | null> {
  const rows = await db.query<HolderRow>(
    `select ${HOLDER_COLUMNS} from titles where registry_no = $1 and status = 'claimed' limit 1`,
    [registryNo],
  );
  return rows[0] ? toHolder(rows[0]) : null;
}

export async function countClaimed(db: Db): Promise<number> {
  const rows = await db.query<{ c: number }>(`select count(*)::int as c from titles where status = 'claimed'`);
  return rows[0]?.c ?? 0;
}

export type RegistryTab = "recent" | "lowest";
export const REGISTRY_PAGE_SIZE = 20;

export interface RegistryPage {
  items: PublicHolder[];
  nextCursor: string | null;
}

/**
 * Claimed titles, newest first ("recent") or by registry number ("lowest").
 * Optional search matches the start of any word in the title key. The cursor
 * is opaque: an ISO timestamp plus id for recent, a registry number for lowest.
 */
export async function listRegistry(
  db: Db,
  opts: { tab: RegistryTab; cursor?: string | null; q?: string | null; limit?: number },
): Promise<RegistryPage> {
  const limit = Math.min(Math.max(opts.limit ?? REGISTRY_PAGE_SIZE, 1), 50);
  const params: unknown[] = [];
  const where: string[] = [`status = 'claimed'`];

  if (opts.q) {
    params.push(opts.q);
    const p = `$${params.length}`;
    where.push(`(title_key like ${p} || '%' or title_key like '% ' || ${p} || '%')`);
  }

  let order: string;
  if (opts.tab === "lowest") {
    order = `registry_no asc`;
    if (opts.cursor && /^\d+$/.test(opts.cursor)) {
      params.push(Number(opts.cursor));
      where.push(`registry_no > $${params.length}`);
    }
  } else {
    order = `claimed_at desc, id desc`;
    const m = opts.cursor?.match(/^(.+)\|([0-9a-f-]{36})$/);
    if (m && !Number.isNaN(Date.parse(m[1]))) {
      params.push(m[1], m[2]);
      where.push(`(claimed_at, id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`);
    }
  }

  params.push(limit + 1);
  const rows = await db.query<HolderRow>(
    `select ${HOLDER_COLUMNS} from titles where ${where.join(" and ")} order by ${order} limit $${params.length}`,
    params,
  );
  const items = rows.slice(0, limit).map(toHolder);
  let nextCursor: string | null = null;
  if (rows.length > limit) {
    const last = items[items.length - 1];
    nextCursor =
      opts.tab === "lowest"
        ? String(last.registryNo)
        : `${(last.claimedAt ?? new Date(0)).toISOString()}|${last.id}`;
  }
  return { items, nextCursor };
}

export interface IconicEntry {
  titleKey: string;
  holder: PublicHolder | null;
}

/** Every iconic title, open or taken, in alphabetical order. */
export async function listIconic(db: Db): Promise<IconicEntry[]> {
  const rows = await db.query<HolderRow & { tier_key: string }>(
    `select tt.title_key as tier_key, ${HOLDER_COLUMNS.split(",")
      .map((c) => `t.${c.trim()}`)
      .join(", ")}
     from tier_titles tt
     left join titles t on t.title_key = tt.title_key and t.status in ('claimed','in_review')
     where tt.tier = 'iconic'
     order by tt.title_key`,
  );
  return rows.map((r) => ({ titleKey: r.tier_key, holder: r.id ? toHolder(r) : null }));
}

/** What the buyer paid for a claim, for the ad-conversion value on the success page. */
export async function getPaidAmount(db: Db, id: string): Promise<{ cents: number; currency: string } | null> {
  const rows = await db.query<{ price_cents: number; currency: string }>(
    `select price_cents, currency from titles where id = $1 and status in ('claimed','in_review')`,
    [id],
  );
  const r = rows[0];
  return r ? { cents: r.price_cents, currency: r.currency.toUpperCase() } : null;
}

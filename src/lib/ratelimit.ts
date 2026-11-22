/**
 * Fixed-window rate limits in the rate_limits table. Buckets are
 * "<name>:<hashed client ip>", so raw IP addresses are never stored.
 * Rows are kept 30 days because the admin stats count search buckets.
 */
import { createHash } from "node:crypto";
import type { Db } from "@/lib/db";

export interface Limit {
  name: string;
  max: number;
  windowSec: number;
}

export const LIMITS = {
  search: { name: "search", max: 60, windowSec: 60 },
  checkout: { name: "checkout", max: 5, windowSec: 3600 },
  report: { name: "report", max: 5, windowSec: 3600 },
  manage: { name: "manage", max: 20, windowSec: 3600 },
  view: { name: "view", max: 120, windowSec: 60 },
  adminFail: { name: "admin_fail", max: 5, windowSec: 900 },
} as const satisfies Record<string, Limit>;

export interface LimitResult {
  ok: boolean;
  count: number;
  retryAfterSec: number;
}

/** First address in X-Forwarded-For (set by Vercel), else X-Real-IP. */
export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function hashKey(value: string): string {
  const salt = process.env.VIEWER_HASH_SALT ?? process.env.SESSION_SECRET ?? "dev-salt";
  return createHash("sha256").update(`${salt}:${value}`).digest("base64url").slice(0, 22);
}

function windowStartSql(windowSec: number): string {
  return `to_timestamp(floor(extract(epoch from now()) / ${windowSec}) * ${windowSec})`;
}

/** Count one hit; ok is false once the window's count exceeds max. */
export async function hit(db: Db, limit: Limit, key: string): Promise<LimitResult> {
  const rows = await db.query<{ count: number; retry: number }>(
    `insert into rate_limits (bucket, window_start, count)
     values ($1, ${windowStartSql(limit.windowSec)}, 1)
     on conflict (bucket, window_start) do update set count = rate_limits.count + 1
     returning count, ceil(extract(epoch from (window_start + make_interval(secs => $2) - now())))::int as retry`,
    [`${limit.name}:${hashKey(key)}`, limit.windowSec],
  );
  if (Math.random() < 0.01) {
    await db.query(`delete from rate_limits where window_start < now() - interval '30 days'`).catch(() => undefined);
  }
  const { count, retry } = rows[0];
  return { ok: count <= limit.max, count, retryAfterSec: Math.max(1, retry) };
}

/** Current count without adding a hit. */
export async function peek(db: Db, limit: Limit, key: string): Promise<LimitResult> {
  const rows = await db.query<{ count: number; retry: number }>(
    `select count, ceil(extract(epoch from (window_start + make_interval(secs => $2) - now())))::int as retry
     from rate_limits where bucket = $1 and window_start = ${windowStartSql(limit.windowSec)}`,
    [`${limit.name}:${hashKey(key)}`, limit.windowSec],
  );
  const count = rows[0]?.count ?? 0;
  return { ok: count < limit.max, count, retryAfterSec: Math.max(1, rows[0]?.retry ?? limit.windowSec) };
}

/** Hit the limit for this request's IP; a 429 response when it is exceeded, else null. */
export async function limitRequest(db: Db, limit: Limit, request: Request): Promise<Response | null> {
  const r = await hit(db, limit, clientIp(request));
  if (r.ok) return null;
  return Response.json(
    { error: "Too many requests. Please wait a moment and try again." },
    { status: 429, headers: { "Retry-After": String(r.retryAfterSec) } },
  );
}

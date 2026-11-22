/**
 * Single-user admin authentication.
 * - ADMIN_PASSWORD_HASH: "scrypt$N$r$p$<salt b64>$<hash b64>", made with
 *   `npm run admin:hash` (never the plain password).
 * - Session: httpOnly, SameSite=Strict cookie "<expiry>.<HMAC-SHA256>" signed
 *   with SESSION_SECRET, valid 12 hours.
 * - Lockout: after 5 failed logins from one IP in 15 minutes, further attempts
 *   are refused until the window passes, even with the right password. A
 *   global cap of 50 failures per 15 minutes slows distributed guessing.
 * - State-changing admin requests must come from this site's origin.
 */
import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Db } from "@/lib/db";
import { LIMITS, clientIp, hit, peek } from "@/lib/ratelimit";
import { siteUrl } from "@/lib/site";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, keylen: number, opts: { N: number; r: number; p: number; maxmem: number }) => Promise<Buffer>;

export const ADMIN_COOKIE = "wbr_admin";
export const SESSION_HOURS = 12;
const GLOBAL_FAIL_LIMIT = { name: "admin_fail_all", max: 50, windowSec: 900 } as const;

export async function hashPassword(password: string, N = 16384, r = 8, p = 1): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 32, { N, r, p, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [N, r, p] = parts.slice(1, 4).map(Number);
  if (![N, r, p].every((n) => Number.isInteger(n) && n > 0)) return false;
  const salt = Buffer.from(parts[4], "base64");
  const expected = Buffer.from(parts[5], "base64");
  const actual = await scrypt(password, salt, expected.length, { N, r, p, maxmem: 64 * 1024 * 1024 });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function secret(): string | null {
  const s = process.env.SESSION_SECRET;
  return s && s.length >= 32 ? s : null;
}

function sign(payload: string, key: string): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

export function createSessionValue(now = Date.now()): string {
  const key = secret();
  if (!key) throw new Error("SESSION_SECRET must be at least 32 characters");
  const exp = Math.floor(now / 1000) + SESSION_HOURS * 3600;
  return `${exp}.${sign(`admin.${exp}`, key)}`;
}

export function verifySessionValue(value: string | undefined | null, now = Date.now()): boolean {
  const key = secret();
  if (!key || !value) return false;
  const [expStr, sig] = value.split(".");
  const exp = Number(expStr);
  if (!Number.isInteger(exp) || !sig || exp < now / 1000) return false;
  const expected = Buffer.from(sign(`admin.${exp}`, key));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

export function sessionCookieHeader(value: string, maxAgeSec = SESSION_HOURS * 3600): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${ADMIN_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSec}${secure}`;
}

export function clearCookieHeader(): string {
  return sessionCookieHeader("", 0);
}

export function isAdminRequest(request: Request): boolean {
  return verifySessionValue(readCookie(request, ADMIN_COOKIE));
}

/** Same-origin check for state-changing admin requests. */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const allowed = new Set([new URL(request.url).origin, new URL(siteUrl()).origin]);
  return allowed.has(origin);
}

/** Guard for admin API routes: a Response to return when not allowed, else null. */
export function requireAdmin(request: Request, { mutating = true } = {}): Response | null {
  if (!isAdminRequest(request)) return Response.json({ error: "Not signed in." }, { status: 401 });
  if (mutating && !sameOrigin(request)) return Response.json({ error: "Bad origin." }, { status: 403 });
  return null;
}

export type LoginResult =
  | { ok: true; cookie: string }
  | { ok: false; status: 401 | 429 | 503; error: string; retryAfterSec?: number };

export async function attemptLogin(db: Db, request: Request, password: string): Promise<LoginResult> {
  const stored = process.env.ADMIN_PASSWORD_HASH;
  if (!stored || !secret()) return { ok: false, status: 503, error: "Admin isn't configured." };

  const ip = clientIp(request);
  const [mine, all] = await Promise.all([peek(db, LIMITS.adminFail, ip), peek(db, GLOBAL_FAIL_LIMIT, "all")]);
  if (!mine.ok || !all.ok) {
    const retry = Math.max(mine.ok ? 0 : mine.retryAfterSec, all.ok ? 0 : all.retryAfterSec);
    return { ok: false, status: 429, error: "Too many failed attempts. Try again later.", retryAfterSec: retry };
  }

  if (await verifyPassword(password, stored)) {
    return { ok: true, cookie: sessionCookieHeader(createSessionValue()) };
  }
  await Promise.all([hit(db, LIMITS.adminFail, ip), hit(db, GLOBAL_FAIL_LIMIT, "all")]);
  return { ok: false, status: 401, error: "Wrong password." };
}

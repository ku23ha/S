/**
 * Analytics event names and properties (docs/API.md). Shared by the client
 * and server helpers. No personal data: never names, emails, dedications,
 * manage tokens or IP addresses.
 */
import type { Tier } from "@/lib/titles";

export type SearchSource = "home" | "certificate" | "registry" | "claim" | "success";

export interface AnalyticsEvents {
  page_view: { path: string; referrer: string | null; ref_slug: string | null };
  title_searched: { result: "available" | "taken" | "reserved" | "blocked"; tier: Tier | null; source: SearchSource };
  variant_clicked: { tier: Tier | null };
  claim_started: { tier: Tier; price_cents: number; ref_slug: string | null };
  checkout_started: { tier: Tier; addon_print: boolean; price_cents: number };
  claim_completed: { tier: Tier; addon_print: boolean; price_cents: number; ref_slug: string | null; registry_no: number };
  certificate_viewed: { slug: string; is_owner_session: boolean; referrer: string | null };
  share_clicked: { channel: "native" | "copy" | "whatsapp" | "x" | "linkedin"; slug: string };
  download_clicked: { kind: "share_image" | "story_image" | "print_a4" | "print_letter" | "christmas_card" };
  shop_clicked: { item: "frame" | "card"; store: "in" | "com" };
  report_submitted: { slug: string };
}

export type AnalyticsEventName = keyof AnalyticsEvents;

const UUID_SEGMENT = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/**
 * Strip anything private from a URL or path before it leaves the browser:
 * manage tokens, query strings (success ids, print tokens) and fragments.
 */
export function sanitizePath(urlOrPath: string): string {
  let path = urlOrPath;
  try {
    path = new URL(urlOrPath, "https://x.invalid").pathname;
  } catch {
    path = urlOrPath.split(/[?#]/)[0];
  }
  return path
    .replace(/^\/manage\/[^/]+/, "/manage/[token]")
    .replace(/^\/api\/manage\/[^/]+/, "/api/manage/[token]")
    .replace(UUID_SEGMENT, "[id]");
}

const URL_KEY = /(_url|url|pathname|^\$current_url|^\$pathname)$/i;
const REFERRER_KEY = /referrer$/i;

/**
 * Clean every URL-like property posthog-js adds (current, initial and
 * session-entry URLs and paths, referrers), including inside $set and
 * $set_once, so manage tokens, ids and query strings never leave the browser.
 */
export function scrubEventProperties(props: Record<string, unknown>, ownOrigin?: string): Record<string, unknown> {
  for (const [k, v] of Object.entries(props)) {
    if (v && typeof v === "object" && !Array.isArray(v) && (k === "$set" || k === "$set_once")) {
      scrubEventProperties(v as Record<string, unknown>, ownOrigin);
    } else if (typeof v === "string" && REFERRER_KEY.test(k)) {
      props[k] = v === "$direct" ? v : sanitizeReferrer(v, ownOrigin);
    } else if (typeof v === "string" && URL_KEY.test(k)) {
      props[k] = sanitizePath(v);
    }
  }
  return props;
}

/** Keep only the origin of an external referrer. */
export function sanitizeReferrer(referrer: string | null | undefined, ownOrigin?: string): string | null {
  if (!referrer) return null;
  try {
    const u = new URL(referrer);
    if (ownOrigin && u.origin === ownOrigin) return null;
    return u.origin;
  } catch {
    return null;
  }
}

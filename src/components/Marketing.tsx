"use client";

/**
 * Ad and measurement tags (Google Analytics 4, Google Ads, Meta Pixel).
 *
 * - Nothing loads until the visitor accepts in the cookie banner ("basic"
 *   consent mode). Declining is as easy as accepting.
 * - Private pages (manage links, admin, checkout plumbing) never load the
 *   tags, and every page URL sent is cleaned with sanitizePath, so manage
 *   tokens and success ids never leave the browser.
 * - Automatic history tracking is off on both platforms; page views are sent
 *   by hand with clean URLs.
 * Each tag is enabled only when its public id is set.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { sanitizePath } from "@/lib/analytics";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID?.trim() || "";
const ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID?.trim() || "";
const ADS_LABEL = process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL?.trim() || "";
const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() || "";

export const marketingConfigured = Boolean(GA_ID || ADS_ID || PIXEL_ID);

const KEY = "wbr_consent";
type Choice = "granted" | "denied" | null;
const listeners = new Set<() => void>();

function readChoice(): Choice {
  try {
    const v = localStorage.getItem(KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

function setChoice(v: Exclude<Choice, null>) {
  try {
    localStorage.setItem(KEY, v);
  } catch {
    // Storage blocked: the choice lasts for this page only.
  }
  memo = v;
  listeners.forEach((l) => l());
}

let memo: Choice = null;
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
function snapshot(): Choice {
  return memo ?? readChoice();
}

export function useConsent(): Choice | "unknown" {
  return useSyncExternalStore(subscribe, snapshot, () => "unknown" as const);
}

/** Paths that must never reach an ad or analytics tag. */
export function isPrivatePath(path: string): boolean {
  return /^\/(manage|admin|api|dev)(\/|$)/.test(path);
}

type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...a: unknown[]) => void; queue: unknown[]; loaded: boolean; version: string; push: unknown; disablePushState?: boolean };
type W = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void; fbq?: Fbq; _fbq?: Fbq };

function addScript(src: string) {
  if (document.querySelector(`script[src="${src}"]`)) return;
  const s = document.createElement("script");
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

let loaded = false;
function loadTags() {
  if (loaded || !marketingConfigured) return;
  loaded = true;
  const w = window as W;
  if (GA_ID || ADS_ID) {
    w.dataLayer = w.dataLayer || [];
    w.gtag = function gtag() {
      // gtag needs the arguments object itself.
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer!.push(arguments);
    };
    // Consent Mode v2: tags only ever load after "Accept", so send the
    // denied default and the granted update together, as Google expects.
    const signals = ["ad_storage", "analytics_storage", "ad_user_data", "ad_personalization"] as const;
    w.gtag("consent", "default", Object.fromEntries(signals.map((k) => [k, "denied"])));
    w.gtag("consent", "update", Object.fromEntries(signals.map((k) => [k, "granted"])));
    w.gtag("js", new Date());
    if (GA_ID) w.gtag("config", GA_ID, { send_page_view: false, allow_google_signals: false });
    if (ADS_ID) w.gtag("config", ADS_ID, { send_page_view: false });
    addScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID || ADS_ID)}`);
  }
  if (PIXEL_ID) {
    const f = function fbq(...args: unknown[]) {
      if (f.callMethod) f.callMethod(...args);
      else f.queue.push(args);
    } as Fbq;
    f.push = f;
    f.loaded = true;
    f.version = "2.0";
    f.queue = [];
    f.disablePushState = true; // no automatic page views on client navigation
    w.fbq = f;
    w._fbq = f;
    f("set", "autoConfig", false, PIXEL_ID);
    f("init", PIXEL_ID);
    addScript("https://connect.facebook.net/en_US/fbevents.js");
  }
}

function sendPageView(path: string) {
  const w = window as W;
  const clean = `${window.location.origin}${sanitizePath(path)}`;
  if (w.gtag && GA_ID) {
    w.gtag("set", { page_location: clean, page_referrer: "" });
    w.gtag("event", "page_view", { page_location: clean, send_to: GA_ID });
  }
  w.fbq?.("track", "PageView");
}

/** Loads the tags after consent and sends a clean page view on each route. */
export function MarketingTags() {
  const consent = useConsent();
  const pathname = usePathname();
  useEffect(() => {
    if (consent !== "granted" || isPrivatePath(pathname)) return;
    loadTags();
    sendPageView(pathname);
  }, [consent, pathname]);
  return null;
}

/** One purchase conversion per claim, after consent, on the success page. */
export function PurchaseConversion({ id, registryNo, value, currency }: { id: string; registryNo: number | null; value: number; currency: string }) {
  const consent = useConsent();
  useEffect(() => {
    if (consent !== "granted" || !marketingConfigured) return;
    const key = `wbr_conv:${id}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      // If storage is blocked we may count twice on reload; acceptable.
    }
    loadTags();
    const w = window as W;
    const txn = registryNo != null ? `WBR-${registryNo}` : `WBR-${id.slice(0, 8)}`;
    if (w.gtag && GA_ID) w.gtag("event", "purchase", { transaction_id: txn, value, currency, send_to: GA_ID });
    if (w.gtag && ADS_ID && ADS_LABEL) {
      w.gtag("event", "conversion", { send_to: `${ADS_ID}/${ADS_LABEL}`, value, currency, transaction_id: txn });
    }
    w.fbq?.("track", "Purchase", { value, currency }, { eventID: txn });
  }, [consent, id, registryNo, value, currency]);
  return null;
}

/** Fires when a visitor opens the claim form: the "add to cart" moment. */
export function BeginCheckoutSignal({ value, currency }: { value: number; currency: string }) {
  const consent = useConsent();
  useEffect(() => {
    if (consent !== "granted" || !marketingConfigured) return;
    loadTags();
    const w = window as W;
    if (w.gtag && GA_ID) w.gtag("event", "begin_checkout", { value, currency, send_to: GA_ID });
    w.fbq?.("track", "InitiateCheckout", { value, currency });
  }, [consent, value, currency]);
  return null;
}

/** Bottom banner asking once. Equal-weight buttons; no pre-ticked choices. */
export function ConsentBanner() {
  const consent = useConsent();
  const [reopened, setReopened] = useState(false);
  useEffect(() => {
    const open = () => setReopened(true);
    window.addEventListener("wbr:cookie-settings", open);
    return () => window.removeEventListener("wbr:cookie-settings", open);
  }, []);
  if (!marketingConfigured || consent === "unknown") return null;
  if (consent !== null && !reopened) return null;
  const choose = (v: "granted" | "denied") => {
    setChoice(v);
    setReopened(false);
    if (v === "denied" && loaded) window.location.reload(); // unload tags already running
  };
  const btn = "flex-1 rounded-full border px-4 py-2.5 text-sm font-semibold transition";
  return (
    <div role="dialog" aria-label="Cookie choices" className="fixed inset-x-0 bottom-0 z-40 p-3 sm:p-4">
      <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-4 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.35)]">
        <p className="text-sm text-ink-soft">
          May we use cookies to measure our ads (Google and Meta)? It helps us keep prices low. Saying no changes nothing on the
          site. <Link href="/privacy">Privacy</Link>
        </p>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => choose("denied")} className={`${btn} border-ink bg-white text-ink hover:bg-paper`}>
            No thanks
          </button>
          <button type="button" onClick={() => choose("granted")} className={`${btn} border-ink bg-ink text-paper hover:bg-ink-soft`}>
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}

/** Footer link that reopens the banner. Hidden when no tags are configured. */
export function CookieSettingsLink({ className }: { className?: string }) {
  if (!marketingConfigured) return null;
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event("wbr:cookie-settings"))}>
      Cookie settings
    </button>
  );
}

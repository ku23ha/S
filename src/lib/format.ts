/** Display helpers safe for both server and client code. */
import type { PublicHolder } from "@/lib/queries";
import { CURRENCY, type PriceCurrency, TITLE_PREFIX } from "@/lib/titles";

export function fullTitle(display: string): string {
  return `${TITLE_PREFIX} ${display}`;
}

/** "No. 000482". Numbers above 999999 simply grow. */
export function formatRegistryNo(n: number | null | undefined): string {
  return n == null ? "" : `No. ${String(n).padStart(6, "0")}`;
}

/** "21 November 2026", in UTC so server and client agree. */
export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

/** "$5", "$5.50", "₹399", "₹7,999", in the active price currency. */
export function formatPrice(cents: number, currency: PriceCurrency = CURRENCY): string {
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/** Certificate path; slugs may hold non-Latin letters, so encode them. */
export function certificatePath(slug: string): string {
  return `/c/${encodeURIComponent(slug)}`;
}

/** "Priya is the only World's Best Sunny Mom. No. 000006 in The World's Best Registry." */
export function shareText(h: { recipientName: string; titleDisplay: string; registryNo: number | null }): string {
  const no = h.registryNo != null ? ` ${formatRegistryNo(h.registryNo)} in The World's Best Registry.` : "";
  return `${h.recipientName} is the only ${fullTitle(h.titleDisplay)}.${no}`;
}

/** Link to the claim page for a title, carrying the certificate that led there. */
export function claimHref(display: string, refSlug?: string | null): string {
  const p = new URLSearchParams({ title: display });
  if (refSlug) p.set("ref", refSlug);
  return `/claim?${p.toString()}`;
}

export interface RegistryCard {
  slug: string;
  titleDisplay: string;
  recipientName: string;
  registryNo: number | null;
  claimedAt: string | null;
  tier: PublicHolder["tier"];
}

export function toRegistryCard(h: PublicHolder): RegistryCard {
  return {
    slug: h.slug,
    titleDisplay: h.titleDisplay,
    recipientName: h.recipientName,
    registryNo: h.registryNo,
    claimedAt: h.claimedAt ? h.claimedAt.toISOString() : null,
    tier: h.tier,
  };
}

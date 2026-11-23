/** Shared lookups for certificate image routes. */
import type { CertImageData } from "@/lib/cert-image";
import { getDb } from "@/lib/db";
import { type PublicHolder, getCertificateBySlug } from "@/lib/queries";
import { errorSummary } from "@/lib/log";
import { certificatePath } from "@/lib/format";
import { siteUrl } from "@/lib/site";

export function decodeSlug(raw: string): string {
  try {
    return decodeURIComponent(raw).slice(0, 200);
  } catch {
    return raw.slice(0, 200);
  }
}

export function toImageData(h: PublicHolder, host: string): CertImageData {
  return {
    titleDisplay: h.titleDisplay,
    recipientName: h.recipientName,
    registryNo: h.registryNo,
    claimedAt: h.claimedAt,
    giverName: h.giverName,
    dedication: h.dedication,
    inReview: h.status === "in_review",
    siteHost: host,
    url: `${siteUrl()}${certificatePath(h.slug)}`,
  };
}

export async function publicImageData(rawSlug: string, host: string): Promise<CertImageData | null> {
  try {
    const cert = await getCertificateBySlug(await getDb(), decodeSlug(rawSlug));
    return cert ? toImageData(cert, host) : null;
  } catch (err) {
    console.error("certificate lookup failed", errorSummary(err));
    return null;
  }
}

/** Public images: short browser cache, longer shared cache, refreshed after edits. */
export const PUBLIC_IMAGE_CACHE = { "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400" };

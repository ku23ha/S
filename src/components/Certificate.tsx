import { PRODUCT_NAME } from "@/lib/copy";
import { formatDate, formatRegistryNo } from "@/lib/format";
import { TITLE_PREFIX } from "@/lib/titles";

function titleSize(display: string): string {
  const n = [...display].length;
  if (n <= 12) return "text-4xl sm:text-5xl";
  if (n <= 24) return "text-3xl sm:text-4xl";
  return "text-2xl sm:text-3xl";
}

/**
 * The certificate as HTML. User text is rendered as React text nodes, so it
 * is escaped. Long words wrap anywhere so nothing overflows at 375 px.
 */
export function Certificate({
  titleDisplay,
  recipientName,
  registryNo,
  claimedAt,
  giverName,
  dedication,
  inReview = false,
  titleAs: TitleTag = "h1",
  footerNote,
}: {
  /** Use "p" when the certificate is an illustration inside another page. */
  titleAs?: "h1" | "p";
  /** Shown in place of the number and date on an illustration. */
  footerNote?: string;
  titleDisplay: string;
  recipientName: string;
  registryNo: number | null;
  claimedAt: Date | string | null;
  giverName?: string | null;
  dedication?: string | null;
  inReview?: boolean;
}) {
  return (
    <article className="relative overflow-hidden rounded-2xl border-4 border-double border-amber-700 bg-amber-50 px-5 py-8 text-center text-neutral-900 shadow-sm sm:px-10 sm:py-12">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-800">{PRODUCT_NAME}</p>

      <p className="mt-6 text-sm uppercase tracking-widest text-neutral-600">{TITLE_PREFIX}</p>
      <TitleTag className={`mt-1 font-serif font-bold leading-tight [overflow-wrap:anywhere] ${titleSize(titleDisplay)}`}>
        {titleDisplay}
      </TitleTag>

      {inReview ? (
        <p className="mt-6 text-base text-neutral-700">This certificate is in review and will appear here soon.</p>
      ) : (
        <>
          <p className="mt-6 text-sm text-neutral-600">is held by</p>
          <p className="mt-1 font-serif text-2xl font-semibold [overflow-wrap:anywhere] sm:text-3xl">{recipientName}</p>
          {dedication ? (
            <p className="mx-auto mt-5 max-w-md text-base italic text-neutral-700 [overflow-wrap:anywhere]">
              &ldquo;{dedication}&rdquo;
            </p>
          ) : null}
          {giverName ? <p className="mt-3 text-sm text-neutral-700 [overflow-wrap:anywhere]">From {giverName}</p> : null}
        </>
      )}

      <div className="mt-8 border-t border-amber-700/30 pt-4 text-sm text-neutral-700">
        {registryNo != null && (
          <p>
            Entered in {PRODUCT_NAME}, {formatRegistryNo(registryNo)}
          </p>
        )}
        {claimedAt && <p className="mt-1">{formatDate(claimedAt)}</p>}
        {footerNote && <p>{footerNote}</p>}
      </div>
    </article>
  );
}

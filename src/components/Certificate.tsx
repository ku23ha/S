import { PRODUCT_NAME } from "@/lib/copy";
import { formatDate } from "@/lib/format";
import type { ReactNode } from "react";
import { TITLE_PREFIX } from "@/lib/titles";

function titleSize(display: string): string {
  const n = [...display].length;
  if (n <= 12) return "text-4xl sm:text-6xl";
  if (n <= 24) return "text-3xl sm:text-5xl";
  return "text-2xl sm:text-4xl";
}

/** Gold registry seal with the number in the middle; stamps in on first view. */
export function Seal({ registryNo, className = "" }: { registryNo: number | null; className?: string }) {
  const no = registryNo == null ? "——" : String(registryNo).padStart(6, "0");
  const id = `seal-${registryNo ?? "x"}`;
  return (
    <svg viewBox="0 0 120 120" role="img" aria-label={registryNo == null ? "Registry seal" : `Registry number ${no}`} className={`seal ${className}`}>
      <defs>
        <path id={`${id}-ring`} d="M60,60 m-41,0 a41,41 0 1,1 82,0 a41,41 0 1,1 -82,0" />
        <radialGradient id={`${id}-fill`} cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#f6e2a8" />
          <stop offset="55%" stopColor="#d4a548" />
          <stop offset="100%" stopColor="#9a6410" />
        </radialGradient>
      </defs>
      <g className="seal-body">
        {Array.from({ length: 36 }, (_, i) => (
          <path key={i} d="M60 2 l4 9 -8 0z" fill="#b07a1a" transform={`rotate(${i * 10} 60 60)`} />
        ))}
        <circle cx="60" cy="60" r="50" fill={`url(#${id}-fill)`} stroke="#8a5a0c" strokeWidth="1.5" />
        <circle cx="60" cy="60" r="33" fill="none" stroke="#7c4a06" strokeOpacity="0.55" strokeWidth="1" />
        <text fontSize="8.2" letterSpacing="2.2" fill="#5b3504" fontWeight="700">
          <textPath href={`#${id}-ring`} startOffset="0">
            WORLD&apos;S BEST REGISTRY · ONE HOLDER ·
          </textPath>
        </text>
        <text x="60" y="56" textAnchor="middle" fontSize="9" fill="#5b3504" fontWeight="700" letterSpacing="1">
          №
        </text>
        <text x="60" y="71" textAnchor="middle" fontSize="13" fill="#3f2503" fontWeight="800" letterSpacing="0.5">
          {no}
        </text>
      </g>
    </svg>
  );
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
  qr,
}: {
  titleDisplay: string;
  recipientName: string;
  registryNo: number | null;
  claimedAt: Date | string | null;
  giverName?: string | null;
  dedication?: string | null;
  inReview?: boolean;
  /** Use "p" when the certificate is an illustration inside another page. */
  titleAs?: "h1" | "p";
  /** Shown in place of the date on an illustration. */
  footerNote?: string;
  /** A QR code leading back to the certificate (CertificateQr, server only). */
  qr?: ReactNode;
}) {
  return (
    <article className="certificate relative overflow-hidden rounded-[20px] bg-[#fffaf0] p-2 text-ink shadow-[0_30px_60px_-30px_rgba(124,74,6,0.45)] ring-1 ring-gold/30">
      <div className="certificate-paper relative rounded-[14px] border-[3px] border-gold-deep/80 p-1.5">
        <div className="relative rounded-[10px] border border-gold/60 px-5 pb-6 pt-8 text-center sm:px-12 sm:pb-8 sm:pt-12">
          {(["left-2 top-2", "right-2 top-2 rotate-90", "right-2 bottom-2 rotate-180", "left-2 bottom-2 -rotate-90"] as const).map((pos) => (
            <svg key={pos} viewBox="0 0 24 24" aria-hidden="true" className={`absolute h-5 w-5 text-gold ${pos}`}>
              <path d="M2 22V8a6 6 0 0 1 6-6h14M6 22V11a5 5 0 0 1 5-5h11" fill="none" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          ))}

          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-gold-deep">{PRODUCT_NAME}</p>
          <div aria-hidden="true" className="mx-auto mt-3 flex w-40 items-center gap-2 text-gold">
            <span className="h-px flex-1 bg-gold/50" />
            <span className="text-xs">✦</span>
            <span className="h-px flex-1 bg-gold/50" />
          </div>

          <p className="mt-5 text-xs uppercase tracking-[0.3em] text-muted">{TITLE_PREFIX}</p>
          <TitleTag className={`mt-2 font-display font-semibold leading-[1.05] tracking-tight [overflow-wrap:anywhere] ${titleSize(titleDisplay)}`}>
            {titleDisplay}
          </TitleTag>

          {inReview ? (
            <p className="mt-6 text-base text-ink-soft">This certificate is in review and will appear here soon.</p>
          ) : (
            <>
              <p className="mt-6 text-sm italic text-muted">is held, now and always, by</p>
              <p className="mt-1 font-display text-2xl font-medium italic [overflow-wrap:anywhere] sm:text-4xl">{recipientName}</p>
              {dedication ? (
                <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-ink-soft [overflow-wrap:anywhere]">
                  &ldquo;{dedication}&rdquo;
                </p>
              ) : null}
              {giverName ? (
                <p className="mt-3 text-sm uppercase tracking-[0.2em] text-muted [overflow-wrap:anywhere]">With love, {giverName}</p>
              ) : null}
            </>
          )}

          <div className="mt-8 grid grid-cols-[1fr_auto_1fr] items-end gap-3 border-t border-gold/40 pt-5 text-left">
            <div className="text-xs text-muted">
              <p className="uppercase tracking-[0.2em]">Entered</p>
              <p className="mt-1 font-display text-sm text-ink">{claimedAt ? formatDate(claimedAt) : (footerNote ?? "On the day you give it")}</p>
            </div>
            <Seal registryNo={registryNo} className="-mb-2 h-20 w-20 sm:h-24 sm:w-24" />
            <div className="flex flex-col items-end text-right text-xs text-muted">
              {qr ? (
                <>
                  {qr}
                  <p className="mt-1">Scan to look it up</p>
                </>
              ) : (
                <>
                  <p className="uppercase tracking-[0.2em]">Registry</p>
                  <p className="mt-1 font-display text-sm text-ink">One holder, ever</p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

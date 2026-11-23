"use client";

import { type ReactNode, useState } from "react";

/**
 * A sealed envelope the recipient taps to open; the certificate (children)
 * mounts on open so its seal stamps in at that moment. Used when the giver
 * shares the link "as a surprise" (?gift=1). Without JavaScript the
 * certificate shows straight away.
 */
export function GiftReveal({ giverName, children }: { giverName: string | null; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <noscript>
        <style>{`.gift-cover{display:none!important}.gift-inner{display:block!important}`}</style>
      </noscript>
      {!open && (
        <div className="gift-cover rise flex min-h-[70vh] flex-col items-center justify-center text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gold-deep">
            {giverName ? <span className="[overflow-wrap:anywhere]">From {giverName}</span> : "Someone made you something"}
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">There&apos;s something here with your name on it.</h1>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="envelope group mt-10 w-full max-w-xs"
            aria-label="Open your gift"
          >
            <svg viewBox="0 0 240 170" className="w-full drop-shadow-[0_24px_30px_rgba(91,53,4,0.28)]" aria-hidden="true">
              <rect x="4" y="20" width="232" height="146" rx="10" fill="#fffaf0" stroke="#b7862f" strokeWidth="2" />
              <path d="M6 28 L120 104 L234 28" fill="none" stroke="#d9b56a" strokeWidth="2" />
              <path className="envelope-flap" d="M4 30 Q4 20 14 20 H226 Q236 20 236 30 L120 108 Z" fill="#f6ead0" stroke="#b7862f" strokeWidth="2" />
              <g className="envelope-seal">
                <circle cx="120" cy="104" r="22" fill="#a1620a" />
                <circle cx="120" cy="104" r="17" fill="none" stroke="#f6d48b" strokeWidth="1.2" />
                <text x="120" y="110" textAnchor="middle" fontSize="16" fill="#fdf3d8" fontFamily="Georgia, serif">✦</text>
              </g>
            </svg>
            <span className="mt-6 inline-block rounded-full bg-ink px-6 py-3 font-semibold text-paper transition group-hover:bg-ink-soft">
              Tap to open
            </span>
          </button>
        </div>
      )}
      <div className="gift-inner" hidden={!open}>
        {open ? <div className="gift-opened">{children}</div> : <noscript>{children}</noscript>}
      </div>
    </>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { claimHref, fullTitle } from "@/lib/format";
import { RECIPIENTS } from "@/lib/helper";

const PIECES = Array.from({ length: 28 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: (i % 7) * 0.12,
  dur: 2.4 + ((i * 13) % 10) / 10,
  color: ["#a1620a", "#e2b55a", "#f6d48b", "#7c4a06", "#fdf3d8"][i % 5],
  size: 6 + (i % 4) * 2,
  round: i % 3 === 0,
}));

/** A one-time gold burst over the success page. Decorative; skipped for reduced motion by the global rule. */
export function Confetti() {
  const [show, setShow] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShow(false), 4500);
    return () => clearTimeout(t);
  }, []);
  if (!show) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {PIECES.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.round ? p.size : p.size * 1.6,
            background: p.color,
            borderRadius: p.round ? "9999px" : "2px",
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
          }}
        />
      ))}
    </div>
  );
}

/** "Who else deserves one?": quick ways back in after a claim. */
export function WhoElse() {
  const picks = ["mom", "dad", "friend", "sibling", "partner-f", "work"]
    .map((id) => RECIPIENTS.find((r) => r.id === id)!)
    .map((r) => ({ r, title: r.titles.find((t) => !/^(Girlfriend|Wife|Mom|Dad|Boss|Best Friend)$/.test(t)) ?? r.titles[0] }));
  return (
    <section aria-labelledby="who-else" className="rounded-2xl border border-gold/40 bg-white p-5">
      <h2 id="who-else" className="font-display text-xl font-semibold">
        Who else deserves one?
      </h2>
      <p className="mt-1 text-sm text-ink-soft">The people who never get thanked for the small things. Each title can only go to one person.</p>
      <ul className="mt-4 grid grid-cols-2 gap-2">
        {picks.map(({ r, title }) => (
          <li key={r.id}>
            <Link href={claimHref(title)} className="flex h-full flex-col rounded-xl border border-line bg-[#fffaf0] px-3 py-2 text-sm hover:border-gold">
              <span className="text-xs text-muted">
                {r.emoji} {r.label}
              </span>
              <span className="mt-0.5 font-medium">{fullTitle(title)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

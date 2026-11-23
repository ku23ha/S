"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { claimHref, fullTitle } from "@/lib/format";
import { HELPER_ANSWERS, RECIPIENTS, type Recipient } from "@/lib/helper";

type Msg = { from: "helper" | "you"; text: string; recipient?: Recipient; link?: { href: string; label: string } };

const GREETING: Msg = { from: "helper", text: "Hi! I can help you pick a title or answer a question. Who's the gift for?" };

/**
 * A chat-style gift helper. Its answers are written by us and picked from a
 * fixed script (src/lib/helper.ts); nothing is generated. Hidden on pages
 * where it would get in the way (certificates, checkout, private links).
 */
export function GiftHelper() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([GREETING]);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [msgs, open]);

  if (/^\/(c|success|manage|admin|dev|claim)(\/|$)/.test(pathname)) return null;

  const say = (you: string, reply: Msg) => setMsgs((m) => [...m, { from: "you", text: you }, reply]);

  const chip = "rounded-full border border-line bg-white px-3 py-1.5 text-sm transition hover:border-gold";

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label="Gift helper"
          className="fixed inset-x-3 bottom-20 z-30 flex max-h-[70vh] flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-[0_30px_60px_-20px_rgba(0,0,0,0.4)] sm:inset-x-auto sm:right-5 sm:w-96"
        >
          <div className="flex items-center justify-between border-b border-line bg-white px-4 py-3">
            <p className="font-display font-semibold">Gift helper</p>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close the gift helper" className="text-xl leading-none text-muted hover:text-ink">
              ×
            </button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
            {msgs.map((m, i) => (
              <div key={i} className={m.from === "you" ? "flex justify-end" : "flex"}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    m.from === "you" ? "rounded-br-sm bg-ink text-paper" : "rounded-bl-sm border border-line bg-white text-ink"
                  }`}
                >
                  <p>{m.text}</p>
                  {m.recipient && (
                    <ul className="mt-2 flex flex-col gap-1.5">
                      {m.recipient.titles.map((t) => (
                        <li key={t}>
                          <Link
                            href={claimHref(t)}
                            onClick={() => setOpen(false)}
                            className="flex items-center justify-between gap-2 rounded-lg border border-gold/40 bg-[#fffaf0] px-3 py-2 font-medium hover:border-gold"
                          >
                            <span>{fullTitle(t)}</span>
                            <span aria-hidden="true" className="text-gold-deep">
                              →
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                  {m.link && (
                    <Link href={m.link.href} onClick={() => setOpen(false)} className="mt-2 inline-block font-medium text-gold-deep underline underline-offset-4">
                      {m.link.label}
                    </Link>
                  )}
                </div>
              </div>
            ))}
            <div ref={end} />
          </div>
          <div className="border-t border-line bg-white px-3 py-3">
            <p className="mb-2 text-xs uppercase tracking-[0.15em] text-muted">It&apos;s for</p>
            <div className="flex flex-wrap gap-1.5">
              {RECIPIENTS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={chip}
                  onClick={() =>
                    say(`${r.emoji} ${r.label}`, {
                      from: "helper",
                      text: `Lovely. Here are titles people pick for a ${r.label.toLowerCase()}. Tap one to see if it's free, or search your own: the more specific, the more likely it's still available.`,
                      recipient: r,
                    })
                  }
                >
                  {r.emoji} {r.label}
                </button>
              ))}
            </div>
            <p className="mb-2 mt-3 text-xs uppercase tracking-[0.15em] text-muted">Questions</p>
            <div className="flex flex-wrap gap-1.5">
              {HELPER_ANSWERS.map((a) => (
                <button key={a.id} type="button" className={chip} onClick={() => say(a.q, { from: "helper", text: a.a, link: a.link })}>
                  {a.q}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="fixed bottom-4 right-4 z-30 flex items-center gap-2 rounded-full bg-ink px-4 py-3 text-sm font-semibold text-paper shadow-[0_12px_30px_-10px_rgba(0,0,0,0.5)] transition hover:bg-ink-soft sm:right-5"
      >
        <span aria-hidden="true">{open ? "×" : "✦"}</span>
        {open ? "Close" : "Need an idea?"}
      </button>
    </>
  );
}

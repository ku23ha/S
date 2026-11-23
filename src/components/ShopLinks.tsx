"use client";

import { track } from "@/lib/analytics-client";

/**
 * Optional links to frames and greeting cards on Amazon, so a buyer can
 * turn the print file into something to hold. If Amazon Associates tags are
 * set (NEXT_PUBLIC_AMAZON_TAG_IN / _COM) the links carry them, and we say so.
 */
const TAGS = {
  in: process.env.NEXT_PUBLIC_AMAZON_TAG_IN,
  com: process.env.NEXT_PUBLIC_AMAZON_TAG_COM,
} as const;

function amazonSearch(store: "in" | "com", query: string): string {
  const params = new URLSearchParams({ k: query });
  const tag = TAGS[store];
  if (tag) params.set("tag", tag);
  return `https://www.amazon.${store}/s?${params.toString()}`;
}

const ITEMS = [
  { item: "frame", label: "A4 photo frames", query: "A4 certificate photo frame" },
  { item: "card", label: "Christmas greeting cards", query: "christmas greeting cards blank" },
] as const;

export function ShopLinks() {
  const tagged = Boolean(TAGS.in || TAGS.com);
  return (
    <section aria-labelledby="shop" className="rounded-2xl border border-line bg-white/70 p-5">
      <h2 id="shop" className="font-display text-xl font-semibold">
        Make it something they can hold
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        Print the certificate and slip it into a frame, or tuck the link inside a card. Pick a store near you:
      </p>
      <ul className="mt-4 flex flex-col gap-2">
        {ITEMS.map((i) => (
          <li key={i.item} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-white px-4 py-3">
            <span className="font-medium">{i.label}</span>
            <span className="flex gap-2 text-sm">
              {(["in", "com"] as const).map((store) => (
                <a
                  key={store}
                  href={amazonSearch(store, i.query)}
                  target="_blank"
                  rel="sponsored noopener noreferrer"
                  onClick={() => track("shop_clicked", { item: i.item, store })}
                  className="rounded-full border border-line px-3 py-1 hover:border-gold"
                >
                  Amazon.{store === "in" ? "in" : "com"}
                </a>
              ))}
            </span>
          </li>
        ))}
      </ul>
      {tagged && <p className="mt-3 text-xs text-muted">We may earn a small commission from Amazon purchases. It costs you nothing extra.</p>}
    </section>
  );
}

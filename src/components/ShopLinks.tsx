"use client";

import Link from "next/link";
import { track } from "@/lib/analytics-client";
import { type GiftIdea, GIFT_SHELVES, STORES, type StoreId, hasAffiliateIds, hasAmazonTag, storeSearchUrl } from "@/lib/stores";

const STORE_ORDER: StoreId[] = ["amazon_in", "flipkart", "myntra", "amazon_com"];

/** Store buttons for one gift idea. Every link leaves the site; nothing is sold here. */
export function StoreButtons({ idea }: { idea: GiftIdea }) {
  return (
    <span className="flex flex-wrap gap-2 text-sm">
      {STORE_ORDER.filter((s) => idea.queries[s]).map((store) => (
        <a
          key={store}
          href={storeSearchUrl(store, idea.queries[store]!)}
          target="_blank"
          rel="sponsored noopener noreferrer"
          onClick={() => track("shop_clicked", { item: idea.id, store })}
          className="rounded-full border border-line bg-white px-3 py-1 transition hover:border-gold"
        >
          {STORES[store].label} <span aria-hidden="true">↗</span>
        </a>
      ))}
    </span>
  );
}

export function AffiliateNote() {
  return (
    <p className="text-xs text-muted">
      Links open the store&apos;s own site; we don&apos;t sell or ship these.
      {hasAffiliateIds() ? " We may earn a small commission from purchases, at no extra cost to you." : ""}
      {/* Exact wording required by the Amazon Associates Operating Agreement. */}
      {hasAmazonTag() ? " As an Amazon Associate I earn from qualifying purchases." : ""}
    </p>
  );
}

/** Compact version for the success and manage pages. */
export function ShopLinks() {
  const ideas = GIFT_SHELVES.find((s) => s.id === "keep")!.ideas;
  return (
    <section aria-labelledby="shop" className="rounded-2xl border border-line bg-white/70 p-5">
      <h2 id="shop" className="font-display text-xl font-semibold">
        Make it something they can hold
      </h2>
      <p className="mt-1 text-sm text-ink-soft">Print the certificate and frame it, or tuck the link inside a card.</p>
      <ul className="mt-4 flex flex-col gap-3">
        {ideas.map((i) => (
          <li key={i.id} className="flex flex-col gap-2 rounded-xl border border-line bg-white px-4 py-3">
            <span className="font-medium">{i.name}</span>
            <StoreButtons idea={i} />
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <AffiliateNote />
        <Link href="/gifts" className="text-sm font-medium text-gold-deep underline-offset-4 hover:underline">
          More gift ideas
        </Link>
      </div>
    </section>
  );
}

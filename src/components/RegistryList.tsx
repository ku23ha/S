"use client";

import Link from "next/link";
import { useState } from "react";
import { type RegistryCard, certificatePath, formatDate, formatRegistryNo, fullTitle } from "@/lib/format";

export function RegistryCardView({ card }: { card: RegistryCard }) {
  return (
    <Link
      href={certificatePath(card.slug)}
      className="block rounded-xl border border-neutral-200 p-4 hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
    >
      <p className="font-semibold [overflow-wrap:anywhere]">{fullTitle(card.titleDisplay)}</p>
      <p className="mt-1 text-sm text-neutral-600 [overflow-wrap:anywhere] dark:text-neutral-400">
        {card.recipientName} · {formatRegistryNo(card.registryNo)}
        {card.claimedAt && <> · {formatDate(card.claimedAt)}</>}
      </p>
    </Link>
  );
}

export function RegistryList({
  initial,
  initialCursor,
  tab,
  q,
}: {
  initial: RegistryCard[];
  initialCursor: string | null;
  tab: "recent" | "lowest";
  q: string;
}) {
  const [items, setItems] = useState(initial);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadMore() {
    if (!cursor) return;
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams({ tab, cursor });
      if (q) p.set("q", q);
      const res = await fetch(`/api/registry?${p.toString()}`);
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { items: RegistryCard[]; nextCursor: string | null };
      setItems((prev) => [...prev, ...body.items]);
      setCursor(body.nextCursor);
    } catch {
      setError("Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  if (items.length === 0) {
    return <p className="text-neutral-600 dark:text-neutral-400">{q ? "No claimed titles match that search." : "No titles have been claimed yet."}</p>;
  }

  return (
    <div>
      <ul className="flex flex-col gap-3">
        {items.map((c) => (
          <li key={c.slug}>
            <RegistryCardView card={c} />
          </li>
        ))}
      </ul>
      {cursor && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loading}
          className="mt-4 w-full rounded-lg border border-neutral-300 px-4 py-3 text-base font-medium disabled:opacity-60 dark:border-neutral-700"
        >
          {loading ? "Loading…" : "Show more"}
        </button>
      )}
      {error && (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

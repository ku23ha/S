import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { RegistryList } from "@/components/RegistryList";
import { PRODUCT_NAME } from "@/lib/copy";
import { getDb } from "@/lib/db";
import { certificatePath, formatPrice, formatRegistryNo, fullTitle, toRegistryCard } from "@/lib/format";
import { listIconic, listRegistry } from "@/lib/queries";
import { TIER_PRICE_CENTS, normalizeTitleKey, toTitleDisplay } from "@/lib/titles";

export const metadata: Metadata = { title: `Registry · ${PRODUCT_NAME}` };

type SP = Promise<Record<string, string | string[] | undefined>>;
type Tab = "recent" | "iconic" | "lowest";

const TABS: { id: Tab; label: string }[] = [
  { id: "recent", label: "Recent" },
  { id: "iconic", label: "Iconic titles" },
  { id: "lowest", label: "Lowest numbers" },
];

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

async function IconicBoard() {
  const entries = await listIconic(await getDb());
  return (
    <ul className="flex flex-col gap-2">
      {entries.map((e) => {
        const display = e.holder?.titleDisplay ?? toTitleDisplay(e.titleKey);
        return (
          <li key={e.titleKey}>
            {e.holder ? (
              <Link
                href={certificatePath(e.holder.slug)}
                className="block rounded-xl border border-neutral-200 p-3 hover:border-neutral-400 dark:border-neutral-800"
              >
                <span className="font-semibold">{fullTitle(display)}</span>
                <span className="block text-sm text-neutral-600 [overflow-wrap:anywhere] dark:text-neutral-400">
                  {e.holder.status === "in_review"
                    ? "Taken · in review"
                    : `Taken by ${e.holder.recipientName} · ${formatRegistryNo(e.holder.registryNo)}`}
                </span>
              </Link>
            ) : (
              <Link
                href={`/claim?${new URLSearchParams({ title: display }).toString()}`}
                className="flex items-center justify-between rounded-xl border border-emerald-300 p-3 hover:border-emerald-500 dark:border-emerald-800"
              >
                <span>
                  <span className="font-semibold">{fullTitle(display)}</span>
                  <span className="block text-sm text-emerald-800 dark:text-emerald-300">Open</span>
                </span>
                <span>{formatPrice(TIER_PRICE_CENTS.iconic)}</span>
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}

async function RegistryBody({ searchParams }: { searchParams: SP }) {
  await connection();
  const sp = await searchParams;
  const tabParam = first(sp.tab);
  const tab: Tab = tabParam === "iconic" || tabParam === "lowest" ? tabParam : "recent";
  const qRaw = first(sp.q).slice(0, 200);
  const q = normalizeTitleKey(qRaw);

  return (
    <>
      <form action="/registry" method="get" role="search" className="flex gap-2">
        {tab !== "iconic" && <input type="hidden" name="tab" value={tab} />}
        <label htmlFor="registry-q" className="sr-only">
          Search the registry
        </label>
        <input
          id="registry-q"
          name="q"
          defaultValue={qRaw}
          placeholder="Search claimed titles"
          className="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-3 text-base dark:border-neutral-700 dark:bg-neutral-950"
        />
        <button type="submit" className="rounded-lg bg-neutral-900 px-4 text-base font-semibold text-white dark:bg-white dark:text-neutral-900">
          Search
        </button>
      </form>

      <nav aria-label="Registry views" className="mt-5 flex gap-2 overflow-x-auto">
        {TABS.map((t) => {
          const p = new URLSearchParams({ tab: t.id });
          if (q && t.id !== "iconic") p.set("q", qRaw);
          return (
            <Link
              key={t.id}
              href={`/registry?${p.toString()}`}
              aria-current={t.id === tab ? "page" : undefined}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${
                t.id === tab
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  : "border border-neutral-300 dark:border-neutral-700"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-5">
        {tab === "iconic" ? (
          <IconicBoard />
        ) : (
          <RegistryPage tab={tab} q={q} />
        )}
      </div>
    </>
  );
}

async function RegistryPage({ tab, q }: { tab: "recent" | "lowest"; q: string }) {
  const page = await listRegistry(await getDb(), { tab, q: q || null });
  return (
    <RegistryList
      key={`${tab}:${q}`}
      initial={page.items.map(toRegistryCard)}
      initialCursor={page.nextCursor}
      tab={tab}
      q={q}
    />
  );
}

export default function Registry({ searchParams }: { searchParams: SP }) {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8">
      <h1 className="text-2xl font-bold">The registry</h1>
      <p className="mt-1 text-neutral-600 dark:text-neutral-400">Every claimed title, and the iconic ones still open.</p>
      <div className="mt-5">
        <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-900" />}>
          <RegistryBody searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

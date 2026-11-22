import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { SearchBox } from "@/components/SearchBox";
import { RegistryCardView } from "@/components/RegistryList";
import { HEADLINE, HOW_IT_WORKS } from "@/lib/copy";
import { getDb } from "@/lib/db";
import { errorSummary } from "@/lib/log";
import { formatPrice, fullTitle, toRegistryCard } from "@/lib/format";
import { countClaimed, listIconic, listRegistry } from "@/lib/queries";
import { TIER_PRICE_CENTS, toTitleDisplay } from "@/lib/titles";

async function LatestClaims() {
  await connection();
  let page, total;
  try {
    const db = await getDb();
    [page, total] = await Promise.all([listRegistry(db, { tab: "recent", limit: 6 }), countClaimed(db)]);
  } catch (err) {
    // Database unreachable: keep the rest of the home page working.
    console.error("home latest claims failed", errorSummary(err));
    return null;
  }
  return (
    <section aria-labelledby="latest">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="latest" className="text-lg font-semibold">
          Latest claims
        </h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {total.toLocaleString("en-US")} {total === 1 ? "title" : "titles"} claimed
        </p>
      </div>
      {page.items.length === 0 ? (
        <p className="mt-3 text-neutral-600 dark:text-neutral-400">No titles have been claimed yet.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {page.items.map((h) => (
            <li key={h.id}>
              <RegistryCardView card={toRegistryCard(h)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

async function IconicTeaser() {
  await connection();
  let open;
  try {
    open = (await listIconic(await getDb())).filter((e) => !e.holder).slice(0, 3);
  } catch (err) {
    console.error("home iconic teaser failed", errorSummary(err));
    return null;
  }
  if (open.length === 0) return null;
  return (
    <section aria-labelledby="iconic">
      <h2 id="iconic" className="text-lg font-semibold">
        Iconic titles still open
      </h2>
      <ul className="mt-3 flex flex-col gap-2">
        {open.map((e) => {
          const display = toTitleDisplay(e.titleKey);
          return (
            <li key={e.titleKey}>
              <Link
                href={`/claim?${new URLSearchParams({ title: display }).toString()}`}
                className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 hover:border-neutral-400 dark:border-neutral-800"
              >
                <span>{fullTitle(display)}: open</span>
                <span className="text-neutral-600 dark:text-neutral-400">{formatPrice(TIER_PRICE_CENTS.iconic)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <Link href="/registry?tab=iconic" className="mt-2 inline-block text-sm underline underline-offset-4">
        See all iconic titles
      </Link>
    </section>
  );
}

function ListSkeleton() {
  return <div className="h-32 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-900" aria-hidden="true" />;
}

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-10 px-4 py-8">
      <header>
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{HEADLINE}</h1>
        <div className="mt-5">
          <SearchBox source="home" label="Search a World's Best title" />
        </div>
      </header>

      <Suspense fallback={<ListSkeleton />}>
        <LatestClaims />
      </Suspense>

      <Suspense fallback={<ListSkeleton />}>
        <IconicTeaser />
      </Suspense>

      <section aria-labelledby="how-it-works">
        <h2 id="how-it-works" className="text-lg font-semibold">
          How it works
        </h2>
        <ol className="mt-4 flex flex-col gap-4">
          {HOW_IT_WORKS.map((item, i) => (
            <li key={item.step} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-sm font-semibold text-white dark:bg-white dark:text-neutral-900">
                {i + 1}
              </span>
              <p className="text-base">
                <span className="font-semibold">{item.step}.</span> {item.text}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}

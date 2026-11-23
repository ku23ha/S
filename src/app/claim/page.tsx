import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ClaimForm } from "@/components/ClaimForm";
import { BeginCheckoutSignal } from "@/components/Marketing";
import { CURRENCY } from "@/lib/titles";
import { SearchBox } from "@/components/SearchBox";
import { checkTitle } from "@/lib/check";
import { getDb } from "@/lib/db";
import { certificatePath, formatPrice, fullTitle } from "@/lib/format";

export const metadata: Metadata = { title: `Claim a title` };

type SP = Promise<Record<string, string | string[] | undefined>>;

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

async function ClaimBody({ searchParams }: { searchParams: SP }) {
  await connection();
  const sp = await searchParams;
  const raw = first(sp.title).slice(0, 200);
  const ref = first(sp.ref).slice(0, 200) || undefined;

  if (!raw.trim()) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Which title?</h1>
        <div className="mt-4">
          <SearchBox source="claim" autoFocus refSlug={ref} />
        </div>
      </div>
    );
  }

  let result;
  try {
    result = await checkTitle(await getDb(), raw);
  } catch {
    return <p role="alert">Try again in a moment.</p>;
  }

  if (result.status !== "available") {
    const message =
      result.status === "not_allowed"
        ? result.message
        : result.status === "reserved"
          ? "Someone is claiming this right now; try again in 15 minutes."
          : null;
    return (
      <div>
        <h1 className="text-2xl font-bold">
          {result.status === "taken"
            ? "That title is taken"
            : result.status === "reserved"
              ? "That title can't be claimed right now"
              : "That title can't be claimed"}
        </h1>
        {result.status === "taken" ? (
          <p className="mt-2 [overflow-wrap:anywhere]">
            {fullTitle(result.title.display)} already has a holder.{" "}
            <Link
              href={certificatePath(result.holder.slug)}
              className="underline"
            >
              See the certificate
            </Link>
            .
          </p>
        ) : (
          <p className="mt-2">{message}</p>
        )}
        <div className="mt-6">
          <SearchBox source="claim" initialValue={raw} refSlug={ref} />
        </div>
      </div>
    );
  }

  const t = result.title;
  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gold-deep">
          Available ·{" "}
          {t.tier === "standard"
            ? "Standard"
            : t.tier === "popular"
              ? "Popular"
              : "Iconic"}{" "}
          title · {formatPrice(t.priceCents)}
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold leading-tight [overflow-wrap:anywhere] sm:text-4xl">
          World&apos;s Best {t.display}
        </h1>
        <p className="mt-2 text-ink-soft">
          Add their name and watch it appear on the certificate. Once it&apos;s
          claimed, no one else can hold this title.
        </p>
      </header>
      <BeginCheckoutSignal value={t.priceCents / 100} currency={CURRENCY} />
      <ClaimForm
        titleDisplay={t.display}
        basePriceCents={t.priceCents}
        tier={t.tier}
        refSlug={ref}
      />
    </div>
  );
}

export default function ClaimPage({ searchParams }: { searchParams: SP }) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <Suspense
        fallback={
          <div className="h-64 animate-pulse rounded-2xl bg-neutral-100 dark:bg-neutral-900" />
        }
      >
        <ClaimBody searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

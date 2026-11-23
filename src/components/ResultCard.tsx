"use client";

import Link from "next/link";
import type { CheckResult, CheckVariant } from "@/lib/check";
import { track } from "@/lib/analytics-client";
import type { Tier } from "@/lib/titles";
import { certificatePath, claimHref, formatDate, formatPrice, formatRegistryNo, fullTitle } from "@/lib/format";

export type SearchState =
  | { kind: "empty" }
  | { kind: "checking" }
  | { kind: "error"; message: string }
  | { kind: "result"; result: CheckResult };

/**
 * "Drop a hint": the person who wants a title sends it to someone who might
 * give it. Recipients appreciate gifts they asked for (Gino & Flynn 2011).
 */
function HintButton({ display }: { display: string }) {
  async function hint() {
    const url = `${window.location.origin}${claimHref(display)}`;
    const text = `Hint, hint: I'd love to be the ${fullTitle(display)}.`;
    track("share_clicked", { channel: "hint", slug: "" });
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ text, url });
        return;
      } catch {
        // Cancelled: fall through to nothing.
        return;
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, "_blank", "noopener,noreferrer");
  }
  return (
    <button type="button" onClick={hint} className="text-sm font-medium text-emerald-900 underline underline-offset-4 dark:text-emerald-200">
      Want it for yourself? Drop a hint
    </button>
  );
}

function Variants({
  variants,
  onPick,
  onPlace,
}: {
  variants: CheckVariant[];
  onPick: (display: string, tier: Tier) => void;
  onPlace: (prefix: string) => void;
}) {
  if (variants.length === 0) return null;
  return (
    <div className="mt-4">
      <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Free titles nearby</p>
      <ul className="mt-2 flex flex-col gap-2">
        {variants.map((v) =>
          v.kind === "place" ? (
            <li key="place">
              <button
                type="button"
                onClick={() => onPlace(v.displayPrefix)}
                className="w-full rounded-lg border border-dashed border-neutral-300 px-3 py-2 text-left text-base [overflow-wrap:anywhere] hover:border-neutral-500 dark:border-neutral-700"
              >
                {fullTitle(v.displayPrefix)}
                <span className="text-neutral-400">{v.placeholder}</span>
                <span className="block text-sm text-neutral-500">Add a place, like a town or a team</span>
              </button>
            </li>
          ) : (
            <li key={v.title.key}>
              <button
                type="button"
                onClick={() => onPick(v.title.display, v.title.tier)}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-neutral-300 px-3 py-2 text-left text-base hover:border-neutral-500 dark:border-neutral-700"
              >
                <span className="[overflow-wrap:anywhere]">{fullTitle(v.title.display)}</span>
                <span className="shrink-0 text-sm text-neutral-600 dark:text-neutral-400">
                  {formatPrice(v.title.priceCents)}
                </span>
              </button>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

export function ResultCard({
  state,
  refSlug,
  onPick,
  onPlace,
}: {
  state: SearchState;
  refSlug?: string;
  onPick: (display: string, tier: Tier) => void;
  onPlace: (prefix: string) => void;
}) {
  if (state.kind === "empty") return null;

  const box = "mt-3 rounded-xl border p-4";

  if (state.kind === "checking") {
    return (
      <div className={`${box} border-neutral-200 text-neutral-500 dark:border-neutral-800`} aria-live="polite">
        Checking…
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className={`${box} border-neutral-200 dark:border-neutral-800`} role="alert">
        {state.message}
      </div>
    );
  }

  const r = state.result;

  if (r.status === "not_allowed") {
    return (
      <div className={`${box} border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100`} role="alert">
        {r.message}
      </div>
    );
  }

  if (r.status === "available") {
    return (
      <div className={`${box} border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950`} aria-live="polite">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">Available</p>
        <p className="mt-1 text-xl font-semibold [overflow-wrap:anywhere]">{fullTitle(r.title.display)}</p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-lg">{formatPrice(r.title.priceCents)}</span>
          <Link
            href={claimHref(r.title.display, refSlug)}
            className="rounded-lg bg-neutral-900 px-5 py-3 text-base font-semibold text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900"
          >
            Claim it
          </Link>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-emerald-200 pt-3 dark:border-emerald-900">
          <span className="text-sm text-emerald-900 dark:text-emerald-200">One holder, ever. Once claimed, it&apos;s theirs for good.</span>
          <HintButton display={r.title.display} />
        </div>
      </div>
    );
  }

  if (r.status === "reserved") {
    return (
      <div className={`${box} border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950`} aria-live="polite">
        <p className="text-sm font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">Being claimed</p>
        <p className="mt-1 text-xl font-semibold [overflow-wrap:anywhere]">{fullTitle(r.title.display)}</p>
        <p className="mt-2 text-base">Someone is claiming this right now; try again in 15 minutes.</p>
        <Variants variants={r.variants} onPick={onPick} onPlace={onPlace} />
      </div>
    );
  }

  return (
    <div className={`${box} border-neutral-300 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900`} aria-live="polite">
      <p className="text-sm font-semibold uppercase tracking-wide text-neutral-600 dark:text-neutral-400">Taken</p>
      <p className="mt-1 text-xl font-semibold [overflow-wrap:anywhere]">{fullTitle(r.title.display)}</p>
      {r.holder.inReview ? (
        <p className="mt-2 text-base">Claimed and in review.</p>
      ) : (
        <p className="mt-2 text-base [overflow-wrap:anywhere]">
          Held by <span className="font-semibold">{r.holder.recipientName}</span>
          {r.holder.registryNo != null && <> · {formatRegistryNo(r.holder.registryNo)}</>}
          {r.holder.claimedAt && <> · since {formatDate(r.holder.claimedAt)}</>}
          <>
            {" "}
            ·{" "}
            <Link href={certificatePath(r.holder.slug)} className="underline">
              See certificate
            </Link>
          </>
        </p>
      )}
      <Variants variants={r.variants} onPick={onPick} onPlace={onPlace} />
    </div>
  );
}

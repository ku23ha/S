"use client";

import { useState, useSyncExternalStore } from "react";
import { certificatePath } from "@/lib/format";

const subscribeNoop = () => () => {};

/** Share a certificate: native share sheet where available, links and downloads otherwise. */
export function ShareBar({ slug, text, siteUrl }: { slug: string; text: string; siteUrl: string }) {
  const url = `${siteUrl}${certificatePath(slug)}`;
  const encodedSlug = encodeURIComponent(slug);
  const [copied, setCopied] = useState(false);
  const canNativeShare = useSyncExternalStore(
    subscribeNoop,
    () => typeof navigator !== "undefined" && typeof navigator.share === "function",
    () => false,
  );

  async function nativeShare() {
    try {
      await navigator.share({ title: text, text, url });
    } catch {
      // Cancelled or unsupported: nothing to do.
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link", url);
    }
  }

  const btn =
    "flex min-h-12 items-center justify-center rounded-lg border border-neutral-300 px-3 py-2 text-center text-sm font-medium hover:border-neutral-500 dark:border-neutral-700";

  return (
    <section aria-label="Share this certificate" className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        {canNativeShare ? (
          <button type="button" onClick={nativeShare} className={`${btn} col-span-2 bg-neutral-900 text-base text-white dark:bg-white dark:text-neutral-900`}>
            Share
          </button>
        ) : null}
        <button type="button" onClick={copy} className={btn} aria-live="polite">
          {copied ? "Link copied" : "Copy link"}
        </button>
        <a className={btn} href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`} target="_blank" rel="noopener noreferrer">
          WhatsApp
        </a>
        <a
          className={btn}
          href={`https://twitter.com/intent/tweet?${new URLSearchParams({ text, url }).toString()}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          X
        </a>
        <a
          className={btn}
          href={`https://www.linkedin.com/sharing/share-offsite/?${new URLSearchParams({ url }).toString()}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          LinkedIn
        </a>
        <a className={btn} href={`/c/${encodedSlug}/opengraph-image`} download="worlds-best.png">
          Download image
        </a>
        <a className={btn} href={`/api/cert/${encodedSlug}/story?download=1`} download="worlds-best-story.png">
          Download story
        </a>
      </div>
    </section>
  );
}

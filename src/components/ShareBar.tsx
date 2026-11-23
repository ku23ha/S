"use client";

import { useState, useSyncExternalStore } from "react";
import { TrackedDownload } from "@/components/Tracking";
import type { AnalyticsEvents } from "@/lib/analytics";
import { track } from "@/lib/analytics-client";
import { certificatePath } from "@/lib/format";

const subscribeNoop = () => () => {};

/** Share a certificate: native share sheet where available, links and downloads otherwise. */
export function ShareBar({
  slug,
  text,
  siteUrl,
  christmas = false,
}: {
  slug: string;
  text: string;
  siteUrl: string;
  /** Offer the Christmas card download (in season). */
  christmas?: boolean;
}) {
  const url = `${siteUrl}${certificatePath(slug)}`;
  const encodedSlug = encodeURIComponent(slug);
  const giftUrl = `${url}?gift=1`;
  const [copied, setCopied] = useState(false);
  const [giftCopied, setGiftCopied] = useState(false);
  const canNativeShare = useSyncExternalStore(
    subscribeNoop,
    () => typeof navigator !== "undefined" && typeof navigator.share === "function",
    () => false,
  );

  const shared = (channel: AnalyticsEvents["share_clicked"]["channel"]) => track("share_clicked", { channel, slug });

  async function nativeShare() {
    shared("native");
    try {
      await navigator.share({ title: text, text, url });
    } catch {
      // Cancelled or unsupported: nothing to do.
    }
  }

  async function copy() {
    shared("copy");
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link", url);
    }
  }

  async function copyGift() {
    shared("surprise_copy");
    try {
      await navigator.clipboard.writeText(giftUrl);
      setGiftCopied(true);
      setTimeout(() => setGiftCopied(false), 2000);
    } catch {
      window.prompt("Copy this link", giftUrl);
    }
  }

  const btn =
    "flex min-h-12 items-center justify-center rounded-lg border border-neutral-300 px-3 py-2 text-center text-sm font-medium hover:border-neutral-500 dark:border-neutral-700";

  return (
    <section aria-label="Share this certificate" className="flex flex-col gap-3">
      <div className="rounded-xl border border-gold/50 bg-[#fffaf0] p-4">
        <p className="font-semibold">Send it as a surprise</p>
        <p className="mt-1 text-sm text-ink-soft">They&apos;ll see a sealed envelope first, and open it themselves.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={copyGift} className={`${btn} border-gold bg-white`} aria-live="polite">
            {giftCopied ? "Surprise link copied" : "Copy surprise link"}
          </button>
          <a
            className={`${btn} border-gold bg-white`}
            href={`https://wa.me/?text=${encodeURIComponent(`I made you something. Open it: ${giftUrl}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => shared("surprise_whatsapp")}
          >
            WhatsApp it
          </a>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {canNativeShare ? (
          <button type="button" onClick={nativeShare} className={`${btn} col-span-2 bg-neutral-900 text-base text-white dark:bg-white dark:text-neutral-900`}>
            Share
          </button>
        ) : null}
        <button type="button" onClick={copy} className={btn} aria-live="polite">
          {copied ? "Link copied" : "Copy link"}
        </button>
        <a
          className={btn}
          href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => shared("whatsapp")}
        >
          WhatsApp
        </a>
        <a
          className={btn}
          href={`https://twitter.com/intent/tweet?${new URLSearchParams({ text, url }).toString()}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => shared("x")}
        >
          X
        </a>
        <a
          className={btn}
          href={`https://www.linkedin.com/sharing/share-offsite/?${new URLSearchParams({ url }).toString()}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => shared("linkedin")}
        >
          LinkedIn
        </a>
        <TrackedDownload kind="share_image" className={btn} href={`/c/${encodedSlug}/opengraph-image`} download="worlds-best.png">
          Download image
        </TrackedDownload>
        <TrackedDownload
          kind="story_image"
          className={btn}
          href={`/api/cert/${encodedSlug}/story?download=1`}
          download="worlds-best-story.png"
        >
          Download story
        </TrackedDownload>
        {christmas && (
          <TrackedDownload
            kind="christmas_card"
            className={`${btn} col-span-2 border-[#123528] bg-[#123528] text-[#fdf6e3] hover:border-[#e2b55a]`}
            href={`/api/cert/${encodedSlug}/card?download=1`}
            download="worlds-best-christmas-card.png"
          >
            Download the Christmas card
          </TrackedDownload>
        )}
      </div>
    </section>
  );
}

"use client";

import { usePathname } from "next/navigation";
import { type AnchorHTMLAttributes, useEffect } from "react";
import { type AnalyticsEvents, sanitizePath, sanitizeReferrer } from "@/lib/analytics";
import { track } from "@/lib/analytics-client";
import { getSessionRef } from "@/lib/session-ref";

/** page_view on every route change, with private parts of the path removed. */
export function PageViewTracker() {
  const pathname = usePathname();
  useEffect(() => {
    track("page_view", {
      path: sanitizePath(pathname),
      referrer: sanitizeReferrer(document.referrer, window.location.origin),
      ref_slug: getSessionRef(),
    });
  }, [pathname]);
  return null;
}

const OWNER_PREFIX = "wbr_owned:";

/** Marks this browser session as the buyer's, so their own views don't count. */
export function OwnerMark({ slug }: { slug: string }) {
  useEffect(() => {
    try {
      sessionStorage.setItem(`${OWNER_PREFIX}${slug}`, "1");
    } catch {
      // Storage blocked: the view may be counted; acceptable.
    }
  }, [slug]);
  return null;
}

function isOwnerSession(slug: string): boolean {
  try {
    return sessionStorage.getItem(`${OWNER_PREFIX}${slug}`) === "1";
  } catch {
    return false;
  }
}

/** certificate_viewed, plus the unique outside-view counter for loop metrics. */
export function CertificateViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    const owner = isOwnerSession(slug);
    track("certificate_viewed", {
      slug,
      is_owner_session: owner,
      referrer: sanitizeReferrer(document.referrer, window.location.origin),
    });
    if (!owner) {
      fetch(`/api/cert/${encodeURIComponent(slug)}/view`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner }),
        keepalive: true,
      }).catch(() => undefined);
    }
  }, [slug]);
  return null;
}

/** A download link that records download_clicked. */
export function TrackedDownload({
  kind,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { kind: AnalyticsEvents["download_clicked"]["kind"] }) {
  return <a {...props} onClick={() => track("download_clicked", { kind })} />;
}

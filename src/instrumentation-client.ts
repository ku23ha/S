/**
 * PostHog in the browser (posthog.com/docs/libraries/next-js, read 2026-11-22).
 * Privacy settings: no autocapture, no session recording, no person
 * profiles, session-only storage (no cookies), and every event's URLs are
 * scrubbed of manage tokens and query strings before sending.
 * Pageviews are sent as the custom page_view event by PageViewTracker.
 */
import posthog from "posthog-js";
import { sanitizePath, sanitizeReferrer } from "@/lib/analytics";

const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;

if (key) {
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    defaults: "2026-08-30",
    capture_pageview: false,
    capture_pageleave: false,
    autocapture: false,
    disable_session_recording: true,
    person_profiles: "never",
    persistence: "sessionStorage",
    before_send: (event) => {
      if (!event) return event;
      const p = event.properties ?? {};
      for (const k of ["$current_url", "$pathname"]) {
        if (typeof p[k] === "string") p[k] = sanitizePath(p[k] as string);
      }
      for (const k of ["$referrer", "$initial_referrer"]) {
        if (typeof p[k] === "string") p[k] = sanitizeReferrer(p[k] as string, window.location.origin);
      }
      return event;
    },
  });
}

/**
 * PostHog in the browser (posthog.com/docs/libraries/next-js, read 2026-11-22).
 * Privacy settings: no autocapture, no session recording, no person
 * profiles, session-only storage (no cookies), and every event's URLs are
 * scrubbed of manage tokens and query strings before sending.
 * Pageviews are sent as the custom page_view event by PageViewTracker.
 */
import posthog from "posthog-js";
import { scrubEventProperties } from "@/lib/analytics";

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
      if (event.properties) scrubEventProperties(event.properties, window.location.origin);
      for (const k of ["$set", "$set_once"] as const) {
        const nested = (event as unknown as Record<string, unknown>)[k];
        if (nested && typeof nested === "object") scrubEventProperties(nested as Record<string, unknown>, window.location.origin);
      }
      return event;
    },
  });
}

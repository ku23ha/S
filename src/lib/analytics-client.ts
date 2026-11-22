"use client";

/**
 * Browser analytics through posthog-js, initialised in
 * instrumentation-client.ts. Without NEXT_PUBLIC_POSTHOG_KEY nothing is sent.
 */
import posthog from "posthog-js";
import type { AnalyticsEventName, AnalyticsEvents } from "@/lib/analytics";

export function analyticsEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);
}

export function track<E extends AnalyticsEventName>(event: E, properties: AnalyticsEvents[E]): void {
  if (!analyticsEnabled()) return;
  try {
    posthog.capture(event, properties);
  } catch {
    // Analytics must never break the page.
  }
}

/** Anonymous id of this browser session, sent with checkout to join server events. */
export function analyticsId(): string | undefined {
  if (!analyticsEnabled()) return undefined;
  try {
    return posthog.get_distinct_id() || undefined;
  } catch {
    return undefined;
  }
}

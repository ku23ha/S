/**
 * Server-side analytics through posthog-node (posthog.com/docs/libraries/node,
 * read 2026-11-22). captureImmediate is awaited so the event is sent before a
 * serverless function returns. Events carry no personal data and never
 * create person profiles. Failures are logged and swallowed.
 */
import type { AnalyticsEventName, AnalyticsEvents } from "@/lib/analytics";
import { errorSummary } from "@/lib/log";

export interface CapturedEvent {
  distinctId: string;
  event: AnalyticsEventName;
  properties: Record<string, unknown>;
}

type Sink = (e: CapturedEvent) => Promise<void>;
let testSink: Sink | undefined;

/** Tests only: receive events instead of sending them. */
export function setAnalyticsSinkForTests(sink: Sink | undefined): void {
  testSink = sink;
}

type Client = { captureImmediate: (m: { distinctId: string; event: string; properties: Record<string, unknown>; options: { process_person_profile: boolean } }) => Promise<void> };
let clientPromise: Promise<Client | null> | null = null;

function getClient(): Promise<Client | null> {
  clientPromise ??= (async () => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    // ANALYTICS_SERVER_DISABLED=1 lets end-to-end runs test browser events without server sends.
    if (!key || process.env.ANALYTICS_SERVER_DISABLED === "1") return null;
    const { PostHog } = await import("posthog-node");
    return new PostHog(key, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    }) as unknown as Client;
  })();
  return clientPromise;
}

export async function trackServer<E extends AnalyticsEventName>(
  distinctId: string,
  event: E,
  properties: AnalyticsEvents[E],
): Promise<void> {
  const props = { ...properties } as Record<string, unknown>;
  try {
    if (testSink) return await testSink({ distinctId, event, properties: props });
    const client = await getClient();
    if (!client) return;
    await client.captureImmediate({ distinctId, event, properties: props, options: { process_person_profile: false } });
  } catch (err) {
    console.error(`analytics ${event} failed`, errorSummary(err));
  }
}

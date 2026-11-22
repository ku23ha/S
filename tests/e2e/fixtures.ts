import { gunzipSync } from "node:zlib";
import { type BrowserContext, type Request, test as base } from "@playwright/test";

export type Captured = { event: string; properties: Record<string, unknown> };

/** Decode a posthog-js request body (plain, gzip or base64 form) into events. */
export function decodePosthog(req: Request): Captured[] {
  const buf = req.postDataBuffer();
  if (!buf || buf.length === 0) return [];
  let text: string;
  try {
    text = gunzipSync(buf).toString("utf8");
  } catch {
    text = buf.toString("utf8");
  }
  if (text.startsWith("data=")) text = Buffer.from(decodeURIComponent(text.slice(5)), "base64").toString("utf8");
  try {
    const parsed: unknown = JSON.parse(text);
    const list = Array.isArray(parsed)
      ? parsed
      : typeof parsed === "object" && parsed && "batch" in parsed
        ? (parsed as { batch: unknown[] }).batch
        : [parsed];
    return list.filter((e): e is Captured => !!e && typeof e === "object" && "event" in e);
  } catch {
    return [];
  }
}

/** Intercept every PostHog request in a context; nothing reaches the network. */
export const posthogRequests: string[] = [];

export async function interceptPosthog(context: BrowserContext): Promise<Captured[]> {
  const events: Captured[] = [];
  // posthog-js treats automated browsers (navigator.webdriver) as bots and drops
  // their events. Test browsers only; the production bot filter is unchanged.
  await context.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "webdriver", { get: () => false });
  });
  await context.route(/^https:\/\/[^/]*posthog\.com\//, async (route) => {
    const req = route.request();
    posthogRequests.push(`${req.method()} ${req.url()} ${req.postDataBuffer()?.length ?? 0}b`);
    events.push(...decodePosthog(req));
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  return events;
}

export const test = base.extend<{ analytics: Captured[] }>({
  analytics: [
    async ({ context }, use) => {
      await use(await interceptPosthog(context));
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";

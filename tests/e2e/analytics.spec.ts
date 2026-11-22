import { E2E_USER_AGENT } from "../../playwright.config";
import { type Captured, expect, interceptPosthog, posthogRequests, test } from "./fixtures";

/**
 * Browser analytics: every client event in docs/API.md is sent with its
 * properties, and nothing personal or private goes with it. PostHog points at
 * a fake host (playwright.config.ts) and every request is intercepted.
 * checkout_started and claim_completed are server events, covered in
 * tests/admin.test.ts.
 *
 * posthog-js batches events and flushes queued ones with sendBeacon on a full
 * page navigation, which Playwright can't intercept, so the test waits for
 * each event to arrive before navigating away.
 */

test.afterEach(({}, info) => {
  if (info.status !== info.expectedStatus) console.log("PostHog requests:\n" + posthogRequests.join("\n"));
});

async function waitFor(events: Captured[], name: string, match: Record<string, unknown> = {}): Promise<Captured> {
  const find = () =>
    events.find((e) => e.event === name && Object.entries(match).every(([k, v]) => e.properties[k] === v));
  await expect.poll(find, { timeout: 20_000, message: `event ${name} ${JSON.stringify(match)}` }).toBeTruthy();
  return find()!;
}

test("browser events carry their properties and nothing private", async ({ page, analytics, browser, baseURL }) => {
  const suffix = Date.now().toString(36).replace(/\d/g, "");
  const title = `Sky Painter ${suffix}`.slice(0, 30).trim();
  const slug = title.toLowerCase().replace(/ /g, "-");

  // Buyer: home page view and an available search.
  await page.goto("/");
  expect((await waitFor(analytics, "page_view", { path: "/" })).properties).toMatchObject({ referrer: null, ref_slug: null });
  await page.getByRole("textbox", { name: /search a world's best title/i }).fill(title);
  await expect(page.getByText("Available", { exact: true })).toBeVisible();
  expect((await waitFor(analytics, "title_searched")).properties).toMatchObject({ result: "available", tier: "standard", source: "home" });

  // Claim form opens.
  await page.getByRole("link", { name: "Claim it" }).click();
  expect((await waitFor(analytics, "claim_started")).properties).toMatchObject({ tier: "standard", price_cents: 500, ref_slug: null });
  await page.getByLabel("Who is it for?").fill("Private Person");
  await page.getByLabel(/^Dedication/).fill("secret dedication words");
  await page.getByLabel("Your email").fill("private-buyer@example.test");
  await page.getByRole("button", { name: /^Pay / }).click();
  await page.getByRole("button", { name: "Simulate successful payment" }).click();
  await expect(page.getByRole("heading", { name: "It's theirs" })).toBeVisible();
  await waitFor(analytics, "page_view", { path: "/success" });

  // A new visitor (fresh session) lands on the certificate.
  const visitor = await browser.newContext({ viewport: { width: 375, height: 812 }, baseURL, userAgent: E2E_USER_AGENT });
  const vevents = await interceptPosthog(visitor);
  const vpage = await visitor.newPage();
  vpage.on("dialog", (d) => d.dismiss());
  await vpage.goto(`/c/${slug}`);
  expect((await waitFor(vevents, "page_view")).properties).toMatchObject({ path: `/c/${slug}`, ref_slug: slug });
  expect((await waitFor(vevents, "certificate_viewed")).properties).toMatchObject({ slug, is_owner_session: false });

  await vpage.getByRole("button", { name: "Copy link" }).click();
  expect((await waitFor(vevents, "share_clicked")).properties).toMatchObject({ channel: "copy", slug });

  const download = vpage.waitForEvent("download");
  await vpage.getByRole("link", { name: "Download image" }).click();
  await (await download).cancel();
  expect((await waitFor(vevents, "download_clicked")).properties).toMatchObject({ kind: "share_image" });

  await vpage.getByRole("textbox", { name: /search your own/i }).fill(title);
  await expect(vpage.getByText("Taken", { exact: true }).filter({ visible: true })).toBeVisible();
  expect((await waitFor(vevents, "title_searched", { result: "taken" })).properties).toMatchObject({ source: "certificate" });

  await vpage.getByRole("button", { name: new RegExp(`${title} Ever`, "i") }).click();
  expect((await waitFor(vevents, "variant_clicked")).properties).toMatchObject({ tier: "standard" });

  await vpage.getByRole("link", { name: "Report this page" }).click();
  await vpage.getByLabel("It's spam or advertising").check();
  await vpage.getByRole("button", { name: "Send report" }).click();
  await expect(vpage.getByText(/Thank you/)).toBeVisible();
  expect((await waitFor(vevents, "report_submitted")).properties).toMatchObject({ slug });

  // Nothing private in any payload, including PostHog's own URL properties.
  const all = JSON.stringify([...analytics, ...vevents]);
  for (const secret of ["Private Person", "secret dedication", "private-buyer", "success?id", "/success?"]) {
    expect(all, secret).not.toContain(secret);
  }

  await visitor.close();
});

import { expect, test } from "./fixtures";

const DISCLAIMER = "A novelty registry for fun and affection. Titles have no legal or official status.";

/**
 * The full claim at 375 px: search, claim form, the local test checkout,
 * the signed webhook, the success page, the public certificate, its share
 * image, and the title showing as taken. Fails on any browser console error.
 */
test("a visitor claims a free title and the recipient gets a certificate", async ({ page, request }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));

  const suffix = Date.now().toString(36).replace(/\d/g, "");
  const title = `Kite Flyer ${suffix}`.slice(0, 30).trim();

  // Home: search shows the title as available with its price.
  await page.goto("/");
  await expect(page.locator("footer").getByText(DISCLAIMER)).toBeVisible();
  await page.getByRole("textbox", { name: /search a world's best title/i }).fill(title);
  const result = page.getByText("Available", { exact: true });
  await expect(result).toBeVisible();
  await expect(page.locator("[aria-live=polite]").getByText("$5", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Claim it" }).click();

  // Claim form.
  await expect(page).toHaveURL(/\/claim\?title=/);
  await page.getByLabel("Who is it for?").fill("मीरा");
  await page.getByLabel(/^From/).fill("Ravi");
  await page.getByLabel(/^Dedication/).fill("For the highest kites 🪁");
  await page.getByLabel("Your email").fill("e2e-buyer@example.test");
  await page.getByRole("button", { name: "Pay $5" }).click();

  // Local stand-in for the hosted checkout.
  await expect(page).toHaveURL(/\/dev\/checkout\?/);
  await page.getByRole("button", { name: "Simulate successful payment" }).click();

  // Success page shows the claimed certificate.
  await expect(page).toHaveURL(/\/success\?id=/);
  await expect(page.getByRole("heading", { name: "It's theirs" })).toBeVisible();
  await expect(page.getByText("मीरा").first()).toBeVisible();
  // The registry number is on the gold seal.
  await expect(page.getByRole("img", { name: /Registry number 0000\d\d/ }).first()).toBeVisible();

  // Public certificate page.
  await page.getByRole("link", { name: "Open the certificate page" }).click();
  await expect(page).toHaveURL(/\/c\/kite-flyer-/);
  // Next keeps the previous route mounted but hidden, so match visible elements only.
  await expect(page.getByRole("heading", { level: 1 }).filter({ visible: true })).toContainText("Kite Flyer");
  await expect(page.getByText("For the highest kites").filter({ visible: true })).toBeVisible();
  await expect(page.locator("footer").getByText(DISCLAIMER)).toBeVisible();
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(375);

  // Share image is a 1200x630 PNG.
  const ogUrl = await page.locator('meta[property="og:image"]').getAttribute("content");
  expect(ogUrl).toBeTruthy();
  const og = await request.get(new URL(ogUrl!).pathname + new URL(ogUrl!).search);
  expect(og.status()).toBe(200);
  expect(og.headers()["content-type"]).toBe("image/png");
  const png = await og.body();
  expect(png.readUInt32BE(16)).toBe(1200);
  expect(png.readUInt32BE(20)).toBe(630);

  // The certificate's own search box now reports the title as taken.
  const box = page.getByRole("textbox", { name: /search your own/i });
  await box.fill(title);
  await expect(page.getByText("Taken", { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(page.getByText(/Held by/).filter({ visible: true })).toContainText("मीरा");

  expect(errors, errors.join("\n")).toEqual([]);
});

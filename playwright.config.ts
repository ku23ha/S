import { defineConfig, devices } from "@playwright/test";

const PORT = 3200;
export const E2E_USER_AGENT =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36";
const DB_DIR = "node_modules/.cache/wbr-e2e";

/**
 * One end-to-end test of the full claim, run against `next dev` with a fresh
 * local database and the development payment stub (no real money, no keys).
 * Locally it drives the installed Chrome; set PW_CHANNEL="" to use
 * Playwright's own Chromium (`npx playwright install chromium`), as CI does.
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: process.env.PW_CHANNEL ?? (process.env.CI ? undefined : "chrome"),
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "mobile-375",
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 375, height: 812 },
        channel: process.env.PW_CHANNEL ?? (process.env.CI ? undefined : "chrome"),
        // posthog-js drops events from user agents that look like bots, and headless Chrome's does.
        userAgent: E2E_USER_AGENT,
      },
    },
  ],
  webServer: {
    // Start from an empty local database every run, before the server opens it.
    command: `node -e "require('fs').rmSync('${DB_DIR}',{recursive:true,force:true})" && npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      LOCAL_DB_DIR: DB_DIR,
      NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
      PAYMENTS_PROVIDER: "stub",
      DATABASE_URL: "",
      DODO_API_KEY: "",
      RESEND_API_KEY: "",
      // Browser analytics go to a fake PostHog host that the tests intercept; nothing leaves the machine.
      NEXT_PUBLIC_POSTHOG_KEY: "phc_e2e_test",
      NEXT_PUBLIC_POSTHOG_HOST: "https://e2e-test.i.posthog.com",
      ANALYTICS_SERVER_DISABLED: "1",
    },
  },
});

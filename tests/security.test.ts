import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import nextConfig from "../next.config";
import { reviewQueue } from "@/lib/admin";
import { DISCLAIMER } from "@/lib/copy";
import { getDb, setDbForTests } from "@/lib/db";
import { claimEmail, getEmailSender, refundEmail } from "@/lib/email";
import { errorSummary } from "@/lib/log";
import { getPaymentProvider, setPaymentProviderForTests } from "@/lib/payments/index";
import { freshTestDb, insertTitle } from "./helpers/db";

const SRC = path.resolve(__dirname, "..", "src");

afterEach(() => {
  vi.unstubAllEnvs();
  setDbForTests(undefined);
  setPaymentProviderForTests(undefined);
});

describe("production safety", () => {
  it("never falls back to the payment stub, local database or dev email in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DODO_API_KEY", "");
    vi.stubEnv("DODO_WEBHOOK_SECRET", "");
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("RESEND_API_KEY", "");
    setPaymentProviderForTests(undefined);
    setDbForTests(undefined);
    await expect(getPaymentProvider()).rejects.toThrow(/not configured/);
    await expect(getDb()).rejects.toThrow(/DATABASE_URL/);
    expect(() => getEmailSender()).toThrow(/not configured/);
  });

  it("guards the local test checkout page with the stub check", () => {
    const page = readFileSync(path.join(SRC, "app", "dev", "checkout", "page.tsx"), "utf8");
    expect(page).toMatch(/NODE_ENV === "production"\) return false/);
    expect(page.match(/stubActive\(\)/g)?.length).toBeGreaterThanOrEqual(2);
  });
});

describe("security headers", () => {
  it("sends a content security policy and standard headers on every path", async () => {
    const rules = await nextConfig.headers!();
    expect(rules[0].source).toBe("/:path*");
    const h = Object.fromEntries(rules[0].headers.map((x) => [x.key, x.value]));
    expect(h["Content-Security-Policy"]).toContain("default-src 'self'");
    expect(h["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(h["Content-Security-Policy"]).toContain("object-src 'none'");
    expect(h["Content-Security-Policy"]).toContain("connect-src 'self' https://*.posthog.com");
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(nextConfig.poweredByHeader).toBe(false);
  });
});

describe("logging", () => {
  it("redacts email addresses and long tokens from error text", () => {
    const s = errorSummary(new Error("Invalid customer buyer@example.test with token _mL_j2CCACisYNv0TqXE54NPAyz_ITHQ01f4pXDR-O8"));
    expect(s).toBe("Error: Invalid customer [email] with token [token]");
    expect(errorSummary("word ".repeat(200)).length).toBe(300);
  });
});

describe("disclaimer on every image and email", () => {
  it("draws the disclaimer on certificate and fallback images", () => {
    const src = readFileSync(path.join(SRC, "lib", "cert-image.tsx"), "utf8");
    const certificate = src.slice(src.indexOf("function Certificate("), src.indexOf("function Fallback("));
    const fallback = src.slice(src.indexOf("function Fallback("), src.indexOf("async function toPng("));
    expect(certificate).toContain("{DISCLAIMER}");
    expect(fallback).toContain("{DISCLAIMER}");
  });

  it("puts the disclaimer in both emails, html and text", () => {
    const claim = claimEmail({
      to: "a@example.test",
      titleId: "t",
      titleDisplay: "Dad",
      recipientName: "<b>Sam</b>",
      registryNo: 1,
      certificateUrl: "https://x.test/c/dad",
      manageUrl: "https://x.test/manage/abc",
      inReview: false,
    });
    const refund = refundEmail({ to: "a@example.test", titleId: "t", titleDisplay: "Dad", variants: [], searchUrl: "https://x.test/" });
    for (const e of [claim, refund]) {
      expect(e.html).toContain(DISCLAIMER);
      expect(e.text).toContain(DISCLAIMER);
    }
    expect(claim.html).toContain("&lt;b&gt;Sam&lt;/b&gt;");
    expect(claim.html).not.toContain("<b>Sam</b>");
  });
});

describe("copy rules across user-facing code", () => {
  it("never uses official, legal, certified or accredited outside the disclaimer", () => {
    const files = [
      "lib/copy.ts",
      "lib/email.ts",
      "lib/cert-image.tsx",
      "lib/titles.ts",
      "lib/claim.ts",
      "lib/reports.ts",
      "lib/check.ts",
      "lib/checkout.ts",
      "lib/manage.ts",
      "lib/format.ts",
    ];
    const offenders = files.filter((f) => {
      const text = readFileSync(path.join(SRC, f), "utf8")
        .split(DISCLAIMER)
        .join("")
        .replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ""); // comments aren't user-facing
      return /\b(official|legal|certified|accredited)\b/i.test(text);
    });
    expect(offenders).toEqual([]);
  });
});

describe("review queue", () => {
  it("lists a flagged entry with its reasons", async () => {
    const { db } = await freshTestDb();
    const t = await insertTitle(db, { key: "chef", status: "in_review" });
    await db.query(`update titles set dedication = 'call 555 123 4567' where id = $1`, [t.id]);
    const queue = await reviewQueue(db);
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ id: t.id, status: "in_review", flags: ["dedication: contact detail"] });
  });
});

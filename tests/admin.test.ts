import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST as loginPOST } from "@/app/api/admin/login/route";
import { POST as dismissPOST } from "@/app/api/admin/reports/[id]/dismiss/route";
import { GET as statsGET } from "@/app/api/admin/stats/route";
import { POST as actionPOST } from "@/app/api/admin/titles/[id]/[action]/route";
import { POST as viewPOST } from "@/app/api/cert/[slug]/view/route";
import { POST as checkoutPOST } from "@/app/api/checkout/route";
import { POST as reportPOST } from "@/app/api/report/route";
import { GET as checkGET } from "@/app/api/titles/check/route";
import { POST as webhookPOST } from "@/app/api/webhooks/payments/route";
import { dailyStats } from "@/lib/admin";
import { createSessionValue, hashPassword, verifyPassword, verifySessionValue } from "@/lib/admin-auth";
import { sanitizePath, sanitizeReferrer, scrubEventProperties } from "@/lib/analytics";
import { type CapturedEvent, setAnalyticsSinkForTests } from "@/lib/analytics-server";
import { type Db, setDbForTests } from "@/lib/db";
import { setEmailSenderForTests } from "@/lib/email";
import { parseDodoWebhook } from "@/lib/payments/dodo";
import { type PaymentProvider, setPaymentProviderForTests } from "@/lib/payments/index";
import { signStubEvent } from "@/lib/payments/stub";
import { freshTestDb, insertTitle } from "./helpers/db";

const ORIGIN = "http://test";
const SECRET = "whsec_dGVzdC1zZWNyZXQtZm9yLXdlYmhvb2stdGVzdHMtMDA=";
const PASSWORD = "correct horse battery staple";
let passwordHash = "";

let db: Db;
let refunds: string[];
let failRefund: boolean;
let events: CapturedEvent[];

beforeAll(async () => {
  passwordHash = await hashPassword(PASSWORD, 1024);
});

beforeEach(async () => {
  ({ db } = await freshTestDb());
  refunds = [];
  failRefund = false;
  events = [];
  let n = 0;
  const provider: PaymentProvider = {
    name: "test",
    async createCheckout() {
      n += 1;
      return { checkoutId: `cks_${n}`, checkoutUrl: `https://pay.example.test/${n}` };
    },
    parseWebhook: (raw, headers) => parseDodoWebhook(SECRET, raw, headers),
    async refund(paymentId) {
      if (failRefund) throw new Error("refund failed");
      refunds.push(paymentId);
    },
  };
  setPaymentProviderForTests(provider);
  setEmailSenderForTests({ send: async () => undefined });
  setAnalyticsSinkForTests(async (e) => void events.push(e));
  process.env.NEXT_PUBLIC_SITE_URL = ORIGIN;
  process.env.SESSION_SECRET = "s".repeat(40);
  process.env.ADMIN_PASSWORD_HASH = passwordHash;
});

afterEach(() => {
  setDbForTests(undefined);
  setPaymentProviderForTests(undefined);
  setEmailSenderForTests(undefined);
  setAnalyticsSinkForTests(undefined);
});

const json = (body: unknown, headers: Record<string, string> = {}) => ({
  method: "POST",
  headers: { "content-type": "application/json", origin: ORIGIN, ...headers },
  body: JSON.stringify(body),
});

function adminCookie(): Record<string, string> {
  return { cookie: `wbr_admin=${createSessionValue()}` };
}

const login = (password: string, ip = "1.1.1.1") =>
  loginPOST(new Request(`${ORIGIN}/api/admin/login`, json({ password }, { "x-forwarded-for": ip })));

const action = (id: string, act: string, body: unknown, headers = adminCookie()) =>
  actionPOST(new Request(`${ORIGIN}/api/admin/titles/${id}/${act}`, json(body, headers)), {
    params: Promise.resolve({ id, action: act }),
  });

const report = (body: unknown, ip = "2.2.2.2") => reportPOST(new Request(`${ORIGIN}/api/report`, json(body, { "x-forwarded-for": ip })));

async function status(id: string) {
  const r = await db.query<{ status: string; registry_no: number | null; removal_reason: string | null }>(
    `select status, registry_no::int as registry_no, removal_reason from titles where id = $1`,
    [id],
  );
  return r[0];
}

describe("rate limits", () => {
  it("allows 60 searches a minute per IP and refuses the 61st with Retry-After", async () => {
    const req = () => checkGET(new Request(`${ORIGIN}/api/titles/check?q=dad`, { headers: { "x-forwarded-for": "9.9.9.9" } }));
    for (let i = 0; i < 60; i++) expect((await req()).status).toBe(200);
    const res = await req();
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
    const other = await checkGET(new Request(`${ORIGIN}/api/titles/check?q=dad`, { headers: { "x-forwarded-for": "8.8.8.8" } }));
    expect(other.status).toBe(200);
  });

  it("allows 5 checkouts an hour per IP", async () => {
    const start = (i: number) =>
      checkoutPOST(
        new Request(
          `${ORIGIN}/api/checkout`,
          json({ title: `Title ${"abcdef"[i]}x`, recipientName: "A", email: `b${i}@example.test` }, { "x-forwarded-for": "7.7.7.7" }),
        ),
      );
    for (let i = 0; i < 5; i++) expect((await start(i)).status).toBe(200);
    expect((await start(5)).status).toBe(429);
  });

  it("allows 5 reports an hour per IP", async () => {
    await insertTitle(db, { key: "chef", status: "claimed" });
    for (let i = 0; i < 5; i++) expect((await report({ slug: "chef", reason: "spam" }, "6.6.6.6")).status).toBe(200);
    expect((await report({ slug: "chef", reason: "spam" }, "6.6.6.6")).status).toBe(429);
  });

  it("stores hashed IPs, never raw ones", async () => {
    await checkGET(new Request(`${ORIGIN}/api/titles/check?q=dad`, { headers: { "x-forwarded-for": "203.0.113.7" } }));
    const rows = await db.query<{ bucket: string }>(`select bucket from rate_limits`);
    expect(rows.length).toBe(1);
    expect(rows[0].bucket).toMatch(/^search:[\w-]{22}$/);
    expect(rows[0].bucket).not.toContain("203.0.113.7");
  });
});

describe("reports and moderation rules", () => {
  it("records a report and 404s for unknown certificates", async () => {
    const t = await insertTitle(db, { key: "chef", status: "claimed" });
    expect((await report({ slug: "chef", reason: "offensive", details: "rude" })).status).toBe(200);
    const r = await db.query<{ reason: string }>(`select reason from reports where title_id = $1`, [t.id]);
    expect(r[0].reason).toBe("offensive: rude");
    expect((await report({ slug: "nope", reason: "spam" })).status).toBe(404);
    expect((await report({ slug: "chef", reason: "bogus" })).status).toBe(400);
  });

  it("hides a page at once when the person named reports it", async () => {
    const t = await insertTitle(db, { key: "chef", status: "claimed" });
    await report({ slug: "chef", reason: "about_me" });
    expect((await status(t.id)).status).toBe("in_review");
  });

  it("hides a page after three open reports", async () => {
    const t = await insertTitle(db, { key: "chef", status: "claimed" });
    await report({ slug: "chef", reason: "spam" }, "1.0.0.1");
    await report({ slug: "chef", reason: "spam" }, "1.0.0.2");
    expect((await status(t.id)).status).toBe("claimed");
    await report({ slug: "chef", reason: "other" }, "1.0.0.3");
    expect((await status(t.id)).status).toBe("in_review");
  });
});

describe("admin login", () => {
  it("hashes and verifies passwords", async () => {
    expect(passwordHash).toMatch(/^scrypt\$1024\$8\$1\$/);
    expect(await verifyPassword(PASSWORD, passwordHash)).toBe(true);
    expect(await verifyPassword("wrong", passwordHash)).toBe(false);
    expect(await verifyPassword(PASSWORD, "garbage")).toBe(false);
  });

  it("signs sessions and rejects tampered or expired ones", () => {
    const v = createSessionValue();
    expect(verifySessionValue(v)).toBe(true);
    expect(verifySessionValue(`${v}x`)).toBe(false);
    expect(verifySessionValue(v.replace(/^\d+/, "9999999999"))).toBe(false);
    expect(verifySessionValue(createSessionValue(Date.now() - 13 * 3600 * 1000))).toBe(false);
  });

  it("sets an httpOnly, SameSite=Strict cookie on the right password", async () => {
    const res = await login(PASSWORD);
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(/^wbr_admin=\d+\.[\w-]+; Path=\/; HttpOnly; SameSite=Strict; Max-Age=43200/);
  });

  it("locks out the sixth attempt after five failures, even with the right password", async () => {
    for (let i = 0; i < 5; i++) expect((await login("nope", "5.5.5.5")).status).toBe(401);
    const sixth = await login(PASSWORD, "5.5.5.5");
    expect(sixth.status).toBe(429);
    expect(sixth.headers.get("set-cookie")).toBeNull();
    expect((await login(PASSWORD, "4.4.4.4")).status).toBe(200);
  });

  it("refuses logins from another origin and when admin isn't configured", async () => {
    const cross = await loginPOST(new Request(`${ORIGIN}/api/admin/login`, json({ password: PASSWORD }, { origin: "https://evil.example" })));
    expect(cross.status).toBe(403);
    delete process.env.ADMIN_PASSWORD_HASH;
    expect((await login(PASSWORD)).status).toBe(503);
  });

  it("protects admin routes", async () => {
    const t = await insertTitle(db, { key: "chef", status: "in_review" });
    expect((await action(t.id, "approve", {}, {})).status).toBe(401);
    expect((await action(t.id, "approve", {}, { ...adminCookie(), origin: "https://evil.example" })).status).toBe(403);
    expect((await statsGET(new Request(`${ORIGIN}/api/admin/stats`))).status).toBe(401);
  });
});

describe("admin actions", () => {
  async function paid(key: string, st: "claimed" | "in_review" = "in_review") {
    const t = await insertTitle(db, { key, status: st });
    await db.query(`update titles set payment_id = $2 where id = $1`, [t.id, `pay_${key}`]);
    return t;
  }

  it("approves an entry in review", async () => {
    const t = await paid("chef");
    expect((await action(t.id, "approve", {})).status).toBe(200);
    expect((await status(t.id)).status).toBe("claimed");
    expect((await action(t.id, "approve", {})).status).toBe(409);
  });

  it("rejects with a refund and frees the title", async () => {
    const t = await paid("chef");
    expect((await action(t.id, "reject", {})).status).toBe(400);
    expect((await action(t.id, "reject", { reason: "insulting" })).status).toBe(200);
    expect(refunds).toEqual(["pay_chef"]);
    expect(await status(t.id)).toMatchObject({ status: "rejected", removal_reason: "insulting" });
    await insertTitle(db, { key: "chef", status: "reserved" });
  });

  it("removes a published certificate: title freed, number retired, reports resolved", async () => {
    const t = await paid("chef", "claimed");
    await report({ slug: "chef", reason: "spam" });
    expect((await action(t.id, "remove", { reason: "named person asked", refund: true })).status).toBe(200);
    expect(await status(t.id)).toMatchObject({ status: "removed", registry_no: 1 });
    expect(refunds).toEqual(["pay_chef"]);
    const open = await db.query(`select 1 from reports where not resolved`);
    expect(open).toHaveLength(0);
    const again = await insertTitle(db, { key: "chef", status: "claimed" });
    expect(again.registry_no).toBe(2);
  });

  it("can remove without a refund", async () => {
    const t = await paid("chef", "claimed");
    await action(t.id, "remove", { reason: "test", refund: false });
    expect(refunds).toEqual([]);
    expect((await status(t.id)).status).toBe("removed");
  });

  it("changes nothing when the refund fails", async () => {
    const t = await paid("chef");
    failRefund = true;
    const res = await action(t.id, "reject", { reason: "x" });
    expect(res.status).toBe(502);
    expect((await status(t.id)).status).toBe("in_review");
  });

  it("keeps a rejected entry rejected when the refund webhook arrives", async () => {
    const t = await paid("chef");
    await action(t.id, "reject", { reason: "x" });
    const body = JSON.stringify({ business_id: "b", type: "refund.succeeded", timestamp: "", data: { payment_id: "pay_chef" } });
    await webhookPOST(new Request(`${ORIGIN}/api/webhooks/payments`, { method: "POST", headers: signStubEvent(body, SECRET), body }));
    expect((await status(t.id)).status).toBe("rejected");
  });

  it("dismisses a report", async () => {
    await insertTitle(db, { key: "chef", status: "claimed" });
    await report({ slug: "chef", reason: "spam" });
    const r = await db.query<{ id: string }>(`select id from reports`);
    const res = await dismissPOST(new Request(`${ORIGIN}/api/admin/reports/${r[0].id}/dismiss`, json({}, adminCookie())), {
      params: Promise.resolve({ id: r[0].id }),
    });
    expect(res.status).toBe(200);
    expect(await db.query(`select 1 from reports where not resolved`)).toHaveLength(0);
  });
});

describe("certificate view counting", () => {
  const view = (ip: string, body: unknown = {}, ua = "Mozilla/5.0 (iPhone)") =>
    viewPOST(new Request(`${ORIGIN}/api/cert/chef/view`, json(body, { "x-forwarded-for": ip, "user-agent": ua })), {
      params: Promise.resolve({ slug: "chef" }),
    });

  it("counts one view per viewer per day and skips owners and bots", async () => {
    const t = await insertTitle(db, { key: "chef", status: "claimed" });
    await view("1.1.1.1");
    await view("1.1.1.1");
    await view("2.2.2.2");
    await view("3.3.3.3", { owner: true });
    await view("4.4.4.4", {}, "WhatsApp/2.24");
    const rows = await db.query<{ c: number }>(`select count(*)::int as c from certificate_views where title_id = $1`, [t.id]);
    expect(rows[0].c).toBe(2);
  });
});

describe("analytics", () => {
  it("removes manage tokens, ids and query strings from paths", () => {
    expect(sanitizePath("/manage/abcDEF123_-xyz")).toBe("/manage/[token]");
    expect(sanitizePath("https://x.test/success?id=aceb3254-493c-4b46-ad2d-b17a43a457ec")).toBe("/success");
    expect(sanitizePath("/api/cert/chef/print?token=secret&size=a4")).toBe("/api/cert/chef/print");
    expect(sanitizePath("/c/sunny-mom")).toBe("/c/sunny-mom");
    expect(sanitizeReferrer("https://wa.me/some/path?x=1")).toBe("https://wa.me");
    expect(sanitizeReferrer("https://site.test/c/x", "https://site.test")).toBeNull();
  });

  it("scrubs every URL-like property posthog-js adds, including $set_once", () => {
    const token = "_mL_j2CCACisYNv0TqXE54NPAyz_ITHQ01f4pXDR-O8";
    const props = scrubEventProperties(
      {
        $current_url: `https://site.test/manage/${token}`,
        $session_entry_url: `https://site.test/manage/${token}`,
        $session_entry_pathname: `/manage/${token}`,
        $initial_current_url: "https://site.test/success?id=aceb3254-493c-4b46-ad2d-b17a43a457ec",
        $referrer: "https://wa.me/abc?x=1",
        $session_entry_referrer: "$direct",
        $set_once: { $initial_current_url: `https://site.test/manage/${token}` },
        path: "/c/chef",
        tier: "standard",
      },
      "https://site.test",
    );
    expect(JSON.stringify(props)).not.toContain(token);
    expect(JSON.stringify(props)).not.toContain("aceb3254");
    expect(props).toMatchObject({
      $current_url: "/manage/[token]",
      $session_entry_url: "/manage/[token]",
      $initial_current_url: "/success",
      $referrer: "https://wa.me",
      $session_entry_referrer: "$direct",
      tier: "standard",
    });
  });

  it("sends checkout_started and claim_completed with their properties and no personal data", async () => {
    const ref = await insertTitle(db, { key: "chef", status: "claimed" });
    const res = await checkoutPOST(
      new Request(
        `${ORIGIN}/api/checkout`,
        json({
          title: "Sunny Mom",
          recipientName: "Priya Secretname",
          email: "buyer-secret@example.test",
          dedication: "private words",
          addonPrint: true,
          refSlug: "chef",
          analyticsId: "anon-123",
        }),
      ),
    );
    const { titleId } = (await res.json()) as { titleId: string };
    const body = JSON.stringify({
      business_id: "b",
      type: "payment.succeeded",
      timestamp: "",
      data: { payment_id: "pay_1", total_amount: 1200, tax: 0, currency: "USD", metadata: { title_id: titleId } },
    });
    await webhookPOST(new Request(`${ORIGIN}/api/webhooks/payments`, { method: "POST", headers: signStubEvent(body, SECRET), body }));

    expect(events).toEqual([
      { distinctId: "anon-123", event: "checkout_started", properties: { tier: "standard", addon_print: true, price_cents: 1200 } },
      {
        distinctId: "anon-123",
        event: "claim_completed",
        properties: { tier: "standard", addon_print: true, price_cents: 1200, ref_slug: "chef", registry_no: 2 },
      },
    ]);
    const serialized = JSON.stringify(events);
    for (const secret of ["Priya", "Secretname", "buyer-secret", "private words", titleId]) expect(serialized).not.toContain(secret);
    expect(ref.registry_no).toBe(1);
  });
});

describe("daily stats", () => {
  it("returns 14 days with claims, gross, loop claims, share rate inputs and searches", async () => {
    const ref = await insertTitle(db, { key: "chef", status: "claimed" });
    const t = await insertTitle(db, { key: "baker", status: "claimed" });
    await db.query(`update titles set ref_title_id = $1, checkout_id = 'cks_x' where id = $2`, [ref.id, t.id]);
    for (const h of ["a", "b", "c"]) {
      await db.query(`insert into certificate_views (title_id, viewer_hash, day) values ($1, $2, current_date)`, [t.id, h]);
    }
    await checkGET(new Request(`${ORIGIN}/api/titles/check?q=dad`, { headers: { "x-forwarded-for": "1.2.3.4" } }));
    await checkGET(new Request(`${ORIGIN}/api/titles/check?q=mom`, { headers: { "x-forwarded-for": "1.2.3.4" } }));

    const days = await dailyStats(db, 14);
    expect(days).toHaveLength(14);
    expect(days[0]).toMatchObject({
      checkouts: 1,
      claims: 2,
      grossCents: 1000,
      sharedClaims: 1,
      loopClaims: 1,
      certificateViews: 3,
      searches: 2,
      searchers: 1,
    });

    const res = await statsGET(new Request(`${ORIGIN}/api/admin/stats`, { headers: adminCookie() }));
    expect(res.status).toBe(200);
  });
});

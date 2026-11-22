import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as checkoutPOST } from "@/app/api/checkout/route";
import { POST as webhookPOST } from "@/app/api/webhooks/payments/route";
import { type Db, setDbForTests } from "@/lib/db";
import { type OutgoingEmail, setEmailSenderForTests } from "@/lib/email";
import { parseDodoWebhook, productCart } from "@/lib/payments/dodo";
import { type CreateCheckoutInput, type PaymentProvider, setPaymentProviderForTests } from "@/lib/payments/index";
import { signStubEvent } from "@/lib/payments/stub";
import { freshTestDb, insertTitle } from "./helpers/db";

const SECRET = "whsec_dGVzdC1zZWNyZXQtZm9yLXdlYmhvb2stdGVzdHMtMDA=";

interface TestProvider extends PaymentProvider {
  checkouts: CreateCheckoutInput[];
  refunds: { paymentId: string; reason: string }[];
  failCheckout: boolean;
  failRefund: boolean;
}

function testProvider(): TestProvider {
  let n = 0;
  const p: TestProvider = {
    name: "test",
    checkouts: [],
    refunds: [],
    failCheckout: false,
    failRefund: false,
    async createCheckout(input) {
      if (p.failCheckout) throw new Error("provider down");
      p.checkouts.push(input);
      n += 1;
      return { checkoutId: `cks_${n}`, checkoutUrl: `https://pay.example.test/cks_${n}` };
    },
    parseWebhook(raw, headers) {
      return parseDodoWebhook(SECRET, raw, headers);
    },
    async refund(paymentId, reason) {
      if (p.failRefund) throw new Error("refund failed");
      p.refunds.push({ paymentId, reason });
    },
  };
  return p;
}

let db: Db;
let provider: TestProvider;
let emails: OutgoingEmail[];

beforeEach(async () => {
  ({ db } = await freshTestDb());
  provider = testProvider();
  setPaymentProviderForTests(provider);
  emails = [];
  setEmailSenderForTests({ send: async (e) => void emails.push(e) });
  process.env.NEXT_PUBLIC_SITE_URL = "https://registry.example.test";
});

afterEach(() => {
  setDbForTests(undefined);
  setPaymentProviderForTests(undefined);
  setEmailSenderForTests(undefined);
});

const claim = (over: Record<string, unknown> = {}) => ({
  title: "Parallel Parker",
  recipientName: "Alex",
  giverName: "Sam",
  dedication: "For every tight spot",
  email: "buyer@example.test",
  addonPrint: false,
  ...over,
});

async function checkout(body: Record<string, unknown>) {
  const res = await checkoutPOST(
    new Request("http://test/api/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
  );
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

function paymentEvent(o: { titleId?: string | null; checkoutId?: string | null; paymentId?: string; total?: number }) {
  return JSON.stringify({
    business_id: "bus_test",
    type: "payment.succeeded",
    timestamp: new Date().toISOString(),
    data: {
      payload_type: "Payment",
      payment_id: o.paymentId ?? "pay_1",
      checkout_session_id: o.checkoutId ?? null,
      total_amount: o.total ?? 500,
      tax: 0,
      currency: "USD",
      metadata: o.titleId === null ? {} : { title_id: o.titleId },
    },
  });
}

async function deliver(body: string, msgId?: string, secret = SECRET) {
  const res = await webhookPOST(
    new Request("http://test/api/webhooks/payments", { method: "POST", headers: signStubEvent(body, secret, msgId), body }),
  );
  return { status: res.status, body: (await res.json()) as { outcome?: string; error?: string } };
}

async function row(id: string) {
  const rows = await db.query<{ status: string; registry_no: number | null; payment_id: string | null; claimed_at: Date | null; reserved_until: Date | null }>(
    `select status, registry_no::int as registry_no, payment_id, claimed_at, reserved_until from titles where id = $1`,
    [id],
  );
  return rows[0];
}

async function activeCount(key: string): Promise<number> {
  const r = await db.query<{ c: number }>(
    `select count(*)::int as c from titles where title_key = $1 and status in ('reserved','claimed','in_review')`,
    [key],
  );
  return r[0].c;
}

describe("POST /api/checkout", () => {
  it("reserves the title for 15 minutes and returns the hosted checkout URL", async () => {
    const { status, body } = await checkout(claim());
    expect(status).toBe(200);
    expect(body.checkoutUrl).toBe("https://pay.example.test/cks_1");
    const r = await db.query<{ status: string; checkout_id: string; mins: number; price_cents: number; manage_token: string }>(
      `select status, checkout_id, price_cents, manage_token,
         round(extract(epoch from (reserved_until - now())) / 60)::int as mins from titles where id = $1`,
      [body.titleId],
    );
    expect(r[0]).toMatchObject({ status: "reserved", checkout_id: "cks_1", mins: 15, price_cents: 500 });
    expect(r[0].manage_token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(provider.checkouts[0]).toMatchObject({
      tier: "standard",
      addonPrint: false,
      customerEmail: "buyer@example.test",
      returnUrl: `https://registry.example.test/success?id=${body.titleId}`,
    });
  });

  it("ignores a client-modified price and prices from the tier", async () => {
    const { body } = await checkout(claim({ title: "Dad", priceCents: 1, price_cents: 1, amount: 1, addonPrint: true }));
    const r = await db.query<{ price_cents: number; tier: string }>(`select price_cents, tier from titles where id = $1`, [body.titleId]);
    expect(r[0]).toEqual({ price_cents: 9900 + 700, tier: "iconic" });
    expect(provider.checkouts[0]).toMatchObject({ tier: "iconic", addonPrint: true });
  });

  it("answers 409 with the holder when the title is taken", async () => {
    await insertTitle(db, { key: "parallel parker", status: "claimed", recipient: "Kim" });
    const { status, body } = await checkout(claim());
    expect(status).toBe(409);
    expect((body.check as { status: string }).status).toBe("taken");
    expect(provider.checkouts).toHaveLength(0);
  });

  it("creates exactly one reservation for two simultaneous checkouts", async () => {
    const [a, b] = await Promise.all([checkout(claim()), checkout(claim({ email: "other@example.test" }))]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(await activeCount("parallel parker")).toBe(1);
  });

  it("expires an abandoned reservation so the title can be reserved again", async () => {
    await insertTitle(db, { key: "parallel parker", status: "reserved", reservedMinutesFromNow: -1 });
    const { status } = await checkout(claim());
    expect(status).toBe(200);
    const r = await db.query<{ status: string }>(`select status from titles where title_key = 'parallel parker' order by created_at`);
    expect(r.map((x) => x.status).sort()).toEqual(["expired", "reserved"]);
  });

  it("releases the reservation when the provider fails", async () => {
    provider.failCheckout = true;
    const { status, body } = await checkout(claim());
    expect(status).toBe(503);
    expect(body.error).toMatch(/try again/i);
    expect(await activeCount("parallel parker")).toBe(0);
  });

  it("rejects blocked titles and invalid fields", async () => {
    expect((await checkout(claim({ title: "idiot" }))).status).toBe(400);
    expect((await checkout(claim({ recipientName: "see bestdad.com" }))).status).toBe(400);
    expect((await checkout(claim({ email: "nope" }))).status).toBe(400);
  });

  it("limits one email to five claims a day", async () => {
    for (let i = 0; i < 5; i++) expect((await checkout(claim({ title: `Title ${"abcde"[i]}x` }))).status).toBe(200);
    const sixth = await checkout(claim({ title: "Title fx" }));
    expect(sixth.status).toBe(429);
  });

  it("stores the referring certificate", async () => {
    const ref = await insertTitle(db, { key: "chef", status: "claimed" });
    const { body } = await checkout(claim({ refSlug: "chef" }));
    const r = await db.query<{ ref_title_id: string }>(`select ref_title_id from titles where id = $1`, [body.titleId]);
    expect(r[0].ref_title_id).toBe(ref.id);
  });
});

describe("POST /api/webhooks/payments", () => {
  async function reserved(over: Record<string, unknown> = {}) {
    const { body } = await checkout(claim(over));
    return body.titleId as string;
  }

  it("claims the title, assigns the next registry number and emails the buyer", async () => {
    await insertTitle(db, { key: "chef", status: "claimed" }); // takes No. 1
    const id = await reserved();
    const { status, body } = await deliver(paymentEvent({ titleId: id, checkoutId: "cks_1" }));
    expect(status).toBe(200);
    expect(body.outcome).toBe("claimed");
    const r = await row(id);
    expect(r).toMatchObject({ status: "claimed", registry_no: 2, payment_id: "pay_1", reserved_until: null });
    expect(r.claimed_at).toBeInstanceOf(Date);
    expect(emails).toHaveLength(1);
    expect(emails[0]).toMatchObject({ to: "buyer@example.test", idempotencyKey: `claim/${id}` });
    expect(emails[0].text).toContain("https://registry.example.test/c/parallel-parker");
    expect(emails[0].text).toContain("https://registry.example.test/manage/");
    expect(emails[0].text).toContain("A novelty registry for fun and affection. Titles have no legal or official status.");
    expect(emails[0].html).toContain("A novelty registry for fun and affection. Titles have no legal or official status.");
  });

  it("finds the reservation by checkout session id when metadata is missing", async () => {
    const id = await reserved();
    const { body } = await deliver(paymentEvent({ titleId: null, checkoutId: "cks_1" }));
    expect(body.outcome).toBe("claimed");
    expect((await row(id)).status).toBe("claimed");
  });

  it("changes nothing when the same webhook is delivered twice", async () => {
    const id = await reserved();
    const event = paymentEvent({ titleId: id });
    await deliver(event, "msg_same");
    const before = await row(id);
    const again = await deliver(event, "msg_same");
    expect(again.status).toBe(200);
    expect(again.body.outcome).toBe("duplicate");
    expect(await row(id)).toEqual(before);
    expect(emails).toHaveLength(1);
    const seq = await db.query<{ last_value: number }>(`select last_value::int as last_value from registry_no_seq`);
    expect(seq[0].last_value).toBe(1);
  });

  it("treats a redelivery with a new event id as already claimed", async () => {
    const id = await reserved();
    await deliver(paymentEvent({ titleId: id }), "msg_a");
    const second = await deliver(paymentEvent({ titleId: id }), "msg_b");
    expect(second.body.outcome).toBe("already_claimed");
    expect((await row(id)).registry_no).toBe(1);
  });

  it("rejects a bad signature with 401 and records nothing", async () => {
    const id = await reserved();
    const res = await deliver(paymentEvent({ titleId: id }), undefined, "whsec_d3Jvbmctc2VjcmV0LXdyb25nLXNlY3JldC0wMDAwMDA=");
    expect(res.status).toBe(401);
    expect((await row(id)).status).toBe("reserved");
    const ev = await db.query(`select 1 from webhook_events`);
    expect(ev).toHaveLength(0);
  });

  it("rejects missing signature headers with 401", async () => {
    const res = await webhookPOST(new Request("http://test/api/webhooks/payments", { method: "POST", body: paymentEvent({}) }));
    expect(res.status).toBe(401);
  });

  it("reclaims an expired reservation when the title is still free", async () => {
    const id = await reserved();
    await db.query(`update titles set status = 'expired', reserved_until = now() - interval '1 minute' where id = $1`, [id]);
    const { body } = await deliver(paymentEvent({ titleId: id }));
    expect(body.outcome).toBe("reclaimed");
    expect((await row(id)).status).toBe("claimed");
  });

  it("reclaims past another buyer's stale hold", async () => {
    const id = await reserved();
    await db.query(`update titles set status = 'expired' where id = $1`, [id]);
    await insertTitle(db, { key: "parallel parker", status: "reserved", reservedMinutesFromNow: -2 });
    const { body } = await deliver(paymentEvent({ titleId: id }));
    expect(body.outcome).toBe("reclaimed");
    expect(await activeCount("parallel parker")).toBe(1);
  });

  it("refunds a late payment on a title now held by someone else and emails free variants", async () => {
    const id = await reserved();
    await db.query(`update titles set status = 'expired' where id = $1`, [id]);
    await insertTitle(db, { key: "parallel parker", status: "claimed", recipient: "Kim" });
    const { body } = await deliver(paymentEvent({ titleId: id, paymentId: "pay_late" }));
    expect(body.outcome).toBe("refunded_taken");
    expect(provider.refunds).toEqual([{ paymentId: "pay_late", reason: expect.stringMatching(/claimed by someone else/) }]);
    expect((await row(id)).status).toBe("expired");
    expect(emails).toHaveLength(1);
    expect(emails[0].subject).toMatch(/refunded/);
    expect(emails[0].text).toContain("World's Best Parallel Parker Ever");
  });

  it("returns 500 and records nothing when the refund fails, so the provider retries", async () => {
    const id = await reserved();
    await db.query(`update titles set status = 'expired' where id = $1`, [id]);
    await insertTitle(db, { key: "parallel parker", status: "claimed" });
    provider.failRefund = true;
    const first = await deliver(paymentEvent({ titleId: id }), "msg_retry");
    expect(first.status).toBe(500);
    expect(await db.query(`select 1 from webhook_events`)).toHaveLength(0);
    provider.failRefund = false;
    const retry = await deliver(paymentEvent({ titleId: id }), "msg_retry");
    expect(retry.body.outcome).toBe("refunded_taken");
  });

  it("sends flagged entries to review instead of publishing", async () => {
    const id = await reserved({ dedication: "you absolute idiot" });
    const { body } = await deliver(paymentEvent({ titleId: id }));
    expect(body.outcome).toBe("in_review");
    expect(await row(id)).toMatchObject({ status: "in_review", registry_no: 1 });
    expect(emails[0].subject).toMatch(/in review/);
  });

  it("refunds a second, different payment for the same reservation", async () => {
    const id = await reserved();
    await deliver(paymentEvent({ titleId: id, paymentId: "pay_1" }));
    const { body } = await deliver(paymentEvent({ titleId: id, paymentId: "pay_2" }));
    expect(body.outcome).toBe("refunded_extra_payment");
    expect(provider.refunds.map((r) => r.paymentId)).toEqual(["pay_2"]);
    expect((await row(id)).payment_id).toBe("pay_1");
  });

  it("acknowledges a payment that matches no reservation", async () => {
    const { status, body } = await deliver(paymentEvent({ titleId: null, checkoutId: "cks_unknown" }));
    expect(status).toBe(200);
    expect(body.outcome).toBe("unmatched");
  });

  it.each([
    ["refund.succeeded", { refund_id: "ref_1", payment_id: "pay_1", amount: 500 }],
    ["dispute.lost", { dispute_id: "dsp_1", payment_id: "pay_1", amount: "500" }],
  ])("%s frees the title and retires the registry number", async (type, data) => {
    const id = await reserved();
    await deliver(paymentEvent({ titleId: id, paymentId: "pay_1" }));
    const { body } = await deliver(JSON.stringify({ business_id: "bus_test", type, timestamp: new Date().toISOString(), data }));
    expect(body.outcome).toBe("removed");
    expect(await row(id)).toMatchObject({ status: "removed", registry_no: 1 });

    // The title is free again, and the next claim gets a new number.
    const next = await checkout(claim({ email: "next@example.test" }));
    expect(next.status).toBe(200);
    await deliver(paymentEvent({ titleId: next.body.titleId as string, paymentId: "pay_next" }));
    expect((await row(next.body.titleId as string)).registry_no).toBe(2);
  });

  it("ignores event types it doesn't handle", async () => {
    const { body } = await deliver(JSON.stringify({ business_id: "b", type: "payment.processing", timestamp: "", data: {} }));
    expect(body.outcome).toBe("ignored");
  });
});

describe("Dodo product cart", () => {
  const env = {
    DODO_PRODUCT_STANDARD: "pdt_std",
    DODO_PRODUCT_POPULAR: "pdt_pop",
    DODO_PRODUCT_ICONIC: "pdt_ico",
    DODO_PRODUCT_PRINT_ADDON: "pdt_print",
  };

  it("maps tiers and the add-on to products", () => {
    expect(productCart("standard", false, env)).toEqual([{ product_id: "pdt_std", quantity: 1 }]);
    expect(productCart("iconic", true, env)).toEqual([
      { product_id: "pdt_ico", quantity: 1 },
      { product_id: "pdt_print", quantity: 1 },
    ]);
  });

  it("fails clearly when a product id is missing", () => {
    expect(() => productCart("popular", false, {})).toThrow(/DODO_PRODUCT_POPULAR/);
  });
});

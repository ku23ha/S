import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as webhookPOST } from "@/app/api/webhooks/payments/route";
import { type Db, setDbForTests } from "@/lib/db";
import { setEmailSenderForTests } from "@/lib/email";
import { setPaymentProviderForTests } from "@/lib/payments/index";
import { parseRazorpayWebhook, paymentLinkBody, verifyRazorpaySignature } from "@/lib/payments/razorpay";
import { WebhookVerificationError } from "@/lib/payments/index";
import { formatPrice } from "@/lib/format";
import { freshTestDb, insertTitle } from "./helpers/db";

const SECRET = "rzp-webhook-secret-for-tests";

function signed(body: unknown, eventId = "evt_rzp_1", secret = SECRET) {
  const raw = JSON.stringify(body);
  const headers = new Headers({
    "content-type": "application/json",
    "x-razorpay-signature": createHmac("sha256", secret).update(raw).digest("hex"),
    "x-razorpay-event-id": eventId,
  });
  return { raw, headers };
}

const paidEvent = (titleId: string, paymentId = "pay_R1", amount = 500) => ({
  entity: "event",
  account_id: "acc_x",
  event: "payment_link.paid",
  contains: ["payment_link", "order", "payment"],
  payload: {
    payment_link: { entity: { id: "plink_1", reference_id: titleId, notes: { title_id: titleId }, status: "paid" } },
    payment: { entity: { id: paymentId, amount, currency: "INR", status: "captured", notes: null } },
    order: { entity: { id: "order_1" } },
  },
  created_at: 1795400000,
});

describe("Razorpay signatures", () => {
  it("accepts the right HMAC and rejects anything else", () => {
    const raw = '{"event":"payment_link.paid"}';
    const sig = createHmac("sha256", SECRET).update(raw).digest("hex");
    expect(verifyRazorpaySignature(raw, sig, SECRET)).toBe(true);
    expect(verifyRazorpaySignature(raw, sig.toUpperCase(), SECRET)).toBe(true);
    expect(verifyRazorpaySignature(raw + " ", sig, SECRET)).toBe(false);
    expect(verifyRazorpaySignature(raw, sig, "other-secret")).toBe(false);
    expect(verifyRazorpaySignature(raw, "not-hex", SECRET)).toBe(false);
  });

  it("requires the signature and event id headers", () => {
    const { raw } = signed(paidEvent("t"));
    expect(() => parseRazorpayWebhook(SECRET, raw, new Headers())).toThrow(WebhookVerificationError);
  });
});

describe("Razorpay events", () => {
  it("normalises payment_link.paid with the title id from reference_id", () => {
    const { raw, headers } = signed(paidEvent("11111111-2222-3333-4444-555555555555"));
    expect(parseRazorpayWebhook(SECRET, raw, headers)).toEqual({
      kind: "payment_succeeded",
      eventId: "evt_rzp_1",
      paymentId: "pay_R1",
      titleId: "11111111-2222-3333-4444-555555555555",
      checkoutId: "plink_1",
      totalAmountCents: 500,
      taxCents: 0,
      currency: "INR",
    });
  });

  it("maps refunds and lost disputes to reversals, and ignores the rest", () => {
    const refund = signed({ event: "refund.processed", payload: { refund: { entity: { id: "rfnd_1", payment_id: "pay_R1" } } } }, "e2");
    expect(parseRazorpayWebhook(SECRET, refund.raw, refund.headers)).toMatchObject({ kind: "payment_reversed", paymentId: "pay_R1", reason: "refund" });
    const lost = signed({ event: "payment.dispute.lost", payload: { dispute: { entity: { id: "disp_1", payment_id: "pay_R1" } } } }, "e3");
    expect(parseRazorpayWebhook(SECRET, lost.raw, lost.headers)).toMatchObject({ kind: "payment_reversed", reason: "chargeback" });
    const other = signed({ event: "payment.authorized", payload: {} }, "e4");
    expect(parseRazorpayWebhook(SECRET, other.raw, other.headers)).toMatchObject({ kind: "ignored", type: "payment.authorized" });
  });

  it("builds a payment link from the server price with a 20-minute expiry", () => {
    const body = paymentLinkBody(
      {
        titleId: "11111111-2222-3333-4444-555555555555",
        tier: "standard",
        addonPrint: true,
        customerEmail: "b@example.test",
        returnUrl: "https://worldsbest.cv/success?id=x",
        amountMinor: 99_800,
        currency: "INR",
        description: "World's Best Chai Maker + print file",
      },
      1_800_000_000_000,
    );
    expect(body).toMatchObject({
      amount: 99_800,
      currency: "INR",
      accept_partial: false,
      reference_id: "11111111-2222-3333-4444-555555555555",
      callback_method: "get",
      expire_by: 1_800_000_000 + 1200,
      notify: { sms: false, email: false },
    });
    expect(body.reference_id.length).toBeLessThanOrEqual(40);
  });

  it("formats rupee prices", () => {
    expect(formatPrice(39_900, "INR")).toBe("₹399");
    expect(formatPrice(7_99_900, "INR")).toBe("₹7,999");
    expect(formatPrice(500, "USD")).toBe("$5");
    expect(formatPrice(550, "USD")).toBe("$5.50");
  });
});

describe("Razorpay end to end through the webhook route", () => {
  let db: Db;
  beforeEach(async () => {
    ({ db } = await freshTestDb());
    process.env.RAZORPAY_KEY_ID = "rzp_test_x";
    process.env.RAZORPAY_KEY_SECRET = "api-secret";
    process.env.RAZORPAY_WEBHOOK_SECRET = SECRET;
    process.env.PAYMENTS_PROVIDER = "razorpay";
    setPaymentProviderForTests(undefined);
    setEmailSenderForTests({ send: async () => undefined });
  });
  afterEach(() => {
    delete process.env.PAYMENTS_PROVIDER;
    setPaymentProviderForTests(undefined);
    setDbForTests(undefined);
    setEmailSenderForTests(undefined);
  });

  it("claims the reserved title once, even if Razorpay delivers twice", async () => {
    const t = await insertTitle(db, { key: "chai maker", status: "reserved" });
    const deliver = async () => {
      const { raw, headers } = signed(paidEvent(t.id), "evt_same");
      const res = await webhookPOST(new Request("http://test/api/webhooks/payments", { method: "POST", headers, body: raw }));
      return (await res.json()) as { outcome: string };
    };
    expect((await deliver()).outcome).toBe("claimed");
    expect((await deliver()).outcome).toBe("duplicate");
    const r = await db.query<{ status: string; payment_id: string }>(`select status, payment_id from titles where id = $1`, [t.id]);
    expect(r[0]).toEqual({ status: "claimed", payment_id: "pay_R1" });
  });

  it("rejects a forged Razorpay webhook", async () => {
    const t = await insertTitle(db, { key: "chai maker", status: "reserved" });
    const { raw, headers } = signed(paidEvent(t.id), "evt_x", "wrong-secret");
    const res = await webhookPOST(new Request("http://test/api/webhooks/payments", { method: "POST", headers, body: raw }));
    expect(res.status).toBe(401);
  });
});

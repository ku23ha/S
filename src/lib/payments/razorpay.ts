/**
 * Razorpay adapter (razorpay.com/docs, read 2026-11-23). Buyers pay on a
 * Razorpay-hosted Payment Link (cards, UPI, netbanking, wallets); money
 * settles to the merchant's Indian bank account on Razorpay's cycle.
 *
 * - Create: POST /v1/payment_links, HTTP basic auth key_id:key_secret.
 *   amount in the smallest unit; reference_id (max 40, unique) = title id;
 *   notes.title_id; callback_url + callback_method "get"; expire_by >= 15 min.
 * - Webhooks: X-Razorpay-Signature = hex HMAC-SHA256 of the raw body with the
 *   webhook secret (not the API secret). x-razorpay-event-id is unique per
 *   event and is our idempotency key. Any 2xx within 5 s; retries for 24 h.
 *   payment_link.paid -> payload.payment.entity.id, payload.payment_link.entity
 *   {id, reference_id, notes}. refund.processed -> payload.refund.entity.payment_id.
 *   payment.dispute.lost -> payload.dispute.entity.payment_id.
 * - Refunds: POST /v1/payments/:id/refund with no amount = full refund;
 *   X-Refund-Idempotency header (10+ chars) stops double refunds.
 * Calls the REST API with fetch rather than the SDK's internal utility paths.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  type CheckoutSession,
  type CreateCheckoutInput,
  type PaymentEvent,
  type PaymentProvider,
  WebhookVerificationError,
} from "@/lib/payments/index";

const API = "https://api.razorpay.com/v1";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

/** Constant-time check of Razorpay's hex HMAC-SHA256 webhook signature. */
export function verifyRazorpaySignature(rawBody: string, signature: string, secret: string): boolean {
  if (!/^[0-9a-f]{64}$/i.test(signature)) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(rawBody).digest("hex"), "utf8");
  const given = Buffer.from(signature.toLowerCase(), "utf8");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

const Envelope = z.object({
  event: z.string(),
  payload: z.record(z.string(), z.unknown()).default({}),
});

const Entity = <T extends z.ZodTypeAny>(inner: T) => z.object({ entity: inner });

const PaidPayload = z.object({
  payment: Entity(
    z.object({
      id: z.string(),
      amount: z.number().nullish(),
      currency: z.string().nullish(),
      notes: z.union([z.record(z.string(), z.unknown()), z.array(z.unknown())]).nullish(),
    }),
  ),
  payment_link: Entity(
    z.object({
      id: z.string(),
      reference_id: z.string().nullish(),
      notes: z.union([z.record(z.string(), z.unknown()), z.array(z.unknown())]).nullish(),
    }),
  ).optional(),
});

const RefundPayload = z.object({ refund: Entity(z.object({ payment_id: z.string() })) });
const DisputePayload = z.object({ dispute: Entity(z.object({ payment_id: z.string() })) });

function noteTitleId(notes: unknown): string | null {
  if (notes && typeof notes === "object" && !Array.isArray(notes)) {
    const v = (notes as Record<string, unknown>).title_id;
    return typeof v === "string" ? v : null;
  }
  return null;
}

/** Verify and normalise a Razorpay webhook. */
export function parseRazorpayWebhook(secret: string, rawBody: string, headers: Headers): PaymentEvent {
  const signature = headers.get("x-razorpay-signature") ?? "";
  const eventId = headers.get("x-razorpay-event-id") ?? "";
  if (!signature || !eventId) throw new WebhookVerificationError("Missing webhook headers");
  if (!verifyRazorpaySignature(rawBody, signature, secret)) throw new WebhookVerificationError("Bad webhook signature");

  const env = Envelope.parse(JSON.parse(rawBody));

  if (env.event === "payment_link.paid") {
    const p = PaidPayload.parse(env.payload);
    const link = p.payment_link?.entity;
    return {
      kind: "payment_succeeded",
      eventId,
      paymentId: p.payment.entity.id,
      titleId: link?.reference_id ?? noteTitleId(link?.notes) ?? noteTitleId(p.payment.entity.notes),
      checkoutId: link?.id ?? null,
      totalAmountCents: p.payment.entity.amount ?? null,
      // Razorpay's payment "tax" is tax on its fee, not on the price, so the price check compares the full amount.
      taxCents: 0,
      currency: p.payment.entity.currency ?? null,
    };
  }
  if (env.event === "refund.processed") {
    return { kind: "payment_reversed", eventId, paymentId: RefundPayload.parse(env.payload).refund.entity.payment_id, reason: "refund" };
  }
  if (env.event === "payment.dispute.lost") {
    return {
      kind: "payment_reversed",
      eventId,
      paymentId: DisputePayload.parse(env.payload).dispute.entity.payment_id,
      reason: "chargeback",
    };
  }
  return { kind: "ignored", eventId, type: env.event };
}

/** Payment Link request body, exported for tests. */
export function paymentLinkBody(input: CreateCheckoutInput, now = Date.now()) {
  return {
    amount: input.amountMinor,
    currency: input.currency,
    accept_partial: false,
    description: input.description.slice(0, 2048),
    reference_id: input.titleId,
    customer: { email: input.customerEmail },
    notify: { sms: false, email: false },
    reminder_enable: false,
    notes: { title_id: input.titleId, tier: input.tier, print: input.addonPrint ? "yes" : "no" },
    callback_url: input.returnUrl,
    callback_method: "get",
    // Razorpay needs at least 15 minutes; our hold is 15, and late payments are reclaimed or refunded.
    expire_by: Math.floor(now / 1000) + 20 * 60,
  };
}

export function createRazorpayProvider(): PaymentProvider {
  const keyId = requireEnv("RAZORPAY_KEY_ID");
  const keySecret = requireEnv("RAZORPAY_KEY_SECRET");
  const webhookSecret = requireEnv("RAZORPAY_WEBHOOK_SECRET");
  const auth = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;

  async function call<T>(path: string, body: unknown, extraHeaders: Record<string, string> = {}): Promise<T> {
    const res = await fetch(`${API}${path}`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json", ...extraHeaders },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: { code?: string; description?: string } } & T;
    if (!res.ok) {
      throw new Error(`Razorpay ${path} failed: ${res.status} ${json.error?.code ?? ""} ${json.error?.description ?? ""}`.trim());
    }
    return json;
  }

  return {
    name: "razorpay",
    async createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
      const link = await call<{ id: string; short_url: string }>("/payment_links", paymentLinkBody(input));
      if (!link.id || !link.short_url) throw new Error("Razorpay returned no payment link");
      return { checkoutId: link.id, checkoutUrl: link.short_url };
    },
    parseWebhook(rawBody: string, headers: Headers): PaymentEvent {
      return parseRazorpayWebhook(webhookSecret, rawBody, headers);
    },
    async refund(paymentId: string, reason: string): Promise<void> {
      await call(
        `/payments/${encodeURIComponent(paymentId)}/refund`,
        { speed: "normal", notes: { reason: reason.slice(0, 250) } },
        { "X-Refund-Idempotency": `refund-${paymentId}`.slice(0, 64) },
      );
    },
  };
}

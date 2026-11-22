/**
 * Dodo Payments adapter (docs.dodopayments.com, read 2026-11-22):
 * - Hosted checkout: client.checkoutSessions.create({ product_cart, customer, return_url, metadata })
 *   returns { session_id, checkout_url }.
 * - Webhooks follow Standard Webhooks (headers webhook-id, webhook-signature,
 *   webhook-timestamp; 5-minute tolerance). The webhook-id is the idempotency key.
 *   Body: { business_id, type, timestamp, data }.
 * - Refunds: client.refunds.create({ payment_id, reason }). No items = whole payment.
 */
import DodoPayments from "dodopayments";
import { Webhook } from "standardwebhooks";
import { z } from "zod";
import type { Tier } from "@/lib/titles";
import {
  type CheckoutSession,
  type CreateCheckoutInput,
  type PaymentEvent,
  type PaymentProvider,
  WebhookVerificationError,
} from "@/lib/payments/index";

const TIER_PRODUCT_ENV: Record<Tier, string> = {
  standard: "DODO_PRODUCT_STANDARD",
  popular: "DODO_PRODUCT_POPULAR",
  iconic: "DODO_PRODUCT_ICONIC",
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

/** Product cart for a tier and optional print add-on. Prices live on the products. */
export function productCart(
  tier: Tier,
  addonPrint: boolean,
  env: Record<string, string | undefined> = process.env,
): { product_id: string; quantity: number }[] {
  const tierProduct = env[TIER_PRODUCT_ENV[tier]];
  if (!tierProduct) throw new Error(`${TIER_PRODUCT_ENV[tier]} is not set`);
  const cart = [{ product_id: tierProduct, quantity: 1 }];
  if (addonPrint) {
    const addon = env.DODO_PRODUCT_PRINT_ADDON;
    if (!addon) throw new Error("DODO_PRODUCT_PRINT_ADDON is not set");
    cart.push({ product_id: addon, quantity: 1 });
  }
  return cart;
}

const Envelope = z.object({
  type: z.string(),
  data: z.record(z.string(), z.unknown()).default({}),
});

const PaymentData = z.object({
  payment_id: z.string(),
  checkout_session_id: z.string().nullish(),
  total_amount: z.number().nullish(),
  tax: z.number().nullish(),
  currency: z.string().nullish(),
  metadata: z.record(z.string(), z.unknown()).nullish(),
});

const PaymentRef = z.object({ payment_id: z.string() });

const CHARGEBACK_TYPES = new Set(["dispute.lost", "dispute.accepted"]);

/** Verify with the Standard Webhooks secret, then normalise a Dodo event. */
export function parseDodoWebhook(secret: string, rawBody: string, headers: Headers): PaymentEvent {
  const h = {
    "webhook-id": headers.get("webhook-id") ?? "",
    "webhook-signature": headers.get("webhook-signature") ?? "",
    "webhook-timestamp": headers.get("webhook-timestamp") ?? "",
  };
  if (!h["webhook-id"] || !h["webhook-signature"] || !h["webhook-timestamp"]) {
    throw new WebhookVerificationError("Missing webhook headers");
  }
  try {
    new Webhook(secret).verify(rawBody, h);
  } catch {
    throw new WebhookVerificationError("Bad webhook signature");
  }

  const eventId = h["webhook-id"];
  const env = Envelope.parse(JSON.parse(rawBody));

  if (env.type === "payment.succeeded") {
    const d = PaymentData.parse(env.data);
    const titleId = d.metadata?.title_id;
    return {
      kind: "payment_succeeded",
      eventId,
      paymentId: d.payment_id,
      titleId: typeof titleId === "string" ? titleId : null,
      checkoutId: d.checkout_session_id ?? null,
      totalAmountCents: d.total_amount ?? null,
      taxCents: d.tax ?? null,
      currency: d.currency ?? null,
    };
  }
  if (env.type === "refund.succeeded") {
    return { kind: "payment_reversed", eventId, paymentId: PaymentRef.parse(env.data).payment_id, reason: "refund" };
  }
  if (CHARGEBACK_TYPES.has(env.type)) {
    return { kind: "payment_reversed", eventId, paymentId: PaymentRef.parse(env.data).payment_id, reason: "chargeback" };
  }
  return { kind: "ignored", eventId, type: env.type };
}

export function createDodoProvider(): PaymentProvider {
  const secret = requireEnv("DODO_WEBHOOK_SECRET");
  const client = new DodoPayments({
    bearerToken: requireEnv("DODO_API_KEY"),
    environment: process.env.PAYMENTS_MODE === "live" ? "live_mode" : "test_mode",
  });

  return {
    name: "dodo",
    async createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
      const session = await client.checkoutSessions.create({
        product_cart: productCart(input.tier, input.addonPrint),
        customer: { email: input.customerEmail },
        return_url: input.returnUrl,
        metadata: { title_id: input.titleId },
      });
      if (!session.checkout_url) throw new Error("Dodo returned no checkout_url");
      return { checkoutId: session.session_id, checkoutUrl: session.checkout_url };
    },
    parseWebhook(rawBody: string, headers: Headers): PaymentEvent {
      return parseDodoWebhook(secret, rawBody, headers);
    },
    async refund(paymentId: string, reason: string): Promise<void> {
      await client.refunds.create({ payment_id: paymentId, reason: reason.slice(0, 3000) });
    },
  };
}

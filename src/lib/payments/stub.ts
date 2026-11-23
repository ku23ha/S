/**
 * Development-only payment provider used when Dodo keys are missing. The
 * checkout URL points at /dev/checkout, which signs a Dodo-shaped
 * payment.succeeded event with STUB_WEBHOOK_SECRET and posts it to the real
 * webhook route, so the claim path runs exactly as it will with Dodo.
 * getPaymentProvider() never returns this in production.
 */
import { randomUUID } from "node:crypto";
import { Webhook } from "standardwebhooks";
import { parseDodoWebhook } from "@/lib/payments/dodo";
import type { CheckoutSession, CreateCheckoutInput, PaymentEvent, PaymentProvider } from "@/lib/payments/index";

/** Base64 of a fixed development key; not a secret. */
export const STUB_WEBHOOK_SECRET = "whsec_ZGV2LW9ubHktc3R1Yi13ZWJob29rLWtleS0wMDAwMDA=";

export const stubRefunds: { paymentId: string; reason: string }[] = [];

export function createStubProvider(): PaymentProvider {
  return {
    name: "stub",
    async createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
      const checkoutId = `cks_stub_${randomUUID()}`;
      const amount = input.amountMinor;
      const p = new URLSearchParams({
        checkout: checkoutId,
        title_id: input.titleId,
        amount: String(amount),
        return_url: input.returnUrl,
      });
      return { checkoutId, checkoutUrl: `/dev/checkout?${p.toString()}` };
    },
    parseWebhook(rawBody: string, headers: Headers): PaymentEvent {
      return parseDodoWebhook(STUB_WEBHOOK_SECRET, rawBody, headers);
    },
    async refund(paymentId: string, reason: string): Promise<void> {
      stubRefunds.push({ paymentId, reason });
      console.info(`[stub payments] refunded ${paymentId}: ${reason}`);
    },
  };
}

/** Build signed headers for a Dodo-shaped event body (dev stub and tests). */
export function signStubEvent(body: string, secret = STUB_WEBHOOK_SECRET, msgId = `msg_${randomUUID()}`): Headers {
  const now = new Date();
  const signature = new Webhook(secret).sign(msgId, now, body);
  return new Headers({
    "content-type": "application/json",
    "webhook-id": msgId,
    "webhook-timestamp": String(Math.floor(now.getTime() / 1000)),
    "webhook-signature": signature,
  });
}

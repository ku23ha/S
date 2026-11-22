/**
 * Payment provider interface. All payment calls go through here so another
 * provider can be swapped in. Prices are never passed in: the provider maps
 * the tier (and add-on) to its own fixed-price products.
 */
import type { Tier } from "@/lib/titles";

export interface CreateCheckoutInput {
  titleId: string;
  tier: Tier;
  addonPrint: boolean;
  customerEmail: string;
  returnUrl: string;
}

export interface CheckoutSession {
  checkoutId: string;
  checkoutUrl: string;
}

/** Provider events, normalised. eventId is unique per delivery attempt group (idempotency key). */
export type PaymentEvent =
  | {
      kind: "payment_succeeded";
      eventId: string;
      paymentId: string;
      titleId: string | null;
      checkoutId: string | null;
      totalAmountCents: number | null;
      taxCents: number | null;
      currency: string | null;
    }
  | { kind: "payment_reversed"; eventId: string; paymentId: string; reason: "refund" | "chargeback" }
  | { kind: "ignored"; eventId: string; type: string };

export class WebhookVerificationError extends Error {}

export interface PaymentProvider {
  readonly name: string;
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession>;
  /** Verify the signature on the raw body and normalise the event. Throws WebhookVerificationError. */
  parseWebhook(rawBody: string, headers: Headers): PaymentEvent;
  /** Refund a payment in full. */
  refund(paymentId: string, reason: string): Promise<void>;
}

let override: PaymentProvider | undefined;
let cached: PaymentProvider | undefined;

/**
 * The configured provider. With PAYMENTS_PROVIDER=dodo and its keys set, the
 * Dodo adapter. In development without keys, a local stub that simulates the
 * hosted page. Production without keys fails loudly.
 */
export async function getPaymentProvider(): Promise<PaymentProvider> {
  if (override) return override;
  if (cached) return cached;
  const provider = process.env.PAYMENTS_PROVIDER ?? "dodo";
  if (provider === "dodo" && process.env.DODO_API_KEY && process.env.DODO_WEBHOOK_SECRET) {
    const { createDodoProvider } = await import("@/lib/payments/dodo");
    cached = createDodoProvider();
    return cached;
  }
  if (process.env.NODE_ENV !== "production") {
    const { createStubProvider } = await import("@/lib/payments/stub");
    cached = createStubProvider();
    return cached;
  }
  throw new Error("Payments are not configured: set PAYMENTS_PROVIDER=dodo, DODO_API_KEY and DODO_WEBHOOK_SECRET");
}

/** Tests only. */
export function setPaymentProviderForTests(p: PaymentProvider | undefined): void {
  override = p;
  cached = undefined;
}

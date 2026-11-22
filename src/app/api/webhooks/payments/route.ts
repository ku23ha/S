import { getDb } from "@/lib/db";
import { WebhookVerificationError, getPaymentProvider } from "@/lib/payments/index";
import { siteUrl } from "@/lib/site";
import { handlePaymentEvent } from "@/lib/webhook";
import { errorSummary } from "@/lib/log";

/**
 * Payment provider webhook. 401 for a bad or missing signature, 400 for a
 * signed body we can't read, 200 once handled (including duplicates), and
 * 500 on failure so the provider retries.
 */
export async function POST(request: Request): Promise<Response> {
  const raw = await request.text();
  let provider;
  try {
    provider = await getPaymentProvider();
  } catch (err) {
    console.error("webhook: payments not configured", errorSummary(err));
    return Response.json({ error: "Not configured" }, { status: 500 });
  }

  let event;
  try {
    event = provider.parseWebhook(raw, request.headers);
  } catch (err) {
    if (err instanceof WebhookVerificationError) {
      return Response.json({ error: "Invalid signature" }, { status: 401 });
    }
    console.error("webhook: unreadable body", errorSummary(err));
    return Response.json({ error: "Bad payload" }, { status: 400 });
  }

  try {
    const outcome = await handlePaymentEvent(await getDb(), provider, event, JSON.parse(raw), siteUrl(request));
    return Response.json({ ok: true, outcome });
  } catch (err) {
    console.error("webhook: handling failed", errorSummary(err));
    return Response.json({ error: "Handler failed" }, { status: 500 });
  }
}

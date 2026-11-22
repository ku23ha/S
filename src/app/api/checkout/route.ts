import { ClaimInput } from "@/lib/claim";
import { startCheckout } from "@/lib/checkout";
import { getDb } from "@/lib/db";
import { getPaymentProvider } from "@/lib/payments/index";
import { siteUrl } from "@/lib/site";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }
  const parsed = ClaimInput.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Check the form and try again.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const [db, provider] = await Promise.all([getDb(), getPaymentProvider()]);
    const result = await startCheckout(db, provider, parsed.data, siteUrl(request));
    if (!result.ok) {
      return Response.json({ error: result.error, check: result.check }, { status: result.status });
    }
    return Response.json({ titleId: result.titleId, checkoutUrl: result.checkoutUrl, reservedUntil: result.reservedUntil });
  } catch (err) {
    console.error("checkout route failed", err instanceof Error ? err.message : err);
    return Response.json({ error: "Checkout couldn't start. Please try again." }, { status: 503 });
  }
}

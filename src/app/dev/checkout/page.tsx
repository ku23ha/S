/**
 * Local stand-in for the hosted checkout page, used only by the development
 * payment stub. 404s in production and whenever real Dodo keys are set.
 * "Pay" signs a Dodo-shaped payment.succeeded event and sends it through the
 * real webhook route.
 */
import { randomUUID } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { POST as webhookPOST } from "@/app/api/webhooks/payments/route";
import { formatPrice } from "@/lib/format";
import { getPaymentProvider } from "@/lib/payments/index";
import { signStubEvent } from "@/lib/payments/stub";

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

async function stubActive(): Promise<boolean> {
  if (process.env.NODE_ENV === "production") return false;
  return (await getPaymentProvider()).name === "stub";
}

async function pay(formData: FormData) {
  "use server";
  if (!(await stubActive())) notFound();
  const titleId = String(formData.get("title_id") ?? "");
  const checkoutId = String(formData.get("checkout") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const returnUrl = String(formData.get("return_url") ?? "/");
  const body = JSON.stringify({
    business_id: "bus_stub",
    type: "payment.succeeded",
    timestamp: new Date().toISOString(),
    data: {
      payload_type: "Payment",
      payment_id: `pay_stub_${randomUUID()}`,
      checkout_session_id: checkoutId,
      total_amount: amount,
      tax: 0,
      currency: "USD",
      metadata: { title_id: titleId },
    },
  });
  const res = await webhookPOST(
    new Request("http://localhost/api/webhooks/payments", { method: "POST", headers: signStubEvent(body), body }),
  );
  if (!res.ok) throw new Error(`stub webhook failed: ${res.status}`);
  const url = new URL(returnUrl, "http://localhost");
  redirect(`${url.pathname}${url.search}`);
}

async function Body({ searchParams }: { searchParams: SP }) {
  await connection();
  if (!(await stubActive())) notFound();
  const sp = await searchParams;
  const amount = Number(one(sp.amount)) || 0;
  return (
    <div className="rounded-2xl border-2 border-dashed border-neutral-400 p-5">
      <p className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Local test checkout</p>
      <h1 className="mt-2 text-2xl font-bold">Pay {formatPrice(amount)}</h1>
      <p className="mt-2 text-neutral-700 dark:text-neutral-300">
        This page stands in for the hosted checkout while payment keys are missing. No money moves.
      </p>
      <form action={pay} className="mt-5 flex flex-col gap-3">
        <input type="hidden" name="title_id" value={one(sp.title_id)} />
        <input type="hidden" name="checkout" value={one(sp.checkout)} />
        <input type="hidden" name="amount" value={String(amount)} />
        <input type="hidden" name="return_url" value={one(sp.return_url)} />
        <button type="submit" className="rounded-xl bg-neutral-900 px-5 py-4 text-lg font-semibold text-white dark:bg-white dark:text-neutral-900">
          Simulate successful payment
        </button>
      </form>
    </div>
  );
}

export default function DevCheckout({ searchParams }: { searchParams: SP }) {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8">
      <Suspense fallback={null}>
        <Body searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

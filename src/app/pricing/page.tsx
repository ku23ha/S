import type { Metadata } from "next";
import Link from "next/link";
import { Prose } from "@/components/Prose";
import { formatPrice } from "@/lib/format";
import { PRINT_ADDON_CENTS, TIER_PRICE_CENTS } from "@/lib/titles";

export const metadata: Metadata = {
  title: "Pricing",
  description: "One-time prices for World's Best titles. No subscriptions, no renewals.",
};

export default function PricingPage() {
  const rows = [
    { name: "Standard", price: TIER_PRICE_CENTS.standard, what: "Any title not on the lists below: most personal titles, like “Chai Maker” or “Parallel Parker”." },
    { name: "Popular", price: TIER_PRICE_CENTS.popular, what: "About 300 common family, relationship and job titles: Sister, Uncle, Best Friend, Nurse, Chef." },
    { name: "Iconic", price: TIER_PRICE_CENTS.iconic, what: "The 25 titles everyone knows: Dad, Mom, Boss, Friend, Teacher." },
  ];
  return (
    <Prose title="Pricing" updated="23 November 2026">
      <p>
        You pay once per title. There are no subscriptions, renewals or hidden fees, and prices never change with demand. Every tier
        gets the same certificate; the price only reflects how widely a title is wanted.
      </p>
      <div className="not-prose overflow-hidden rounded-2xl border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-paper-deep text-xs uppercase tracking-[0.15em] text-muted">
            <tr>
              <th className="px-4 py-3">Tier</th>
              <th className="px-4 py-3">Price</th>
              <th className="hidden px-4 py-3 sm:table-cell">Which titles</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.name} className="align-top">
                <td className="px-4 py-3 font-semibold">
                  {r.name}
                  <span className="mt-1 block font-normal text-ink-soft sm:hidden">{r.what}</span>
                </td>
                <td className="px-4 py-3 font-display text-lg font-semibold">{formatPrice(r.price)}</td>
                <td className="hidden px-4 py-3 text-ink-soft sm:table-cell">{r.what}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2>Included with every title</h2>
      <ul>
        <li>A public certificate page with the recipient&apos;s name, your dedication and a registry number</li>
        <li>Share images for WhatsApp, Instagram stories and social posts, and a surprise link</li>
        <li>A private link to fix typos for 24 hours</li>
        <li>Instant delivery by email (see the <Link href="/delivery">delivery policy</Link>)</li>
      </ul>
      <h2>Optional add-on</h2>
      <p>
        High-resolution print file (A4 and US Letter) and a longer dedication: {formatPrice(PRINT_ADDON_CENTS)}. It&apos;s never
        added unless you tick it.
      </p>
      <h2>Payment</h2>
      <p>
        UPI, cards, netbanking and wallets through our payment provider&apos;s secure checkout. International cards are accepted.
        Taxes may be added at checkout depending on where you are, and are shown before you pay. See{" "}
        <Link href="/refunds">cancellation and refunds</Link>.
      </p>
      <p>
        <Link href="/#search">Find a title</Link>
      </p>
    </Prose>
  );
}

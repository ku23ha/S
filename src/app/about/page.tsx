import type { Metadata } from "next";
import Link from "next/link";
import { Contact, Prose } from "@/components/Prose";
import { DISCLAIMER, PRODUCT_NAME } from "@/lib/copy";
import { formatPrice } from "@/lib/format";
import { PRINT_ADDON_CENTS, TIER_PRICE_CENTS } from "@/lib/titles";

export const metadata: Metadata = {
  title: `About`,
  description: `What ${PRODUCT_NAME} is, what it costs, and how refunds and removal work. ${DISCLAIMER}`,
};

export default function AboutPage() {
  return (
    <Prose title="About the registry">
      <p>
        {PRODUCT_NAME} is a public list where every &ldquo;World&apos;s Best ___&rdquo; title can belong to exactly one person.
        You search a title, and if nobody holds it you can claim it as a gift. The person you name gets a numbered certificate
        page that is theirs alone.
      </p>

      <h2>What it is not</h2>
      <p>{DISCLAIMER} A title is a gift and a bit of fun. It is not an award, a qualification or a trademark, and it gives no rights over the words.</p>
      <ul>
        <li>No accounts, no bidding and no renewals. You pay once.</li>
        <li>Titles can&apos;t be transferred or resold. Once claimed, a title stays with the person named.</li>
        <li>The prefix is always &ldquo;World&apos;s Best&rdquo;. Titles that insult or target someone aren&apos;t allowed.</li>
      </ul>

      <h2>Prices</h2>
      <p>Prices are fixed and public. They never rise on a timer or because a title is popular right now.</p>
      <ul>
        <li>
          <strong>Standard title: {formatPrice(TIER_PRICE_CENTS.standard)}.</strong> Any title not on the two lists below.
        </li>
        <li>
          <strong>Popular title: {formatPrice(TIER_PRICE_CENTS.popular)}.</strong> About 300 common family, relationship and job
          titles, such as Sister, Uncle, Nurse and Chef.
        </li>
        <li>
          <strong>Iconic title: {formatPrice(TIER_PRICE_CENTS.iconic)}.</strong> 25 titles everyone knows, such as Dad, Mom, Boss,
          Friend and Teacher. <Link href="/registry?tab=iconic">See which are still open.</Link>
        </li>
        <li>
          <strong>Print file: +{formatPrice(PRINT_ADDON_CENTS)}.</strong> A high-resolution file in A4 and US Letter, and room
          for a longer dedication.
        </li>
      </ul>
      <p>Search any title to see its price before you start.</p>

      <h2>Registry numbers</h2>
      <p>
        Every claimed title gets the next number in the registry, starting at No. 000001. Numbers are never reused, even if a
        title is later removed.
      </p>

      <h2>Refunds and removal</h2>
      <p>
        If something goes wrong, or a certificate breaks the rules, we refund it. The details are on the{" "}
        <Link href="/refunds">refunds and removal</Link> page. Anyone named on a certificate can ask for it to be taken down.
      </p>

      <h2>Contact</h2>
      <p>
        Questions, problems or removal requests: <Contact />.
      </p>
    </Prose>
  );
}

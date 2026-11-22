import type { Metadata } from "next";
import Link from "next/link";
import { Contact, Prose } from "@/components/Prose";
import { DISCLAIMER, PRODUCT_NAME } from "@/lib/copy";

export const metadata: Metadata = { title: `Terms · ${PRODUCT_NAME}` };

export default function TermsPage() {
  return (
    <Prose title="Terms" updated="22 November 2026">
      <p>These terms cover using {PRODUCT_NAME} and claiming a title. By claiming a title you agree to them.</p>

      <h2>What you are buying</h2>
      <p>
        You pay a one-time fee for a title to be entered in the registry under the name you give, with a public certificate page
        and share images. {DISCLAIMER} A title gives no rights over its words and is not an award, rank or qualification.
      </p>

      <h2>One holder per title</h2>
      <ul>
        <li>Each title can have one holder at a time. While you pay, the title is held for you for 15 minutes.</li>
        <li>Titles can&apos;t be transferred, resold or auctioned, and there are no renewals.</li>
        <li>Two spellings that differ only in capitals, punctuation or spacing count as the same title.</li>
      </ul>

      <h2>What you may enter</h2>
      <p>You are responsible for the title, name, &ldquo;from&rdquo; line and dedication you enter. Don&apos;t enter anything that:</p>
      <ul>
        <li>insults, harasses or targets someone, or is hateful or sexual;</li>
        <li>contains web addresses, email addresses, phone numbers or social media handles;</li>
        <li>names a real person who wouldn&apos;t want to be named, or pretends to be someone else;</li>
        <li>suggests the title is a real award or has any real standing.</li>
      </ul>
      <p>
        Some entries are reviewed before they appear. We may refuse or remove an entry that breaks these rules. When we do, we
        refund the buyer as described on the <Link href="/refunds">refunds and removal</Link> page.
      </p>

      <h2>Payment</h2>
      <p>
        Prices are shown before you pay and are fixed per title type. Payment is taken on a secure checkout page run by our
        payment provider, Dodo Payments, which acts as the seller of record and may add sales tax where it applies. We never see
        your card details.
      </p>

      <h2>Certificates are public</h2>
      <p>
        Certificate pages, including the name, &ldquo;from&rdquo; line and dedication, are public and can be shared and indexed.
        Your email address is never shown. See the <Link href="/privacy">privacy</Link> page for what we store.
      </p>

      <h2>Changes and availability</h2>
      <p>
        We aim to keep the registry and every certificate online, but we can&apos;t promise it will be available forever or
        without interruption. If we ever change these terms, the new version applies to claims made after the change.
      </p>

      <h2>Contact</h2>
      <p>
        <Contact />
      </p>
    </Prose>
  );
}

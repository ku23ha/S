import type { Metadata } from "next";
import Link from "next/link";
import { Contact, Prose } from "@/components/Prose";
import { PRODUCT_NAME, businessContact } from "@/lib/copy";

export const metadata: Metadata = { title: "Contact us" };

export default function ContactPage() {
  const b = businessContact();
  return (
    <Prose title="Contact us" updated="23 November 2026">
      <p>
        Questions about a claim, a payment, a refund or a certificate? Write to <Contact />. We reply within one working day,
        usually much sooner.
      </p>
      <h2>Business details</h2>
      <ul>
        <li>
          Trading as <strong>{PRODUCT_NAME}</strong>
          {b.name ? <> ({b.name})</> : null}
        </li>
        <li>Website: worldsbest.cv</li>
        {b.address ? <li>Address: {b.address}</li> : null}
        {b.phone ? (
          <li>
            Phone: <a href={`tel:${b.phone.replace(/[^\d+]/g, "")}`}>{b.phone}</a>
          </li>
        ) : null}
        <li>
          Email: <Contact />
        </li>
      </ul>
      <h2>Quick links</h2>
      <ul>
        <li>
          <Link href="/refunds">Cancellation and refunds</Link>
        </li>
        <li>
          <Link href="/delivery">Delivery policy</Link>
        </li>
        <li>
          To ask for a certificate to be removed, use the &ldquo;Report this page&rdquo; link on that certificate. It is hidden
          straight away while we look at it.
        </li>
      </ul>
    </Prose>
  );
}

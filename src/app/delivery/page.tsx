import type { Metadata } from "next";
import Link from "next/link";
import { Contact, Prose } from "@/components/Prose";

export const metadata: Metadata = { title: "Delivery policy" };

export default function DeliveryPage() {
  return (
    <Prose title="Delivery policy" updated="23 November 2026">
      <p>Everything we sell is digital. Nothing is shipped, so there are no shipping charges and no customs or import duties.</p>
      <h2>What you receive</h2>
      <ul>
        <li>A public certificate page for the title, with a registry number.</li>
        <li>An email to the address you gave at checkout with the certificate link and a private link to fix mistakes.</li>
        <li>Share images, and the high-resolution A4 and US Letter print file if you added it.</li>
      </ul>
      <h2>When it arrives</h2>
      <ul>
        <li>Instantly after a successful payment: the success page shows the certificate as soon as the payment is confirmed, usually within seconds.</li>
        <li>The email normally arrives within a few minutes. If it hasn&apos;t arrived within an hour, check your spam folder, then contact <Contact />.</li>
        <li>Some entries are checked by hand first. Those appear within 24 hours, or are refunded in full.</li>
      </ul>
      <h2>Printing</h2>
      <p>
        We don&apos;t print or post certificates. The print file is made for home or shop printing. If you&apos;d like a frame or a
        card to go with it, see the <Link href="/gifts">gift shop</Link>, which links to other stores.
      </p>
      <h2>Didn&apos;t get it?</h2>
      <p>
        If a payment went through and you didn&apos;t receive the certificate, write to <Contact /> with the email you paid with.
        We&apos;ll send it again or refund you in full. See <Link href="/refunds">cancellation and refunds</Link>.
      </p>
    </Prose>
  );
}

import type { Metadata } from "next";
import { Contact, Prose } from "@/components/Prose";
import { PRODUCT_NAME } from "@/lib/copy";

export const metadata: Metadata = { title: `Privacy` };

export default function PrivacyPage() {
  return (
    <Prose title="Privacy" updated="22 November 2026">
      <p>
        {PRODUCT_NAME} keeps as little about you as it can. There are no accounts, no advertising trackers and no cookies for
        visitors.
      </p>

      <h2>What we store when you claim a title</h2>
      <ul>
        <li>
          <strong>Your email address.</strong> Used to send the certificate link, the private link for fixing typos, and refund
          notices. It is never shown on any page or shared with other buyers.
        </li>
        <li>
          <strong>The name, &ldquo;from&rdquo; line and dedication you enter.</strong> These appear publicly on the certificate,
          its share images and the registry. Please only enter what you&apos;re happy to have public.
        </li>
        <li>
          <strong>Payment references.</strong> Payment is handled by Dodo Payments on its own checkout page. We store only the
          payment and checkout ids it gives us, never card details.
        </li>
      </ul>

      <h2>What we record about visits</h2>
      <ul>
        <li>
          <strong>Anonymous usage events</strong> (for example &ldquo;a title was searched&rdquo; or &ldquo;a certificate was
          shared&rdquo;) through PostHog. They are tied to a random id that lasts only for your browser session, not to who you
          are, and never include names, emails or private links. We don&apos;t record sessions or use cookies for this.
        </li>
        <li>
          <strong>Certificate view counts.</strong> To count unique views we store a one-way hash of your IP address, browser and
          the date. The hash changes every day and can&apos;t be turned back into your IP address.
        </li>
        <li>
          <strong>Abuse protection.</strong> To limit repeated requests we store a one-way hash of your IP address with a
          request count for up to 30 days.
        </li>
        <li>
          <strong>Reports.</strong> If you report a page, we store your reason and, only if you give it, your email address so we
          can reply.
        </li>
      </ul>

      <h2>Who processes data for us</h2>
      <ul>
        <li>Vercel (hosting)</li>
        <li>Supabase (database)</li>
        <li>Dodo Payments (checkout and payments)</li>
        <li>Resend (sending email)</li>
        <li>PostHog (anonymous usage events)</li>
      </ul>

      <h2>Your choices</h2>
      <ul>
        <li>Anyone named on a certificate can ask for it to be removed with the &ldquo;Report this page&rdquo; link.</li>
        <li>
          To see, correct or delete what we hold about you, including your email address, contact us at <Contact />.
        </li>
      </ul>
    </Prose>
  );
}

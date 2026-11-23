import type { Metadata } from "next";
import { Contact, Prose } from "@/components/Prose";

export const metadata: Metadata = { title: `Cancellation and refunds` };

export default function RefundsPage() {
  return (
    <Prose title="Cancellation and refunds" updated="23 November 2026">
      <h2>Cancelling</h2>
      <p>
        You can cancel any time before you pay: just close the checkout, and the title is released after 15 minutes. Because the
        certificate is delivered instantly and the title is then held for your recipient alone, a completed claim can&apos;t be
        cancelled for change of mind. If something went wrong, we fix it or refund you, as below.
      </p>
      <h2>When you get a refund automatically</h2>
      <ul>
        <li>
          <strong>Someone else got there first.</strong> A title is held for you for 15 minutes while you pay. If your payment
          arrives after that and someone else has claimed the title in the meantime, we refund you in full and email you a few
          titles that are still free.
        </li>
        <li>
          <strong>Your entry doesn&apos;t pass review.</strong> Some entries are checked by hand before they appear. If we
          can&apos;t approve yours, we refund you in full, usually within 24 hours.
        </li>
        <li>
          <strong>We remove a certificate that breaks the rules.</strong> Reported pages are reviewed within 48 hours. If we take
          one down, the buyer is refunded.
        </li>
      </ul>

      <h2>Fixing a mistake</h2>
      <p>
        The email you receive after paying has a private link. For 24 hours after the claim you can use it to fix the name, the
        &ldquo;from&rdquo; line or the dedication. Changes may be checked again before they appear.
      </p>

      <h2>Removal</h2>
      <ul>
        <li>Anyone named on a certificate can ask for it to be removed, using the &ldquo;Report this page&rdquo; link on the certificate. The page is hidden straight away while we look at it.</li>
        <li>A removed title becomes free for someone else to claim. Its registry number is retired and never reused.</li>
      </ul>

      <h2>Other requests</h2>
      <p>
        For anything else, including a refund request we haven&apos;t covered here, contact us at <Contact /> within 30 days of
        paying. Approved refunds are issued within 5 to 7 working days. Payments are
        handled by our payment provider, and refunds go back to the card or method you paid with. How long that takes depends on
        your bank.
      </p>
    </Prose>
  );
}

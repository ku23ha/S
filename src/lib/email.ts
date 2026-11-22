/**
 * The one transactional email, plus the refund notice. Resend (resend.com/docs,
 * read 2026-11-22): resend.emails.send({ from, to, subject, html, text },
 * { idempotencyKey }) returns { data, error } rather than throwing; a repeat
 * with the same key within 24 hours is not sent again.
 * The buyer's address is never logged.
 */
import { DISCLAIMER, PRODUCT_NAME } from "@/lib/copy";
import { formatRegistryNo, fullTitle } from "@/lib/format";
import { errorSummary } from "@/lib/log";

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Same key, same email: Resend sends it once. */
  idempotencyKey: string;
}

export interface EmailSender {
  send(email: OutgoingEmail): Promise<void>;
}

export const sentInDev: OutgoingEmail[] = [];

function createResendSender(apiKey: string, from: string): EmailSender {
  return {
    async send(email) {
      const { Resend } = await import("resend");
      const resend = new Resend(apiKey);
      const { error } = await resend.emails.send(
        { from, to: email.to, subject: email.subject, html: email.html, text: email.text },
        { idempotencyKey: email.idempotencyKey },
      );
      if (error) throw new Error(`Resend: ${error.name}: ${error.message}`);
    },
  };
}

function createDevSender(): EmailSender {
  return {
    async send(email) {
      sentInDev.push(email);
      console.info(`[dev email] "${email.subject}" (${email.idempotencyKey})`);
    },
  };
}

let override: EmailSender | undefined;

export function getEmailSender(): EmailSender {
  if (override) return override;
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (key && from) return createResendSender(key, from);
  if (process.env.NODE_ENV !== "production") return createDevSender();
  throw new Error("Email is not configured: set RESEND_API_KEY and EMAIL_FROM");
}

/** Tests only. */
export function setEmailSenderForTests(s: EmailSender | undefined): void {
  override = s;
}

/** Send with up to three attempts. Never throws: the success page already shows the link. */
export async function sendWithRetry(email: OutgoingEmail, attempts = 3): Promise<boolean> {
  for (let i = 1; i <= attempts; i++) {
    try {
      await getEmailSender().send(email);
      return true;
    } catch (err) {
      console.error(`email send failed (attempt ${i}/${attempts})`, errorSummary(err));
      if (i < attempts) await new Promise((r) => setTimeout(r, 250 * 2 ** (i - 1)));
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function layout(bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#fafaf9;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#171717">
<div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e7e5e4;border-radius:12px;padding:24px">
<p style="margin:0 0 16px;font-size:12px;letter-spacing:.15em;text-transform:uppercase;color:#92400e">${escapeHtml(PRODUCT_NAME)}</p>
${bodyHtml}
<p style="margin:24px 0 0;font-size:12px;color:#57534e">${escapeHtml(DISCLAIMER)}</p>
</div></body></html>`;
}

const button = (href: string, label: string) =>
  `<p style="margin:20px 0"><a href="${escapeHtml(href)}" style="display:inline-block;background:#171717;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600">${escapeHtml(label)}</a></p>`;

export function claimEmail(p: {
  to: string;
  titleId: string;
  titleDisplay: string;
  recipientName: string;
  registryNo: number | null;
  certificateUrl: string;
  manageUrl: string;
  inReview: boolean;
}): OutgoingEmail {
  const title = fullTitle(p.titleDisplay);
  const subject = p.inReview ? `Your claim for ${title} is in review` : `${title} now belongs to ${p.recipientName}`;
  const lead = p.inReview
    ? `Your payment for <strong>${escapeHtml(title)}</strong> went through. We review some entries by hand, and this one will be checked within 24 hours. If we can't approve it, you get a full refund.`
    : `<strong>${escapeHtml(title)}</strong> now belongs to <strong>${escapeHtml(p.recipientName)}</strong>, entered as ${escapeHtml(formatRegistryNo(p.registryNo))}. Nobody else can hold it.`;
  const html = layout(`<h1 style="margin:0 0 12px;font-size:22px;line-height:1.3">${escapeHtml(subject)}</h1>
<p style="margin:0;line-height:1.5">${lead}</p>
${button(p.certificateUrl, "Open the certificate")}
<p style="margin:0;line-height:1.5;font-size:14px">Share that link, or show it in person. Spotted a typo in the name or dedication? You can fix it within 24 hours here: <a href="${escapeHtml(p.manageUrl)}">${escapeHtml(p.manageUrl)}</a>. Keep this link private.</p>`);
  const text = [
    subject,
    "",
    p.inReview
      ? `Your payment for ${title} went through. We review some entries by hand; this one will be checked within 24 hours. If we can't approve it, you get a full refund.`
      : `${title} now belongs to ${p.recipientName}, entered as ${formatRegistryNo(p.registryNo)}. Nobody else can hold it.`,
    "",
    `Certificate: ${p.certificateUrl}`,
    `Fix a typo within 24 hours (keep private): ${p.manageUrl}`,
    "",
    DISCLAIMER,
  ].join("\n");
  return { to: p.to, subject, html, text, idempotencyKey: `claim/${p.titleId}` };
}

export function refundEmail(p: {
  to: string;
  titleId: string;
  titleDisplay: string;
  variants: { display: string; claimUrl: string }[];
  searchUrl: string;
}): OutgoingEmail {
  const title = fullTitle(p.titleDisplay);
  const subject = `${title} was claimed first. You've been refunded`;
  const list = p.variants.length
    ? `<p style="margin:16px 0 8px">These are free right now:</p><ul style="padding-left:20px;margin:0">${p.variants
        .map((v) => `<li style="margin:4px 0"><a href="${escapeHtml(v.claimUrl)}">${escapeHtml(fullTitle(v.display))}</a></li>`)
        .join("")}</ul>`
    : "";
  const html = layout(`<h1 style="margin:0 0 12px;font-size:22px;line-height:1.3">${escapeHtml(subject)}</h1>
<p style="margin:0;line-height:1.5">Your payment arrived after the 15-minute hold ran out, and someone else claimed <strong>${escapeHtml(title)}</strong> in the meantime. We've refunded you in full.</p>
${list}
${button(p.searchUrl, "Search another title")}`);
  const text = [
    subject,
    "",
    `Your payment arrived after the 15-minute hold ran out, and someone else claimed ${title} in the meantime. We've refunded you in full.`,
    ...(p.variants.length ? ["", "Free right now:", ...p.variants.map((v) => `- ${fullTitle(v.display)}: ${v.claimUrl}`)] : []),
    "",
    `Search another title: ${p.searchUrl}`,
    "",
    DISCLAIMER,
  ].join("\n");
  return { to: p.to, subject, html, text, idempotencyKey: `refund/${p.titleId}` };
}

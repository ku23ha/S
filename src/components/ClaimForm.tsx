"use client";

import { type FormEvent, useEffect, useId, useState } from "react";
import { Certificate } from "@/components/Certificate";
import { TONES, type Tone, dedicationTemplates } from "@/lib/helper";
import {
  ClaimInput,
  DEDICATION_MAX,
  DEDICATION_MAX_WITH_PRINT,
  NAME_MAX,
} from "@/lib/claim";
import { formatPrice } from "@/lib/format";
import { analyticsId, track } from "@/lib/analytics-client";
import { getSessionRef } from "@/lib/session-ref";
import { PRINT_ADDON_CENTS, type Tier } from "@/lib/titles";

function remaining(untilIso: string, now: number): string {
  const ms = Math.max(0, new Date(untilIso).getTime() - now);
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** The buyer's own hold, shown only after checkout has started. */
function HeldPanel({
  checkoutUrl,
  reservedUntil,
}: {
  checkoutUrl: string;
  reservedUntil: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const left = remaining(reservedUntil, now);
  const expired = left === "0:00";
  return (
    <div
      className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-neutral-900"
      role="status"
    >
      {expired ? (
        <p>
          Your hold has ended. If you finished paying, we&apos;ll still complete
          the claim or refund you.
        </p>
      ) : (
        <>
          <p>
            This title is held for you for{" "}
            <span className="font-semibold tabular-nums">{left}</span> while you
            pay.
          </p>
          <a
            href={checkoutUrl}
            className="mt-3 inline-block font-semibold underline"
          >
            Continue to payment
          </a>
        </>
      )}
    </div>
  );
}

type FieldErrors = Partial<
  Record<
    "recipientName" | "giverName" | "dedication" | "email" | "form",
    string
  >
>;

/**
 * Collects the claim details and starts checkout. The price shown here is for
 * display only; the server looks it up again from the title's tier.
 */
export function ClaimForm({
  titleDisplay,
  basePriceCents,
  tier,
  refSlug,
}: {
  titleDisplay: string;
  basePriceCents: number;
  tier: Tier;
  refSlug?: string;
}) {
  const id = useId();
  const [recipientName, setRecipientName] = useState("");
  const [giverName, setGiverName] = useState("");
  const [dedication, setDedication] = useState("");
  const [email, setEmail] = useState("");
  const [addonPrint, setAddonPrint] = useState(false);
  const [tone, setTone] = useState<Tone | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [held, setHeld] = useState<{
    checkoutUrl: string;
    reservedUntil: string;
  } | null>(null);

  const dedicationMax = addonPrint ? DEDICATION_MAX_WITH_PRINT : DEDICATION_MAX;
  const total = basePriceCents + (addonPrint ? PRINT_ADDON_CENTS : 0);

  useEffect(() => {
    track("claim_started", {
      tier,
      price_cents: basePriceCents,
      ref_slug: refSlug || getSessionRef(),
    });
  }, [tier, basePriceCents, refSlug]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = ClaimInput.safeParse({
      title: titleDisplay,
      recipientName,
      giverName,
      dedication,
      email,
      addonPrint,
      refSlug: refSlug || getSessionRef() || undefined,
      analyticsId: analyticsId(),
    });
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (
          (key === "recipientName" ||
            key === "giverName" ||
            key === "dedication" ||
            key === "email") &&
          !next[key]
        ) {
          next[key] = issue.message;
        }
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body: unknown = await res.json().catch(() => null);
      if (
        res.ok &&
        typeof body === "object" &&
        body !== null &&
        "checkoutUrl" in body &&
        typeof body.checkoutUrl === "string" &&
        "reservedUntil" in body &&
        typeof body.reservedUntil === "string"
      ) {
        setHeld({
          checkoutUrl: body.checkoutUrl,
          reservedUntil: body.reservedUntil,
        });
        window.location.assign(body.checkoutUrl);
        return;
      }
      const message =
        typeof body === "object" &&
        body !== null &&
        "error" in body &&
        typeof body.error === "string"
          ? body.error
          : "Something went wrong. Please try again.";
      setErrors({ form: message });
    } catch {
      setErrors({ form: "Something went wrong. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  if (held) {
    return (
      <HeldPanel
        checkoutUrl={held.checkoutUrl}
        reservedUntil={held.reservedUntil}
      />
    );
  }

  const input =
    "mt-1 block w-full rounded-lg border border-neutral-300 bg-white px-3 py-3 text-base outline-none focus:border-neutral-900 focus:ring-2 focus:ring-amber-300 dark:border-neutral-700 dark:bg-neutral-950";
  const err = "mt-1 text-sm text-red-700 dark:text-red-400";

  // Live preview: the buyer sees their person's name on the certificate as they type.
  const preview = (
    <div aria-label="Preview of the certificate" role="group">
      <Certificate
        titleDisplay={titleDisplay}
        recipientName={recipientName.trim() || "Their name"}
        registryNo={null}
        claimedAt={null}
        giverName={giverName.trim() || null}
        dedication={dedication.trim() || null}
        titleAs="p"
        footerNote="The day you give it"
      />
      <p className="mt-2 text-center text-xs text-muted">
        Preview. The registry number is added when the claim completes.
      </p>
    </div>
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[1.05fr_1fr] lg:items-start">
      <div className="hidden lg:sticky lg:top-24 lg:block">{preview}</div>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <div>
          <label htmlFor={`${id}-to`} className="font-medium">
            Who is it for?
          </label>
          <input
            id={`${id}-to`}
            className={input}
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            maxLength={NAME_MAX}
            autoComplete="off"
            required
            aria-invalid={!!errors.recipientName}
            aria-describedby={errors.recipientName ? `${id}-to-err` : undefined}
          />
          {errors.recipientName && (
            <p id={`${id}-to-err`} className={err}>
              {errors.recipientName}
            </p>
          )}
        </div>

        <div>
          <label htmlFor={`${id}-from`} className="font-medium">
            From{" "}
            <span className="font-normal text-neutral-500">(optional)</span>
          </label>
          <input
            id={`${id}-from`}
            className={input}
            value={giverName}
            onChange={(e) => setGiverName(e.target.value)}
            maxLength={NAME_MAX}
            autoComplete="name"
            aria-invalid={!!errors.giverName}
          />
          {errors.giverName && <p className={err}>{errors.giverName}</p>}
        </div>

        <div>
          <label htmlFor={`${id}-ded`} className="font-medium">
            Dedication{" "}
            <span className="font-normal text-neutral-500">(optional)</span>
          </label>
          <textarea
            id={`${id}-ded`}
            className={`${input} min-h-24`}
            value={dedication}
            onChange={(e) => setDedication(e.target.value)}
            maxLength={dedicationMax}
            rows={3}
            placeholder="Why are they the best? An inside joke, a memory, the line only you would write."
            aria-invalid={!!errors.dedication}
          />
          <p className="mt-1 flex justify-between gap-3 text-sm text-neutral-500">
            <span>Personal beats perfect. It&apos;s the part they&apos;ll reread.</span>
            <span className="shrink-0">
              {[...dedication].length}/{dedicationMax}
            </span>
          </p>
          <div className="mt-2">
            <p className="text-sm text-neutral-600">Need words? Pick a tone, then tap a line to use it and make it yours.</p>
            <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Tone for suggested lines">
              {TONES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={tone === t.id}
                  onClick={() => setTone(tone === t.id ? null : t.id)}
                  className={`rounded-full border px-3 py-1 text-sm transition ${
                    tone === t.id ? "border-ink bg-ink text-paper" : "border-line bg-white hover:border-gold"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {tone && (
              <ul className="mt-2 flex flex-col gap-1.5">
                {dedicationTemplates(tone, recipientName).map((line) => (
                  <li key={line}>
                    <button
                      type="button"
                      onClick={() => setDedication(line.slice(0, dedicationMax))}
                      className="w-full rounded-lg border border-gold/40 bg-[#fffaf0] px-3 py-2 text-left text-sm hover:border-gold"
                    >
                      &ldquo;{line}&rdquo;
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {errors.dedication && <p className={err}>{errors.dedication}</p>}
        </div>

        <div>
          <label htmlFor={`${id}-email`} className="font-medium">
            Your email
          </label>
          <input
            id={`${id}-email`}
            type="email"
            inputMode="email"
            autoComplete="email"
            className={input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            aria-invalid={!!errors.email}
            aria-describedby={`${id}-email-hint`}
          />
          <p id={`${id}-email-hint`} className="mt-1 text-sm text-neutral-500">
            We send the certificate link here. It is never shown on the page.
          </p>
          {errors.email && <p className={err}>{errors.email}</p>}
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-neutral-300 p-3 dark:border-neutral-700">
          <input
            type="checkbox"
            checked={addonPrint}
            onChange={(e) => setAddonPrint(e.target.checked)}
            className="mt-1 h-5 w-5 shrink-0"
          />
          <span>
            <span className="font-medium">
              Add a print file (+{formatPrice(PRINT_ADDON_CENTS)})
            </span>
            <span className="block text-sm text-neutral-600 dark:text-neutral-400">
              High-resolution A4 and US Letter, and a dedication of up to{" "}
              {DEDICATION_MAX_WITH_PRINT} characters.
            </span>
          </span>
        </label>

        <div className="lg:hidden">{preview}</div>

        <div className="flex items-center justify-between border-t border-neutral-200 pt-4 text-lg dark:border-neutral-800">
          <span>Total</span>
          <span className="font-semibold">{formatPrice(total)}</span>
        </div>

        {errors.form && (
          <p
            className="rounded-lg bg-red-50 p-3 text-red-900 dark:bg-red-950 dark:text-red-100"
            role="alert"
          >
            {errors.form}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-neutral-900 px-5 py-4 text-lg font-semibold text-white hover:bg-neutral-700 disabled:opacity-60 dark:bg-white dark:text-neutral-900"
        >
          {submitting ? "Starting checkout…" : `Pay ${formatPrice(total)}`}
        </button>
        <p className="text-center text-sm text-neutral-500">
          One-time payment on a secure checkout page. No account needed. Delivered instantly by email.{" "}
          <a href="/refunds" className="underline underline-offset-2">
            Refund policy
          </a>
        </p>
      </form>
    </div>
  );
}

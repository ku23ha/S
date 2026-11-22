"use client";

import { type FormEvent, useId, useState } from "react";
import { ClaimInput, DEDICATION_MAX, DEDICATION_MAX_WITH_PRINT, NAME_MAX } from "@/lib/claim";
import { formatPrice } from "@/lib/format";
import { PRINT_ADDON_CENTS } from "@/lib/titles";

type FieldErrors = Partial<Record<"recipientName" | "giverName" | "dedication" | "email" | "form", string>>;

/**
 * Collects the claim details and starts checkout. The price shown here is for
 * display only; the server looks it up again from the title's tier.
 */
export function ClaimForm({
  titleDisplay,
  basePriceCents,
  refSlug,
}: {
  titleDisplay: string;
  basePriceCents: number;
  refSlug?: string;
}) {
  const id = useId();
  const [recipientName, setRecipientName] = useState("");
  const [giverName, setGiverName] = useState("");
  const [dedication, setDedication] = useState("");
  const [email, setEmail] = useState("");
  const [addonPrint, setAddonPrint] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const dedicationMax = addonPrint ? DEDICATION_MAX_WITH_PRINT : DEDICATION_MAX;
  const total = basePriceCents + (addonPrint ? PRINT_ADDON_CENTS : 0);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = ClaimInput.safeParse({
      title: titleDisplay,
      recipientName,
      giverName,
      dedication,
      email,
      addonPrint,
      refSlug,
    });
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if ((key === "recipientName" || key === "giverName" || key === "dedication" || key === "email") && !next[key]) {
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
      if (res.ok && typeof body === "object" && body !== null && "checkoutUrl" in body && typeof body.checkoutUrl === "string") {
        window.location.assign(body.checkoutUrl);
        return;
      }
      const message =
        res.status === 404
          ? "Checkout isn't open yet."
          : typeof body === "object" && body !== null && "error" in body && typeof body.error === "string"
            ? body.error
            : "Something went wrong. Please try again.";
      setErrors({ form: message });
    } catch {
      setErrors({ form: "Something went wrong. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  const input =
    "mt-1 block w-full rounded-lg border border-neutral-300 bg-white px-3 py-3 text-base outline-none focus:border-neutral-900 focus:ring-2 focus:ring-amber-300 dark:border-neutral-700 dark:bg-neutral-950";
  const err = "mt-1 text-sm text-red-700 dark:text-red-400";

  return (
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
          From <span className="font-normal text-neutral-500">(optional)</span>
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
          Dedication <span className="font-normal text-neutral-500">(optional)</span>
        </label>
        <textarea
          id={`${id}-ded`}
          className={`${input} min-h-24`}
          value={dedication}
          onChange={(e) => setDedication(e.target.value)}
          maxLength={dedicationMax}
          rows={3}
          aria-invalid={!!errors.dedication}
        />
        <p className="mt-1 text-right text-sm text-neutral-500">
          {[...dedication].length}/{dedicationMax}
        </p>
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
          <span className="font-medium">Add a print file (+{formatPrice(PRINT_ADDON_CENTS)})</span>
          <span className="block text-sm text-neutral-600 dark:text-neutral-400">
            High-resolution A4 and US Letter, and a dedication of up to {DEDICATION_MAX_WITH_PRINT} characters.
          </span>
        </span>
      </label>

      <div className="flex items-center justify-between border-t border-neutral-200 pt-4 text-lg dark:border-neutral-800">
        <span>Total</span>
        <span className="font-semibold">{formatPrice(total)}</span>
      </div>

      {errors.form && (
        <p className="rounded-lg bg-red-50 p-3 text-red-900 dark:bg-red-950 dark:text-red-100" role="alert">
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
        One-time payment on a secure checkout page. No account needed.
      </p>
    </form>
  );
}

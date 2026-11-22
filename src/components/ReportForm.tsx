"use client";

import { type FormEvent, useId, useState } from "react";
import { track } from "@/lib/analytics-client";
import { REPORT_REASONS } from "@/lib/reports";

type Reason = keyof typeof REPORT_REASONS;

export function ReportForm({ slug }: { slug: string }) {
  const id = useId();
  const [reason, setReason] = useState<Reason | "">("");
  const [details, setDetails] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<{ kind: "idle" | "sending" | "sent" } | { kind: "error"; message: string }>({ kind: "idle" });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!reason) {
      setState({ kind: "error", message: "Choose a reason." });
      return;
    }
    setState({ kind: "sending" });
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, reason, details, reporterEmail: email }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setState({ kind: "error", message: body.error ?? "Something went wrong. Please try again." });
        return;
      }
      track("report_submitted", { slug });
      setState({ kind: "sent" });
    } catch {
      setState({ kind: "error", message: "Something went wrong. Please try again." });
    }
  }

  if (state.kind === "sent") {
    return (
      <p role="status" className="rounded-lg bg-emerald-50 p-4 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
        Thank you. We review every report and act on pages that break the rules within 48 hours.
      </p>
    );
  }

  const input =
    "mt-1 block w-full rounded-lg border border-neutral-300 bg-white px-3 py-3 text-base dark:border-neutral-700 dark:bg-neutral-950";

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <fieldset>
        <legend className="font-medium">What&apos;s wrong?</legend>
        <div className="mt-2 flex flex-col gap-2">
          {(Object.entries(REPORT_REASONS) as [Reason, string][]).map(([value, label]) => (
            <label key={value} className="flex items-center gap-3 rounded-lg border border-neutral-300 p-3 dark:border-neutral-700">
              <input type="radio" name="reason" value={value} checked={reason === value} onChange={() => setReason(value)} className="h-5 w-5" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor={`${id}-details`} className="font-medium">
          Details <span className="font-normal text-neutral-500">(optional)</span>
        </label>
        <textarea id={`${id}-details`} className={`${input} min-h-24`} maxLength={500} value={details} onChange={(e) => setDetails(e.target.value)} />
      </div>
      <div>
        <label htmlFor={`${id}-email`} className="font-medium">
          Your email <span className="font-normal text-neutral-500">(optional, if you&apos;d like a reply)</span>
        </label>
        <input id={`${id}-email`} type="email" autoComplete="email" className={input} value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      {state.kind === "error" && (
        <p role="alert" className="text-red-700 dark:text-red-400">
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={state.kind === "sending"}
        className="rounded-xl bg-neutral-900 px-5 py-3 text-base font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
      >
        {state.kind === "sending" ? "Sending…" : "Send report"}
      </button>
    </form>
  );
}

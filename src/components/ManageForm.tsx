"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useId, useState } from "react";
import { DEDICATION_MAX, DEDICATION_MAX_WITH_PRINT, ManageInput, NAME_MAX } from "@/lib/claim";

export function ManageForm({
  token,
  initial,
  addonPrint,
}: {
  token: string;
  initial: { recipientName: string; giverName: string; dedication: string };
  addonPrint: boolean;
}) {
  const id = useId();
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const dedicationMax = addonPrint ? DEDICATION_MAX_WITH_PRINT : DEDICATION_MAX;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = ManageInput.safeParse(values);
    if (!parsed.success) {
      setMessage({ kind: "error", text: parsed.error.issues[0]?.message ?? "Check the form." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/manage/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = (await res.json().catch(() => ({}))) as { status?: string; error?: string };
      if (!res.ok) {
        setMessage({ kind: "error", text: body.error ?? "Something went wrong. Please try again." });
        return;
      }
      setMessage({
        kind: "ok",
        text: body.status === "in_review" ? "Saved. The certificate is in review and will be checked within 24 hours." : "Saved.",
      });
      router.refresh();
    } catch {
      setMessage({ kind: "error", text: "Something went wrong. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  const input =
    "mt-1 block w-full rounded-lg border border-neutral-300 bg-white px-3 py-3 text-base outline-none focus:border-neutral-900 focus:ring-2 focus:ring-amber-300 dark:border-neutral-700 dark:bg-neutral-950";

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div>
        <label htmlFor={`${id}-to`} className="font-medium">
          Name on the certificate
        </label>
        <input
          id={`${id}-to`}
          className={input}
          maxLength={NAME_MAX}
          value={values.recipientName}
          onChange={(e) => setValues({ ...values, recipientName: e.target.value })}
        />
      </div>
      <div>
        <label htmlFor={`${id}-from`} className="font-medium">
          From <span className="font-normal text-neutral-500">(optional)</span>
        </label>
        <input
          id={`${id}-from`}
          className={input}
          maxLength={NAME_MAX}
          value={values.giverName}
          onChange={(e) => setValues({ ...values, giverName: e.target.value })}
        />
      </div>
      <div>
        <label htmlFor={`${id}-ded`} className="font-medium">
          Dedication <span className="font-normal text-neutral-500">(optional)</span>
        </label>
        <textarea
          id={`${id}-ded`}
          className={`${input} min-h-24`}
          rows={3}
          maxLength={dedicationMax}
          value={values.dedication}
          onChange={(e) => setValues({ ...values, dedication: e.target.value })}
        />
        <p className="mt-1 text-right text-sm text-neutral-500">
          {[...values.dedication].length}/{dedicationMax}
        </p>
      </div>
      {message && (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          className={message.kind === "error" ? "text-red-700 dark:text-red-400" : "text-emerald-800 dark:text-emerald-300"}
        >
          {message.text}
        </p>
      )}
      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-neutral-900 px-5 py-3 text-base font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
      >
        {saving ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}

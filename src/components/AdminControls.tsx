"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

async function post(url: string, body: unknown): Promise<string | null> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) return null;
    const b = (await res.json().catch(() => ({}))) as { error?: string };
    return b.error ?? `Failed (${res.status}).`;
  } catch {
    return "Network error.";
  }
}

export function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const err = await post("/api/admin/login", { password });
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    setPassword("");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <label htmlFor="admin-password" className="font-medium">
        Password
      </label>
      <input
        id="admin-password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="rounded-lg border border-neutral-300 bg-white px-3 py-3 text-base dark:border-neutral-700 dark:bg-neutral-950"
      />
      {error && (
        <p role="alert" className="text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy || !password}
        className="rounded-xl bg-neutral-900 px-5 py-3 font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export function AdminLogout() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await post("/api/admin/logout", {});
        router.refresh();
      }}
      className="text-sm underline underline-offset-4"
    >
      Sign out
    </button>
  );
}

const btn = "rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50";

/** Approve / reject / remove for one title, and dismiss for one report. */
export function TitleActions({ id, status, canApprove }: { id: string; status: string; canApprove: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<null | "reject" | "remove">(null);
  const [reason, setReason] = useState("");
  const [refund, setRefund] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: "approve" | "reject" | "remove") {
    setBusy(true);
    setError(null);
    const err = await post(`/api/admin/titles/${id}/${action}`, { reason, refund });
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    setMode(null);
    setReason("");
    router.refresh();
  }

  if (status !== "claimed" && status !== "in_review") return null;

  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {canApprove && (
          <button type="button" disabled={busy} onClick={() => run("approve")} className={`${btn} border-emerald-600 text-emerald-800 dark:text-emerald-300`}>
            Approve
          </button>
        )}
        {status === "in_review" && (
          <button type="button" disabled={busy} onClick={() => setMode("reject")} className={`${btn} border-red-600 text-red-800 dark:text-red-300`}>
            Reject and refund
          </button>
        )}
        <button type="button" disabled={busy} onClick={() => setMode("remove")} className={`${btn} border-neutral-400`}>
          Remove
        </button>
      </div>
      {mode && (
        <div className="flex flex-col gap-2 rounded-lg border border-neutral-300 p-3 dark:border-neutral-700">
          <label className="text-sm font-medium" htmlFor={`reason-${id}`}>
            Reason
          </label>
          <input
            id={`reason-${id}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            className="rounded border border-neutral-300 bg-white px-2 py-2 text-base dark:border-neutral-700 dark:bg-neutral-950"
          />
          {mode === "remove" && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={refund} onChange={(e) => setRefund(e.target.checked)} />
              Refund the buyer
            </label>
          )}
          <div className="flex gap-2">
            <button type="button" disabled={busy || !reason.trim()} onClick={() => run(mode)} className={`${btn} border-red-600`}>
              {mode === "reject" ? "Confirm reject" : "Confirm remove"}
            </button>
            <button type="button" onClick={() => setMode(null)} className={`${btn} border-neutral-300`}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

export function DismissReport({ id }: { id: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        onClick={async () => {
          const err = await post(`/api/admin/reports/${id}/dismiss`, {});
          if (err) setError(err);
          else router.refresh();
        }}
        className={`${btn} border-neutral-400`}
      >
        Dismiss report
      </button>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </>
  );
}

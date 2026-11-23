import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AdminLogin, AdminLogout, DismissReport, TitleActions } from "@/components/AdminControls";
import { type AdminTitle, dailyStats, openReports, reviewQueue, searchTitles } from "@/lib/admin";
import { ADMIN_COOKIE, verifySessionValue } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";
import { certificatePath, formatDate, formatPrice, formatRegistryNo, fullTitle } from "@/lib/format";

export const metadata: Metadata = { title: `Admin`, robots: { index: false, follow: false } };

type SP = Promise<Record<string, string | string[] | undefined>>;

function TitleCard({ t }: { t: AdminTitle }) {
  return (
    <li className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Link href={certificatePath(t.slug)} className="font-semibold underline-offset-4 [overflow-wrap:anywhere] hover:underline">
          {fullTitle(t.titleDisplay)}
        </Link>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium dark:bg-neutral-800">{t.status}</span>
      </div>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm [overflow-wrap:anywhere]">
        <dt className="text-neutral-500">Recipient</dt>
        <dd>{t.recipientName}</dd>
        {t.giverName && (
          <>
            <dt className="text-neutral-500">From</dt>
            <dd>{t.giverName}</dd>
          </>
        )}
        {t.dedication && (
          <>
            <dt className="text-neutral-500">Dedication</dt>
            <dd>{t.dedication}</dd>
          </>
        )}
        <dt className="text-neutral-500">Number</dt>
        <dd>
          {formatRegistryNo(t.registryNo) || "none"} · {t.tier} · {formatPrice(t.priceCents)}
        </dd>
        <dt className="text-neutral-500">Claimed</dt>
        <dd>{t.claimedAt ? formatDate(t.claimedAt) : "not yet"}</dd>
        {t.flags.length > 0 && (
          <>
            <dt className="text-neutral-500">Flags</dt>
            <dd className="text-red-700 dark:text-red-400">{t.flags.join(", ")}</dd>
          </>
        )}
        {t.openReports > 0 && (
          <>
            <dt className="text-neutral-500">Reports</dt>
            <dd>{t.openReports} open</dd>
          </>
        )}
        {t.removalReason && (
          <>
            <dt className="text-neutral-500">Reason</dt>
            <dd>{t.removalReason}</dd>
          </>
        )}
      </dl>
      <TitleActions id={t.id} status={t.status} canApprove={t.status === "in_review"} />
    </li>
  );
}

async function Dashboard({ searchParams }: { searchParams: SP }) {
  await connection();
  const store = await cookies();
  if (!verifySessionValue(store.get(ADMIN_COOKIE)?.value)) {
    return (
      <div className="mx-auto max-w-sm">
        <h1 className="text-2xl font-bold">Admin</h1>
        <div className="mt-6">
          <AdminLogin />
        </div>
      </div>
    );
  }

  const sp = await searchParams;
  const q = ((Array.isArray(sp.q) ? sp.q[0] : sp.q) ?? "").slice(0, 200);
  const db = await getDb();
  const [queue, reports, results, stats] = await Promise.all([
    reviewQueue(db),
    openReports(db),
    q ? searchTitles(db, q) : Promise.resolve([]),
    dailyStats(db, 14),
  ]);

  return (
    <div className="flex flex-col gap-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin</h1>
        <AdminLogout />
      </div>

      <section aria-labelledby="queue">
        <h2 id="queue" className="text-lg font-semibold">
          Review queue ({queue.length})
        </h2>
        {queue.length === 0 ? (
          <p className="mt-2 text-neutral-600 dark:text-neutral-400">Nothing waiting.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {queue.map((t) => (
              <TitleCard key={t.id} t={t} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="reports">
        <h2 id="reports" className="text-lg font-semibold">
          Open reports ({reports.length})
        </h2>
        {reports.length === 0 ? (
          <p className="mt-2 text-neutral-600 dark:text-neutral-400">No open reports.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {reports.map((r) => (
              <li key={r.id} className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
                <p className="font-semibold [overflow-wrap:anywhere]">
                  <Link href={certificatePath(r.slug)} className="underline-offset-4 hover:underline">
                    {fullTitle(r.titleDisplay)}
                  </Link>{" "}
                  <span className="text-xs font-normal text-neutral-500">({r.titleStatus})</span>
                </p>
                <p className="mt-1 text-sm [overflow-wrap:anywhere]">{r.reason}</p>
                <p className="mt-1 text-xs text-neutral-500">
                  {formatDate(r.createdAt)}
                  {r.hasReporterEmail ? " · reporter left an email (search the database to reply)" : ""}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <DismissReport id={r.id} />
                </div>
                <TitleActions id={r.titleId} status={r.titleStatus} canApprove={r.titleStatus === "in_review"} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="search">
        <h2 id="search" className="text-lg font-semibold">
          Search
        </h2>
        <form action="/admin" method="get" className="mt-2 flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Title, recipient, buyer email or payment id"
            aria-label="Search titles"
            className="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base dark:border-neutral-700 dark:bg-neutral-950"
          />
          <button type="submit" className="rounded-lg bg-neutral-900 px-4 font-semibold text-white dark:bg-white dark:text-neutral-900">
            Search
          </button>
        </form>
        {q && (
          <ul className="mt-3 flex flex-col gap-3">
            {results.length === 0 ? <li className="text-neutral-600">No matches.</li> : results.map((t) => <TitleCard key={t.id} t={t} />)}
          </ul>
        )}
      </section>

      <section aria-labelledby="stats">
        <h2 id="stats" className="text-lg font-semibold">
          Last 14 days (UTC)
        </h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Visitors and funnels are in PostHog.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm tabular-nums">
            <thead>
              <tr className="border-b border-neutral-300 dark:border-neutral-700">
                {["Day", "Searches", "Searchers", "Checkouts", "Claims", "Gross", "Share rate", "Loop claims", "Cert views"].map((h) => (
                  <th key={h} className="py-2 pr-3 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.map((d) => (
                <tr key={d.day} className="border-b border-neutral-100 dark:border-neutral-900">
                  <td className="py-2 pr-3">{d.day}</td>
                  <td className="pr-3">{d.searches}</td>
                  <td className="pr-3">{d.searchers}</td>
                  <td className="pr-3">{d.checkouts}</td>
                  <td className="pr-3">{d.claims}</td>
                  <td className="pr-3">{formatPrice(d.grossCents)}</td>
                  <td className="pr-3">{d.claims ? `${Math.round((100 * d.sharedClaims) / d.claims)}%` : "–"}</td>
                  <td className="pr-3">{d.loopClaims}</td>
                  <td className="pr-3">{d.certificateViews}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default function AdminPage({ searchParams }: { searchParams: SP }) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-neutral-100 dark:bg-neutral-900" />}>
        <Dashboard searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

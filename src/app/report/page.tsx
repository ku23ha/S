import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { ReportForm } from "@/components/ReportForm";
import { PRODUCT_NAME } from "@/lib/copy";
import { getDb } from "@/lib/db";
import { fullTitle } from "@/lib/format";
import { getCertificateBySlug } from "@/lib/queries";

export const metadata: Metadata = { title: `Report a page · ${PRODUCT_NAME}`, robots: { index: false } };

type SP = Promise<Record<string, string | string[] | undefined>>;

async function ReportBody({ searchParams }: { searchParams: SP }) {
  await connection();
  const sp = await searchParams;
  const slug = ((Array.isArray(sp.c) ? sp.c[0] : sp.c) ?? "").slice(0, 200);
  const cert = slug ? await getCertificateBySlug(await getDb(), slug) : null;
  if (!cert) {
    return <p>That certificate wasn&apos;t found. It may already have been removed.</p>;
  }
  return (
    <>
      <h1 className="text-2xl font-bold">Report a page</h1>
      <p className="mt-2 text-neutral-700 [overflow-wrap:anywhere] dark:text-neutral-300">
        You&apos;re reporting the certificate for {fullTitle(cert.titleDisplay)}. If it names you, choose the second option and the
        page is hidden straight away while we review it.
      </p>
      <div className="mt-6">
        <ReportForm slug={cert.slug} />
      </div>
    </>
  );
}

export default function ReportPage({ searchParams }: { searchParams: SP }) {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8">
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-neutral-100 dark:bg-neutral-900" />}>
        <ReportBody searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

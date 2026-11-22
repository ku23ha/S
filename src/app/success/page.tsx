import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Certificate } from "@/components/Certificate";
import { SearchBox } from "@/components/SearchBox";
import { PRODUCT_NAME } from "@/lib/copy";
import { getDb } from "@/lib/db";
import { ShareBar } from "@/components/ShareBar";
import { certificatePath, fullTitle, shareText } from "@/lib/format";
import { getTitleById } from "@/lib/queries";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = { title: `Thank you · ${PRODUCT_NAME}`, robots: { index: false } };

type SP = Promise<Record<string, string | string[] | undefined>>;

async function SuccessBody({ searchParams }: { searchParams: SP }) {
  await connection();
  const sp = await searchParams;
  const id = (Array.isArray(sp.id) ? sp.id[0] : sp.id) ?? "";
  const t = await getTitleById(await getDb(), id);

  if (!t) {
    return (
      <div>
        <h1 className="text-2xl font-bold">We couldn&apos;t find that claim</h1>
        <p className="mt-2">Check the link in your email, or search for the title below.</p>
        <div className="mt-6">
          <SearchBox />
        </div>
      </div>
    );
  }

  if (t.status === "reserved") {
    return (
      <div aria-live="polite">
        <AutoRefresh />
        <h1 className="text-2xl font-bold [overflow-wrap:anywhere]">Confirming your payment for {fullTitle(t.titleDisplay)}…</h1>
        <p className="mt-2 text-neutral-700 dark:text-neutral-300">
          This usually takes a few seconds. This page updates by itself, and we&apos;ll email you the certificate link.
        </p>
      </div>
    );
  }

  if (t.status === "claimed" || t.status === "in_review") {
    const inReview = t.status === "in_review";
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold">{inReview ? "Payment received" : "It's theirs"}</h1>
          <p className="mt-1 text-neutral-700 dark:text-neutral-300">
            {inReview
              ? "We review some entries by hand. This one will be checked within 24 hours; if we can't approve it, you get a full refund."
              : "The certificate link is on its way to your email too."}
          </p>
        </div>
        <Certificate
          titleDisplay={t.titleDisplay}
          recipientName={t.recipientName}
          registryNo={t.registryNo}
          claimedAt={t.claimedAt}
          giverName={t.giverName}
          dedication={t.dedication}
          inReview={inReview}
        />
        {!inReview && (
          <>
            <ShareBar slug={t.slug} text={shareText(t)} siteUrl={siteUrl()} />
            <Link href={certificatePath(t.slug)} className="text-center underline underline-offset-4">
              Open the certificate page
            </Link>
          </>
        )}
        <section aria-labelledby="another">
          <h2 id="another" className="text-lg font-semibold">
            Claim another
          </h2>
          <div className="mt-3">
            <SearchBox />
          </div>
        </section>
      </div>
    );
  }

  // expired, rejected or removed
  return (
    <div>
      <h1 className="text-2xl font-bold [overflow-wrap:anywhere]">{fullTitle(t.titleDisplay)} wasn&apos;t claimed</h1>
      <p className="mt-2 text-neutral-700 dark:text-neutral-300">
        {t.status === "expired"
          ? "The 15-minute hold ran out before payment arrived. If you paid, we'll either complete the claim or refund you in full, and email you either way."
          : "This claim was not completed. If you paid, you'll be refunded in full."}
      </p>
      <div className="mt-6">
        <SearchBox initialValue={t.titleDisplay} />
      </div>
    </div>
  );
}

export default function SuccessPage({ searchParams }: { searchParams: SP }) {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8">
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-neutral-100 dark:bg-neutral-900" />}>
        <SuccessBody searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

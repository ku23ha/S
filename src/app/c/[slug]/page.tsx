import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Certificate } from "@/components/Certificate";
import { SearchBox } from "@/components/SearchBox";
import Link from "next/link";
import { ShareBar } from "@/components/ShareBar";
import { CertificateViewTracker } from "@/components/Tracking";
import { decodeSlug } from "@/lib/cert-routes";
import { DISCLAIMER, PRODUCT_NAME } from "@/lib/copy";
import { getDb } from "@/lib/db";
import { certificatePath, fullTitle, shareText } from "@/lib/format";
import { getCertificateBySlug } from "@/lib/queries";
import { siteUrl } from "@/lib/site";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  await connection();
  const { slug } = await params;
  const cert = await getCertificateBySlug(await getDb(), decodeSlug(slug)).catch(() => null);
  if (!cert) return { title: `Certificate`, robots: { index: false } };

  const inReview = cert.status === "in_review";
  const title = inReview ? fullTitle(cert.titleDisplay) : `${fullTitle(cert.titleDisplay)}: ${cert.recipientName}`;
  const description = inReview
    ? `This certificate is in review. ${DISCLAIMER}`
    : `${shareText(cert)} ${DISCLAIMER}`;
  return {
    title,
    description,
    alternates: { canonical: certificatePath(cert.slug) },
    robots: inReview ? { index: false } : undefined,
    openGraph: { title, description, type: "website", siteName: PRODUCT_NAME, url: certificatePath(cert.slug) },
    twitter: { card: "summary_large_image", title, description },
  };
}

async function CertificateBody({ params }: { params: Params }) {
  await connection();
  const { slug } = await params;
  const cert = await getCertificateBySlug(await getDb(), decodeSlug(slug));
  if (!cert) notFound();

  const inReview = cert.status === "in_review";
  return (
    <>
      <Certificate
        titleDisplay={cert.titleDisplay}
        recipientName={cert.recipientName}
        registryNo={cert.registryNo}
        claimedAt={cert.claimedAt}
        giverName={cert.giverName}
        dedication={cert.dedication}
        inReview={inReview}
      />
      {!inReview && (
        <div className="mt-5">
          <CertificateViewTracker slug={cert.slug} />
          <ShareBar slug={cert.slug} text={shareText(cert)} siteUrl={siteUrl()} />
        </div>
      )}
      <section aria-labelledby="your-title" className="mt-10">
        <h2 id="your-title" className="text-xl font-semibold">
          Is your title taken?
        </h2>
        <div className="mt-3">
          <SearchBox source="certificate" autoFocus refSlug={cert.slug} label="Search your own World's Best title" />
        </div>
      </section>
      <p className="mt-10 text-center text-sm">
        <Link href={`/report?${new URLSearchParams({ c: cert.slug }).toString()}`} className="text-neutral-600 underline underline-offset-4 dark:text-neutral-400">
          Report this page
        </Link>
      </p>
    </>
  );
}

export default function CertificatePage({ params }: { params: Params }) {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8">
      <Suspense fallback={<div className="aspect-[4/5] animate-pulse rounded-2xl bg-amber-50" aria-hidden="true" />}>
        <CertificateBody params={params} />
      </Suspense>
    </main>
  );
}

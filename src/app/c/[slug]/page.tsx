import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Certificate } from "@/components/Certificate";
import { SearchBox } from "@/components/SearchBox";
import { ShareBar } from "@/components/ShareBar";
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
  if (!cert) return { title: `Certificate · ${PRODUCT_NAME}`, robots: { index: false } };

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
          <ShareBar slug={cert.slug} text={shareText(cert)} siteUrl={siteUrl()} />
        </div>
      )}
      <section aria-labelledby="your-title" className="mt-10">
        <h2 id="your-title" className="text-xl font-semibold">
          Is your title taken?
        </h2>
        <div className="mt-3">
          <SearchBox autoFocus refSlug={cert.slug} label="Search your own World's Best title" />
        </div>
      </section>
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

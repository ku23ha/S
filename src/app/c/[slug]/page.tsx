import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Certificate } from "@/components/Certificate";
import { SearchBox } from "@/components/SearchBox";
import { PRODUCT_NAME } from "@/lib/copy";
import { getDb } from "@/lib/db";
import { getCertificateBySlug } from "@/lib/queries";

export const metadata: Metadata = { title: `Certificate · ${PRODUCT_NAME}` };

type Params = Promise<{ slug: string }>;

function decodeSlug(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

async function CertificateBody({ params }: { params: Params }) {
  await connection();
  const { slug } = await params;
  const cert = await getCertificateBySlug(await getDb(), decodeSlug(slug).slice(0, 200));
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

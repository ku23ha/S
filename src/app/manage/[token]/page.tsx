import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Certificate } from "@/components/Certificate";
import { ManageForm } from "@/components/ManageForm";
import { TrackedDownload } from "@/components/Tracking";
import { canEdit } from "@/lib/claim";
import { getDb } from "@/lib/db";
import { certificatePath, formatDate } from "@/lib/format";
import { getTitleByManageToken } from "@/lib/queries";

// The URL holds a private token: keep it out of search engines and Referer headers.
export const metadata: Metadata = {
  title: `Manage your certificate`,
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type Params = Promise<{ token: string }>;

async function ManageBody({ params }: { params: Params }) {
  await connection();
  const { token } = await params;
  const t = await getTitleByManageToken(await getDb(), token);
  if (!t) {
    return (
      <div>
        <h1 className="text-2xl font-bold">This link isn&apos;t valid</h1>
        <p className="mt-2">Check the link in your email. If the title was removed or refunded, this page no longer works.</p>
      </div>
    );
  }

  const editable = canEdit(t.claimedAt);
  const editUntil = t.claimedAt ? new Date(new Date(t.claimedAt).getTime() + 24 * 3600 * 1000) : null;
  const encodedSlug = encodeURIComponent(t.slug);
  const printHref = (size: "a4" | "letter") =>
    `/api/cert/${encodedSlug}/print?${new URLSearchParams({ token, size }).toString()}`;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">Your certificate</h1>
        <p className="mt-1 text-neutral-700 dark:text-neutral-300">
          Keep this page private. Anyone with the link can edit the certificate while editing is open.
        </p>
      </div>

      <Certificate
        titleDisplay={t.titleDisplay}
        recipientName={t.recipientName}
        registryNo={t.registryNo}
        claimedAt={t.claimedAt}
        giverName={t.giverName}
        dedication={t.dedication}
        inReview={t.status === "in_review"}
      />

      {t.status === "claimed" && (
        <Link href={certificatePath(t.slug)} className="text-center underline underline-offset-4">
          Open the public certificate page
        </Link>
      )}

      {t.addonPrint && t.status === "claimed" && (
        <section aria-labelledby="print">
          <h2 id="print" className="text-lg font-semibold">
            Print file
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <TrackedDownload
              kind="print_a4"
              href={printHref("a4")}
              className="rounded-lg border border-neutral-300 px-3 py-3 text-center font-medium dark:border-neutral-700"
            >
              Download A4
            </TrackedDownload>
            <TrackedDownload
              kind="print_letter"
              href={printHref("letter")}
              className="rounded-lg border border-neutral-300 px-3 py-3 text-center font-medium dark:border-neutral-700"
            >
              Download US Letter
            </TrackedDownload>
          </div>
        </section>
      )}

      <section aria-labelledby="edit">
        <h2 id="edit" className="text-lg font-semibold">
          Fix a typo
        </h2>
        {editable ? (
          <>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Open until {editUntil ? `${formatDate(editUntil)}, ${editUntil.toISOString().slice(11, 16)} UTC` : ""}.</p>
            <div className="mt-3">
              <ManageForm
                token={token}
                addonPrint={t.addonPrint}
                initial={{ recipientName: t.recipientName, giverName: t.giverName ?? "", dedication: t.dedication ?? "" }}
              />
            </div>
          </>
        ) : (
          <p className="mt-1 text-neutral-700 dark:text-neutral-300">Editing closed 24 hours after the claim.</p>
        )}
      </section>
    </div>
  );
}

export default function ManagePage({ params }: { params: Params }) {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8">
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-neutral-100 dark:bg-neutral-900" />}>
        <ManageBody params={params} />
      </Suspense>
    </main>
  );
}

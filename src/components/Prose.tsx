import type { ReactNode } from "react";
import { contactEmail } from "@/lib/copy";

/** Layout for the plain text pages (about, terms, privacy, refunds). */
export function Prose({ title, updated, children }: { title: string; updated?: string; children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8">
      <article className="flex flex-col gap-4 text-base leading-relaxed [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1">
        <header>
          <h1 className="text-3xl font-bold leading-tight">{title}</h1>
          {updated && <p className="mt-1 text-sm text-neutral-500">Last updated {updated}</p>}
        </header>
        {children}
      </article>
    </main>
  );
}

/** "email us at x" or, before an address is configured, the report link. */
export function Contact() {
  const email = contactEmail();
  if (email) return <a href={`mailto:${email}`}>{email}</a>;
  return <>the &ldquo;Report this page&rdquo; link on any certificate</>;
}

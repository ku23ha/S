import type { Metadata } from "next";
import Link from "next/link";
import { AffiliateNote, StoreButtons } from "@/components/ShopLinks";
import { GIFT_SHELVES } from "@/lib/stores";

export const metadata: Metadata = {
  title: "Gift shop",
  description: "Things to unwrap alongside a World's Best certificate: frames, cards, Christmas hampers and more, from stores you already use.",
};

export default function GiftsPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <header className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gold-deep">Gift shop</p>
        <h1 className="mt-2 font-display text-4xl font-semibold leading-tight">Something to unwrap, with something nobody else can give.</h1>
        <p className="mt-3 text-lg text-ink-soft">
          The certificate arrives as a link. If you&apos;d like something in their hands too, these pair well. Each button opens the
          store&apos;s own search in a new tab.
        </p>
        <div className="mt-4">
          <AffiliateNote />
        </div>
      </header>

      <div className="mt-10 flex flex-col gap-12">
        {GIFT_SHELVES.map((shelf) => (
          <section key={shelf.id} aria-labelledby={`shelf-${shelf.id}`} className="reveal">
            <h2 id={`shelf-${shelf.id}`} className="font-display text-2xl font-semibold">
              {shelf.name}
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted">{shelf.blurb}</p>
            <ul className="mt-5 grid gap-4 sm:grid-cols-2">
              {shelf.ideas.map((idea) => (
                <li
                  key={idea.id}
                  className={`flex flex-col gap-3 rounded-2xl border p-5 transition hover:-translate-y-0.5 ${
                    shelf.id === "christmas" ? "border-[#123528]/25 bg-[#123528]/[0.04]" : "border-line bg-white/70"
                  }`}
                >
                  <div>
                    <p className="text-lg font-semibold">{idea.name}</p>
                    <p className="mt-1 text-sm text-ink-soft">{idea.why}</p>
                  </div>
                  <StoreButtons idea={idea} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <section className="mt-16 rounded-3xl border border-gold/40 bg-white p-6 text-center sm:p-10">
        <h2 className="font-display text-3xl font-semibold">Start with the part only you can give.</h2>
        <p className="mt-2 text-ink-soft">Find their title first. The gift shop will still be here.</p>
        <Link href="/#search" className="mt-6 inline-block rounded-full bg-ink px-6 py-3 font-semibold text-paper hover:bg-ink-soft">
          Find a title
        </Link>
      </section>
    </main>
  );
}

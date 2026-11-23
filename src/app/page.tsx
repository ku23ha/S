import Link from "next/link";
import { connection } from "next/server";
import { type ReactNode, Suspense } from "react";
import { Certificate } from "@/components/Certificate";
import { RegistryCardView } from "@/components/RegistryList";
import { SearchBox } from "@/components/SearchBox";
import { BENEFITS, COLLECTIONS, FAQ, HEADLINE, HOW_IT_WORKS, PROMISES, SUBHEAD, TAGLINE, TRUST } from "@/lib/copy";
import { getDb } from "@/lib/db";
import { claimHref, formatPrice, fullTitle, toRegistryCard } from "@/lib/format";
import { errorSummary } from "@/lib/log";
import { countClaimed, listIconic, listRegistry } from "@/lib/queries";
import { PRINT_ADDON_CENTS, TIER_PRICE_CENTS, toTitleDisplay } from "@/lib/titles";

/** Below this, a public "N claimed" count reads as empty rather than proof; the number is still real when shown. */
const SHOW_COUNT_FROM = 10;

function Check() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 fill-gold">
      <path d="M8.2 13.6 4.9 10.3l-1.4 1.4 4.7 4.7 8.3-8.3-1.4-1.4z" />
    </svg>
  );
}

async function LatestClaims() {
  await connection();
  let page, total;
  try {
    const db = await getDb();
    [page, total] = await Promise.all([listRegistry(db, { tab: "recent", limit: 6 }), countClaimed(db)]);
  } catch (err) {
    // Database unreachable: keep the rest of the home page working.
    console.error("home latest claims failed", errorSummary(err));
    return null;
  }
  if (page.items.length === 0) return null;
  return (
    <section aria-labelledby="latest" className="mx-auto w-full max-w-5xl px-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="latest" className="font-display text-2xl font-semibold">
          Recently given
        </h2>
        <div className="flex items-baseline gap-4 text-sm">
          {total >= SHOW_COUNT_FROM && (
            <span className="text-muted">{total.toLocaleString("en-US")} titles claimed so far</span>
          )}
          <Link href="/registry" className="font-medium text-gold-deep underline-offset-4 hover:underline">
            See the registry
          </Link>
        </div>
      </div>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {page.items.map((h) => (
          <li key={h.id}>
            <RegistryCardView card={toRegistryCard(h)} />
          </li>
        ))}
      </ul>
    </section>
  );
}

async function IconicOpen() {
  await connection();
  let open;
  try {
    open = (await listIconic(await getDb())).filter((e) => !e.holder).slice(0, 4);
  } catch (err) {
    console.error("home iconic teaser failed", errorSummary(err));
    return null;
  }
  if (open.length === 0) return null;
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <span className="w-full text-sm text-muted">Still open:</span>
      {open.map((e) => {
        const display = toTitleDisplay(e.titleKey);
        return (
          <Link
            key={e.titleKey}
            href={claimHref(display)}
            className="rounded-full border border-gold/40 bg-white px-3 py-1.5 text-sm hover:border-gold"
          >
            {fullTitle(display)}
          </Link>
        );
      })}
    </div>
  );
}

function PriceCard({
  name,
  price,
  text,
  featured = false,
  children,
}: {
  name: string;
  price: number;
  text: string;
  featured?: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      className={`flex flex-col rounded-2xl border p-6 ${
        featured ? "border-gold bg-white shadow-[0_8px_30px_-12px_rgba(161,98,10,0.35)]" : "border-line bg-white/70"
      }`}
    >
      <p className="text-sm font-semibold uppercase tracking-widest text-gold-deep">{name}</p>
      <p className="mt-2 font-display text-4xl font-semibold">{formatPrice(price)}</p>
      <p className="mt-1 text-sm text-muted">one-time, no renewals</p>
      <p className="mt-4 text-ink-soft">{text}</p>
      {children}
    </div>
  );
}

export default function Home() {
  return (
    <main className="flex flex-col gap-20">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(161,98,10,0.10),transparent_55%)]"
        />
        <div className="relative mx-auto grid w-full max-w-5xl items-center gap-10 px-4 pb-14 pt-10 lg:grid-cols-[1.1fr_0.9fr] lg:pt-16">
          <div>
            <p className="rise text-sm font-semibold uppercase tracking-[0.18em] text-gold-deep">{TAGLINE}</p>
            <h1 className="rise rise-2 mt-3 font-display text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">{HEADLINE}</h1>
            <p className="rise rise-3 mt-4 max-w-xl text-lg text-ink-soft">{SUBHEAD}</p>

            <div id="search" className="rise rise-3 mt-7 scroll-mt-24">
              <SearchBox source="home" label="Search a World's Best title" />
            </div>

            <ul className="mt-5 grid grid-cols-1 gap-x-6 gap-y-2 text-sm text-ink-soft sm:grid-cols-2">
              {PROMISES.map((p) => (
                <li key={p} className="flex gap-2">
                  <Check />
                  {p}
                </li>
              ))}
            </ul>
          </div>

          <figure className="relative mx-auto w-full max-w-sm lg:max-w-none">
            <div className="float">
              <Certificate
                titleDisplay="Chai Maker"
                recipientName="Your person's name"
                registryNo={null}
                claimedAt={null}
                giverName="You"
                dedication="Every morning, without fail."
                titleAs="p"
                footerNote="Your registry number and today's date go here"
              />
            </div>
            <span className="absolute -top-3 right-4 rounded-full bg-ink px-3 py-1 text-xs font-semibold uppercase tracking-wider text-paper">
              Example
            </span>
            <figcaption className="mt-4 text-center text-sm text-muted">
              What they get: their own page, a registry number, and images ready to share.
            </figcaption>
          </figure>
        </div>
      </section>

      {/* How it works */}
      <section aria-labelledby="how" className="reveal mx-auto w-full max-w-5xl px-4">
        <h2 id="how" className="font-display text-3xl font-semibold">
          How it works
        </h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-3">
          {HOW_IT_WORKS.map((item, i) => (
            <li key={item.step} className="rounded-2xl border border-line bg-white/70 p-6">
              <span className="font-display text-3xl font-semibold text-gold">{String(i + 1).padStart(2, "0")}</span>
              <p className="mt-3 text-lg font-semibold">{item.step}</p>
              <p className="mt-1 text-ink-soft">{item.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Why it lands */}
      <section aria-labelledby="why" className="reveal bg-paper-deep py-16">
        <div className="mx-auto w-full max-w-5xl px-4">
          <h2 id="why" className="max-w-2xl font-display text-3xl font-semibold">
            Not another mug. A title nobody else can ever give them.
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {BENEFITS.map((b) => (
              <div key={b.title}>
                <p className="text-lg font-semibold">{b.title}</p>
                <p className="mt-2 text-ink-soft">{b.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section aria-labelledby="trust" className="reveal mx-auto w-full max-w-5xl px-4">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gold-deep">Why it means something</p>
            <h2 id="trust" className="mt-2 font-display text-3xl font-semibold">
              A gift is only special if nobody else can give it.
            </h2>
            <p className="mt-3 text-ink-soft">
              Anyone can print a certificate. Only one person in the world can hold each title here, and the record shows it.
            </p>
            <form action="/registry" method="get" role="search" className="mt-6 rounded-2xl border border-line bg-white/80 p-4">
              <label htmlFor="lookup" className="text-sm font-semibold">
                Look up a certificate
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  id="lookup"
                  name="q"
                  placeholder="A title, or a number like 42"
                  className="min-w-0 flex-1 rounded-lg border border-line bg-white px-3 py-3 text-base outline-none focus:border-gold"
                />
                <button type="submit" className="rounded-lg bg-ink px-4 font-semibold text-paper hover:bg-ink-soft">
                  Look up
                </button>
              </div>
            </form>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {TRUST.map((t) => (
              <li key={t.title} className="rounded-2xl border border-line bg-white/70 p-5 transition hover:-translate-y-0.5 hover:border-gold/60">
                <p className="font-semibold">{t.title}</p>
                <p className="mt-2 text-sm text-ink-soft">{t.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Collections */}
      <section aria-labelledby="ideas" className="reveal mx-auto w-full max-w-5xl px-4">
        <h2 id="ideas" className="font-display text-3xl font-semibold">
          Not sure what to search?
        </h2>
        <p className="mt-2 text-ink-soft">The best ones are specific. Start with one of these, or make it theirs.</p>
        <div className="mt-8 flex flex-col gap-10">
          {COLLECTIONS.map((c) => (
            <div key={c.id}>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="font-display text-xl font-semibold">{c.name}</h3>
              </div>
              <p className="mt-1 max-w-2xl text-sm text-muted">{c.blurb}</p>
              <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {c.titles.map((g) => (
                  <li key={g.title}>
                    <Link
                      href={claimHref(g.title)}
                      className={`block h-full rounded-xl border p-4 transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-16px_rgba(124,74,6,0.6)] ${
                        c.id === "christmas"
                          ? "border-[#123528]/20 bg-[#123528] text-[#fdf6e3] hover:border-[#e2b55a]"
                          : "border-line bg-white/70 hover:border-gold hover:bg-white"
                      }`}
                    >
                      <span className={`block text-[11px] uppercase tracking-widest ${c.id === "christmas" ? "text-[#e2b55a]" : "text-muted"}`}>
                        World&apos;s Best
                      </span>
                      <span className="mt-1 block font-display text-lg font-semibold leading-snug">{g.title}</span>
                      <span className={`mt-1 block text-xs ${c.id === "christmas" ? "text-[#fdf6e3]/70" : "text-muted"}`}>{g.note}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <Suspense fallback={null}>
        <LatestClaims />
      </Suspense>

      {/* Pricing */}
      <section id="pricing" aria-labelledby="pricing-h" className="reveal mx-auto w-full max-w-5xl scroll-mt-24 px-4">
        <h2 id="pricing-h" className="font-display text-3xl font-semibold">
          Simple, fixed prices
        </h2>
        <p className="mt-2 text-ink-soft">Pay once. Prices never change with demand, and there are no renewals.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <PriceCard
            name="Standard"
            price={TIER_PRICE_CENTS.standard}
            text="Any title that isn't on the lists below. Most personal titles, like “Chai Maker” or “Parallel Parker”."
            featured
          />
          <PriceCard
            name="Popular"
            price={TIER_PRICE_CENTS.popular}
            text="About 300 common family, relationship and job titles: Sister, Uncle, Best Friend, Nurse, Chef."
          />
          <PriceCard
            name="Iconic"
            price={TIER_PRICE_CENTS.iconic}
            text="The 25 titles everyone knows: Dad, Mom, Boss, Friend, Teacher. One holder each, for good."
          >
            <Suspense fallback={null}>
              <IconicOpen />
            </Suspense>
          </PriceCard>
        </div>
        <p className="mt-4 text-sm text-muted">
          Add a high-resolution print file (A4 and US Letter) and a longer dedication for {formatPrice(PRINT_ADDON_CENTS)}. Taxes
          may be added at checkout depending on where you are.
        </p>
      </section>

      {/* FAQ */}
      <section id="faq" aria-labelledby="faq-h" className="reveal mx-auto w-full max-w-3xl scroll-mt-24 px-4">
        <h2 id="faq-h" className="font-display text-3xl font-semibold">
          Questions
        </h2>
        <div className="mt-6 divide-y divide-line rounded-2xl border border-line bg-white/70">
          {FAQ.map((f) => (
            <details key={f.q} className="group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                {f.q}
                <span aria-hidden="true" className="text-gold transition group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-ink-soft">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Closing search */}
      <section aria-labelledby="close" className="reveal mx-auto w-full max-w-3xl px-4">
        <div className="rounded-3xl border border-gold/40 bg-white p-6 text-center shadow-[0_8px_30px_-16px_rgba(161,98,10,0.35)] sm:p-10">
          <h2 id="close" className="font-display text-3xl font-semibold">
            Who&apos;s the best at something you love?
          </h2>
          <p className="mt-2 text-ink-soft">Check if their title is still free. It takes a second.</p>
          <div className="mx-auto mt-6 max-w-xl text-left">
            <SearchBox source="home" label="Search another World's Best title" />
          </div>
        </div>
      </section>
    </main>
  );
}

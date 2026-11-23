import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import Link from "next/link";
import { type ReactNode, Suspense } from "react";
import { SessionRef } from "@/components/SessionRef";
import { PageViewTracker } from "@/components/Tracking";
import { DISCLAIMER, PRODUCT_NAME, TAGLINE } from "@/lib/copy";
import { siteUrl } from "@/lib/site";
import "./globals.css";

// Self-hosted at build time by next/font, so no request goes to Google from visitors.
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: `${PRODUCT_NAME}: ${TAGLINE}`, template: `%s · ${PRODUCT_NAME}` },
  description: `Search any "World's Best" title. If it's free, give it to someone you love: one holder, a numbered public certificate, forever theirs. ${DISCLAIMER}`,
  openGraph: { siteName: PRODUCT_NAME, type: "website" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fbf8f1",
};

function Wordmark() {
  return (
    <Link href="/" className="group flex items-center gap-2" aria-label={`${PRODUCT_NAME}, home`}>
      <span
        aria-hidden="true"
        className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-gold font-display text-sm font-bold text-gold"
      >
        №
      </span>
      <span className="font-display text-lg font-semibold leading-none tracking-tight">
        World&apos;s Best <span className="text-gold">Registry</span>
      </span>
    </Link>
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <SessionRef />
        <Suspense fallback={null}>
          <PageViewTracker />
        </Suspense>
        <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur">
          <nav className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3">
            <Wordmark />
            <div className="flex items-center gap-5 text-sm">
              <Link href="/registry" className="hidden text-ink-soft hover:text-ink sm:inline">
                The registry
              </Link>
              <Link href="/#pricing" className="hidden text-ink-soft hover:text-ink sm:inline">
                Pricing
              </Link>
              <Link href="/#faq" className="hidden text-ink-soft hover:text-ink sm:inline">
                Questions
              </Link>
              <Link
                href="/#search"
                className="rounded-full bg-ink px-4 py-2 font-semibold text-paper transition hover:bg-ink-soft"
              >
                Find a title
              </Link>
            </div>
          </nav>
        </header>
        <div className="flex-1">{children}</div>
        <footer className="mt-16 border-t border-line bg-paper-deep">
          <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-10 sm:grid-cols-[1.4fr_1fr_1fr]">
            <div>
              <Wordmark />
              <p className="mt-3 max-w-xs text-sm text-muted">
                One holder per title. A numbered certificate that&apos;s theirs alone. Made to be given.
              </p>
            </div>
            <nav aria-label="Registry" className="flex flex-col gap-2 text-sm">
              <span className="font-semibold">Registry</span>
              <Link href="/registry" className="text-ink-soft hover:text-ink">
                Recent claims
              </Link>
              <Link href="/registry?tab=iconic" className="text-ink-soft hover:text-ink">
                Iconic titles
              </Link>
              <Link href="/#pricing" className="text-ink-soft hover:text-ink">
                Pricing
              </Link>
            </nav>
            <nav aria-label="Site" className="flex flex-col gap-2 text-sm">
              <span className="font-semibold">Help</span>
              <Link href="/about" className="text-ink-soft hover:text-ink">
                About
              </Link>
              <Link href="/refunds" className="text-ink-soft hover:text-ink">
                Refunds
              </Link>
              <Link href="/terms" className="text-ink-soft hover:text-ink">
                Terms
              </Link>
              <Link href="/privacy" className="text-ink-soft hover:text-ink">
                Privacy
              </Link>
            </nav>
          </div>
          <p className="border-t border-line px-4 py-5 text-center text-sm text-muted">{DISCLAIMER}</p>
        </footer>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { type ReactNode, Suspense } from "react";
import { SessionRef } from "@/components/SessionRef";
import { PageViewTracker } from "@/components/Tracking";
import { DISCLAIMER, PRODUCT_NAME } from "@/lib/copy";
import { siteUrl } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: PRODUCT_NAME,
  description: `Every "World's Best" title can belong to one person. ${DISCLAIMER}`,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <SessionRef />
        <Suspense fallback={null}>
          <PageViewTracker />
        </Suspense>
        <header className="border-b border-black/10 dark:border-white/10">
          <nav className="mx-auto flex w-full max-w-xl items-center justify-between gap-4 px-4 py-3">
            <Link href="/" className="font-semibold">
              {PRODUCT_NAME}
            </Link>
            <Link href="/registry" className="text-sm text-neutral-700 underline-offset-4 hover:underline dark:text-neutral-300">
              Registry
            </Link>
          </nav>
        </header>
        <div className="flex-1">{children}</div>
        <footer className="border-t border-black/10 px-4 py-6 text-center text-sm text-neutral-600 dark:border-white/10 dark:text-neutral-400">
          <nav aria-label="Site" className="mb-3 flex flex-wrap justify-center gap-x-4 gap-y-1">
            <Link href="/about" className="underline-offset-4 hover:underline">
              About
            </Link>
            <Link href="/refunds" className="underline-offset-4 hover:underline">
              Refunds
            </Link>
            <Link href="/terms" className="underline-offset-4 hover:underline">
              Terms
            </Link>
            <Link href="/privacy" className="underline-offset-4 hover:underline">
              Privacy
            </Link>
          </nav>
          <p>{DISCLAIMER}</p>
        </footer>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { DISCLAIMER, PRODUCT_NAME } from "@/lib/copy";
import "./globals.css";

export const metadata: Metadata = {
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
        <div className="flex-1">{children}</div>
        <footer className="border-t border-black/10 px-4 py-6 text-center text-sm text-neutral-600 dark:border-white/10 dark:text-neutral-400">
          <p>{DISCLAIMER}</p>
        </footer>
      </body>
    </html>
  );
}

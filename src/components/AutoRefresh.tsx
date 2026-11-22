"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-render the server page every few seconds, for a bounded time. */
export function AutoRefresh({ everyMs = 3000, maxMs = 120_000 }: { everyMs?: number; maxMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => {
      if (Date.now() - started > maxMs) {
        clearInterval(id);
        return;
      }
      router.refresh();
    }, everyMs);
    return () => clearInterval(id);
  }, [router, everyMs, maxMs]);
  return null;
}

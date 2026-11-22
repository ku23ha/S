"use client";

import { useEffect } from "react";
import { recordSessionStart } from "@/lib/session-ref";

/** Notes whether this browsing session began on a certificate page. */
export function SessionRef() {
  useEffect(() => {
    recordSessionStart(window.location.pathname);
  }, []);
  return null;
}

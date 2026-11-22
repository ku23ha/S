/**
 * Loop attribution: when a browsing session starts on a certificate page,
 * remember that certificate's slug for the rest of the session so a later
 * purchase stores it as ref_title_id. Uses sessionStorage only; nothing
 * personal is kept. Every access is guarded because storage can be blocked.
 */

const SEEN_KEY = "wbr_session_seen";
const REF_KEY = "wbr_ref_slug";

/** The certificate slug a path points at, or null. */
export function refSlugFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/c\/([^/]+)\/?$/);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]).slice(0, 200);
  } catch {
    return null;
  }
}

/** Call once on the first page of a session. Later calls change nothing. */
export function recordSessionStart(pathname: string, storage: Storage | undefined = globalThis.sessionStorage): void {
  try {
    if (!storage || storage.getItem(SEEN_KEY)) return;
    storage.setItem(SEEN_KEY, "1");
    const slug = refSlugFromPath(pathname);
    if (slug) storage.setItem(REF_KEY, slug);
  } catch {
    // Storage unavailable: attribution is best effort.
  }
}

export function getSessionRef(storage: Storage | undefined = globalThis.sessionStorage): string | null {
  try {
    return storage?.getItem(REF_KEY) ?? null;
  } catch {
    return null;
  }
}

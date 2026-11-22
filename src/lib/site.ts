/** Absolute site origin for links in emails and checkout return URLs. */
export function siteUrl(request?: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
  if (configured) return configured;
  if (request) return new URL(request.url).origin;
  return "http://localhost:3000";
}

/** Host name for printing on images, e.g. "theworlds.best". */
export function siteHost(request?: Request): string {
  return new URL(siteUrl(request)).host;
}

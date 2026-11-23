import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Content security policy without nonces (Next.js CSP guide, "Without
 * Nonces"), which keeps partial prerendering. Inline scripts are allowed
 * because Next's bootstrap needs them; all user text is escaped by React.
 * PostHog domains per posthog.com/docs/libraries/next-js. Payment happens on
 * Dodo's hosted page by full navigation, so it needs no entry here.
 * Google (GA4, Ads) and Meta Pixel domains are listed for the ad tags, which
 * load only after cookie consent (src/components/Marketing.tsx).
 */
const GOOGLE = "https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://www.google.com https://*.g.doubleclick.net";
const META = "https://connect.facebook.net https://www.facebook.com";
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://*.posthog.com ${GOOGLE} ${META}${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' blob: data: ${GOOGLE} ${META}`,
  "font-src 'self'",
  `connect-src 'self' https://*.posthog.com ${GOOGLE} ${META}`,
  `frame-src ${GOOGLE} ${META}`,
  "worker-src 'self' blob: data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  poweredByHeader: false,
  cacheComponents: true,
  partialPrefetching: true,
  // Database drivers load native or wasm assets at runtime; keep them out of the bundle.
  serverExternalPackages: ["pg", "@electric-sql/pglite"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

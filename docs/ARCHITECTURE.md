# Architecture

The browser pays on Dodo's hosted page, and only Dodo's signed webhook can turn a reservation into a claimed title. The app never sees card data.

## Stack
| Layer | Choice | Why |
|---|---|---|
| Frontend and backend | Next.js (App Router, TypeScript) with Tailwind CSS | One codebase for pages, API routes and image rendering |
| Database | Postgres on Supabase, server-side access only | Partial unique indexes and transactions enforce one holder per title |
| Authentication | None for users. One admin password | Buyers need no account; a manage link in email covers edits |
| Payments | Dodo Payments hosted checkout and webhooks | Onboards Indian sellers, merchant of record, handles foreign tax |
| Certificate images | next/og image responses | Share image, story image and print file from one template |
| Hosting | Vercel (Pro before taking payments; Hobby is non-commercial) | Zero-config for Next.js |
| Analytics | PostHog cloud | Funnels and event properties |
| Email | Resend | One transactional template |

Verify on the day: Vercel's current plan terms, and Supabase's free-tier pausing rule for inactive projects.

## Database access
- Server code talks to Postgres through `src/lib/db.ts` with node-postgres (`pg`) and `DATABASE_URL`, the Supabase **shared pooler in transaction mode** (port 6543; copy the host from the Connect dialog). The `postgres` role bypasses RLS, like the service role, so RLS with no policies keeps the anon API closed while server code works.
- Per Supabase's serverless guidance: one connection per instance, SSL required, no named (prepared) statements, no session state across transactions. postgres.js was not used because Supabase documents query pipelining problems with it in transaction mode.
- Without `DATABASE_URL` in development, `db.ts` uses an embedded PGlite database in `node_modules/.cache/wbr-pglite` (outside the watched tree, so writes don't trigger rebuilds), migrated and seeded on first use. `npm run db:fixtures` adds sample claims for checking pages by eye (stop the dev server first). Tests use in-memory PGlite.
- Next.js runs with Cache Components: any component that reads the database calls `connection()` and sits inside `<Suspense>`.

## Payments and email
- Two providers behind `src/lib/payments/index.ts`, chosen by `PAYMENTS_PROVIDER`: `razorpay.ts` (INR; Razorpay-hosted Payment Link per reservation, reference_id = title id; webhook `payment_link.paid` claims, `refund.processed` and `payment.dispute.lost` remove; HMAC-SHA256 signature on the raw body, `x-razorpay-event-id` as the idempotency key; full refunds with an idempotency header) and `dodo.ts` (USD, below). The price list follows `NEXT_PUBLIC_PRICE_CURRENCY` (INR or USD) so pages and server agree; amounts are always computed on the server.
- `src/lib/payments/index.ts` is the provider interface: create a hosted checkout from a tier (never an amount), parse a signed webhook into a normalised event, refund a payment. `dodo.ts` implements it with the `dodopayments` SDK (`checkoutSessions.create`, `refunds.create`) and verifies webhooks with `standardwebhooks`. The `webhook-id` header is the idempotency key stored in `webhook_events`.
- Each tier and the print add-on is a fixed-price Dodo product (`DODO_PRODUCT_*`). Checkout sends `metadata.title_id`; the webhook matches on it, falling back to `checkout_session_id`, because Dodo's docs don't say whether session metadata is copied to the payment.
- Refunds and chargebacks: `refund.succeeded`, `dispute.lost` and `dispute.accepted` set the title to `removed` (freed; its registry number stays retired). `dispute.opened` is recorded but changes nothing, since the dispute may still be won.
- Without Dodo keys in development, `stub.ts` stands in: its checkout URL is `/dev/checkout`, which signs a Dodo-shaped `payment.succeeded` event and sends it through the real webhook route. Never active in production.
- `src/lib/email.ts` sends with Resend using an idempotency key per title (`claim/<id>`, `refund/<id>`), three attempts. Without `RESEND_API_KEY` in development, emails are recorded and only the subject is logged.

## Certificate images and the loop
- `src/lib/cert-image.tsx` draws every image with next/og: the 1200x630 share image (`/c/[slug]/opengraph-image`), the 1080x1920 story (`/api/cert/[slug]/story`) and 300 dpi A4 / US Letter print files (`/api/cert/[slug]/print?token=&size=`, add-on buyers only, manage token required). All carry the disclaimer line.
- Fonts are bundled Noto files in `assets/fonts` (SIL OFL, see `OFL.txt`): Latin, Greek, Cyrillic, Devanagari, Bengali, Tamil. Emoji use Twemoji, fetched at render time. Satori cannot shape Indic conjuncts or pre-base vowel signs, so names that need shaping, or use other scripts, are left off the image with a pointer to the certificate page, which renders them correctly.
- Attribution: when a browsing session starts on a certificate page, its slug is kept in `sessionStorage` and sent with the checkout as `refSlug`; certificate search links also carry `ref`. Checkout stores it as `ref_title_id`.
- The manage page (`/manage/[token]`, linked from the buyer email) allows fixing the name, from line and dedication within 24 hours and serves the print downloads. It is `noindex` with `Referrer-Policy: no-referrer` so the token doesn't leak.

## Analytics, moderation and admin
- PostHog in the browser is set up in `src/instrumentation-client.ts`: no autocapture, no session recording, no person profiles, `sessionStorage` persistence (no cookies), and `before_send` strips manage tokens, ids and query strings from URLs. Events follow docs/API.md; `page_view` is our own event. Server events (`checkout_started`, `claim_completed`) use posthog-node `captureImmediate` with `process_person_profile: false`, keyed by the browser's anonymous id stored in `titles.analytics_id`.
- Unique certificate views: the certificate page posts to `/api/cert/[slug]/view` unless the browser session is the buyer's (marked on the success page). The server stores a daily-rotating salted hash of IP, user agent and date, and ignores known link-preview bots.
- Rate limits (`src/lib/ratelimit.ts`, fixed windows in `rate_limits`, IPs hashed): search 60/min, checkout 5/h, report 5/h, manage edits 20/h, view beacons 120/min. Admin login: after 5 failures per IP in 15 minutes, further attempts are refused, even with the right password; 50 failures in total in 15 minutes also lock it.
- Moderation rules: blocked terms in titles are refused at search; blocked terms or contact details in names or dedications send a paid entry to review; a report from the person named hides the page at once; three open reports hide it. Hidden means `in_review`; the title stays held until an admin decides.
- Admin (`/admin`): password from `ADMIN_PASSWORD_HASH` (scrypt, made with `npm run admin:hash`), signed httpOnly SameSite=Strict session cookie (`SESSION_SECRET`, 32+ characters), same-origin checks on every admin POST. Review queue (approve, or reject with refund), open reports (dismiss, remove), search, and a 14-day table from the database: searches, searchers, checkouts, claims, gross, share rate, loop claims, certificate views. Visitors are in PostHog.

## Folder structure
```
CLAUDE.md
docs/  PRD.md ARCHITECTURE.md DATA_MODEL.md API.md COPY.md LAUNCH.md
supabase/
  migrations/0001_init.sql
  seed/tier_titles.sql
  seed/blocked_terms.sql
src/
  app/
    page.tsx  claim/page.tsx  success/page.tsx  c/[slug]/page.tsx
    c/[slug]/opengraph-image.tsx  registry/page.tsx  about/page.tsx
    terms/page.tsx  privacy/page.tsx  admin/page.tsx
    api/
      titles/check/route.ts  checkout/route.ts  webhooks/payments/route.ts
      registry/route.ts  cert/[slug]/story/route.tsx  cert/[slug]/print/route.tsx
      manage/[token]/route.ts  report/route.ts  admin/...
  components/ SearchBox.tsx ResultCard.tsx Certificate.tsx ShareBar.tsx RegistryList.tsx
  lib/
    db.ts  titles.ts  moderation.ts  payments/index.ts  payments/dodo.ts
    email.ts  ratelimit.ts  analytics.ts  admin-auth.ts
tests/
  titles.test.ts  checkout.test.ts  webhook.test.ts  e2e/claim.spec.ts
```

## Environment variables
See `.env.example`. Secrets live only in environment variables; `.env*` files other than `.env.example` are never committed.

## Security requirements
- Verify every webhook signature and reject unsigned or replayed events.
- Look up prices on the server from tier_titles; ignore any amount sent by the browser.
- Validate all input with a schema. Titles: 2 to 40 characters, letters, numbers, spaces, apostrophes and hyphens only. No URLs, emails, phone numbers or handles in any field.
- Escape all user text on output, including inside generated images.
- Keep the service key and payment keys server-side only. Enable row level security with no public policies.
- Generate manage tokens from 32 random bytes and compare in constant time.
- Store the admin password as a hash. Use an httpOnly, secure, same-site session cookie and lock out after five failures.
- Rate-limit search, checkout, report and admin login per IP.
- Never display or log the buyer's email. Send no personal data to analytics.
- Set a content security policy and standard security headers.
- Card data never touches the app; checkout is hosted by the provider.

## Error handling
| Situation | Behaviour |
|---|---|
| Title taken between search and checkout | Friendly message, show the holder, offer three variants |
| Unique index violation on reserve | Treat as taken; never show a database error |
| Checkout creation fails | Release the reservation, show retry, log the error |
| Webhook arrives twice | Second event is a no-op |
| Payment succeeds after the reservation expired and the title is gone | Refund through the provider, email the buyer with open variants |
| Entry flagged by moderation | Status in_review; page says so; admin decides within 24 hours |
| Image render fails | Serve a static fallback image and log |
| Email send fails | Retry three times; the success page already shows the link |
| Database unreachable | Search shows "try again in a moment"; checkout is disabled |

## Admin dashboard
- Password gate, single user.
- Review queue: flagged entries with approve, or reject and refund.
- Reports: open reports with remove, or dismiss.
- Search by title, recipient, email or payment id.
- Remove with a reason (frees the title, keeps the registry number retired).
- Daily table: visitors, searches, checkouts started, claims, gross revenue, share rate, loop purchases.

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

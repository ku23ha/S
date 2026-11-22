# Launch

## Testing checklist
Status as of Milestone 6 (2026-11-22). "Local" means verified with the local database and the development payment stub; items that need keys, a deployed URL or real phones stay unticked with what remains.

- [x] "Dad", " dad", "DAD!" and "dad" map to one key and one holder (tests/titles, tests/check)
- [x] A 41-character title, a URL, an email and a blocked term are each rejected with a clear message (tests/check)
- [x] Two parallel checkout requests for one title create exactly one reservation (tests/payments; the test database runs transactions one at a time, so the guarantee under real concurrency is the partial unique index, tests/migration)
- [x] An abandoned checkout frees the title after 15 minutes (tests/check, tests/payments)
- [ ] A test payment claims the title, assigns the next registry number and sends the email. Local: done (tests/payments, e2e claim.spec). Remaining: one Dodo test-mode purchase with Resend on the deployed site.
- [x] The same webhook delivered twice changes nothing the second time (tests/payments)
- [x] A webhook with a bad signature is rejected (tests/payments)
- [x] A late payment on a title now held by someone else is refunded (tests/payments; refund call verified against the provider interface)
- [x] A refund frees the title and retires the registry number (tests/payments)
- [x] A client-modified price is ignored (tests/payments, tests/claim)
- [x] Certificate renders correctly with a 40-character title, an emoji and a non-Latin name (page: checked at 375 px and e2e; images: names needing Indic shaping are left off by design, see docs/ARCHITECTURE.md)
- [ ] Link preview is correct in WhatsApp, iMessage, X and LinkedIn. Local: preview tags served to each crawler's user agent. Remaining: paste a certificate link from the deployed site into each app.
- [x] Print file opens at A4 and US Letter without clipping (tests/loop sizes; both files inspected)
- [x] A purchase started from a certificate page stores the referring title (tests/payments, tests/loop)
- [ ] Every analytics event arrives with its properties. Local: all browser events in e2e analytics.spec against intercepted PostHog, server events in tests/admin, no personal data in any payload. Remaining: confirm in the live PostHog project.
- [x] A flagged entry shows "in review" and appears in the admin queue (tests/payments, tests/security)
- [x] Admin remove frees the title; the sixth bad admin password is locked out (tests/admin; removal also checked in the browser)
- [x] Rate limits trigger on search, checkout and report (tests/admin)
- [ ] Full claim completed on one iPhone and one Android phone. Remaining: owner, on the deployed site.
- [x] The disclaimer line is present on every page, image and email (root layout, tests/copy, tests/security, e2e)

Also verified in Milestone 6: no error-level logs during a full claim (e2e claim.spec, browser console and server output), content security policy and security headers on every path, no secrets or private column names in browser bundles, error logs redact emails and tokens, the payment stub, local database and dev email are never used in production.

## Deployment checklist
Step-by-step instructions for each item are in docs/DEPLOY.md. Prepared in code: migration script (`npm run db:migrate`), environment check (`scripts/check-env.mjs`), health endpoint (`/api/health`), live/test key guard, About, Refunds, Terms and Privacy pages (review the wording before launch).

- [ ] Payment provider account approved for this product category, in writing
- [ ] Live products created for the three tiers and the add-on; ids in production environment
- [ ] Webhook endpoint registered with the live secret
- [ ] Hosting plan permits commercial use
- [ ] Domain connected with HTTPS; NEXT_PUBLIC_SITE_URL set
- [ ] Sending domain verified for email (SPF and DKIM)
- [ ] Production migration and seeds applied; database backups enabled
- [ ] PAYMENTS_MODE=live; no test keys in production
- [ ] Terms, privacy, refund and removal pages published with a contact email
- [ ] One real $5 purchase and one real refund completed by the owner
- [ ] Uptime monitor and error alerts pointed at the owner's phone
- [ ] Analytics dashboard saved: funnel from search to claim, and loop metrics

## Launch checklist
- [ ] Ten real certificates live, with consent from each recipient
- [ ] Two reaction videos edited in vertical format, under 30 seconds, with the search box shown in the final three seconds
- [ ] Show HN text drafted, including one honest paragraph on what the registry is not
- [ ] Build-story post drafted with the Outbid clone numbers and sources
- [ ] List of 20 small creators and newsletters with contact details
- [ ] Iconic board page checked: every price and status is correct
- [ ] Share previews retested on the production domain
- [ ] Refund and removal process rehearsed once from the admin page
- [ ] Analytics funnel and loop dashboard open on the owner's phone
- [ ] Kill criteria written on one page and dated

Seeding without faking anything: buy ten titles at full price through the live checkout for ten real people; post reactions only with consent; never create fictional holders or inflate the counter.

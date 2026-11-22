# Deploying

The order matters: database first, then payments in test mode, a test purchase on the deployed site, and only then live keys. Tick the deployment checklist in docs/LAUNCH.md as you go.

## 1. Accounts you need
- **Dodo Payments**: business approved for this product category, in writing (support email). Nothing goes live without it.
- **Vercel**: Pro plan (Hobby is for non-commercial use).
- **Supabase**: one project in the region closest to most buyers.
- **Resend**: a sending domain you own, verified with SPF and DKIM.
- **PostHog**: one project (US or EU).
- **Domain**: connected to Vercel with HTTPS.

## 2. Database (Supabase)
1. Create the project. In **Connect**, copy two strings:
   - **Transaction pooler** (port 6543): this is `DATABASE_URL` for the app.
   - **Session pooler** (port 5432): this is `MIGRATION_DATABASE_URL` for migrations. (The direct connection also works but is IPv6-only on most plans.)
2. Apply the schema and seeds from your machine:
   ```powershell
   $env:MIGRATION_DATABASE_URL = "<session pooler string>"
   npm run db:migrate
   ```
   It records applied files in `schema_migrations`, runs each new migration in a transaction, and re-applies the seeds (safe to repeat). Alternatively paste `supabase/migrations/*.sql` then `supabase/seed/*.sql` into the SQL editor in order; the script will adopt that database later.
3. Check Row Level Security is on for every table (Database > Tables) and that there are no policies. The app connects as the database owner, so it isn't affected; the public API stays closed.
4. Turn on the backups your plan offers (Database > Backups) and note the restore steps.

## 3. Payments (Dodo), test mode first
1. Create four one-time products with fixed prices: Standard $5, Popular $19, Iconic $99, Print add-on $7. Copy their ids into `DODO_PRODUCT_STANDARD`, `DODO_PRODUCT_POPULAR`, `DODO_PRODUCT_ICONIC`, `DODO_PRODUCT_PRINT_ADDON`.
2. Create an API key (`DODO_API_KEY`, starts with `dodo_test_`). Set `PAYMENTS_MODE=test`.
3. Add a webhook endpoint `https://<your-domain>/api/webhooks/payments` with at least `payment.succeeded`, `refund.succeeded`, `dispute.lost` and `dispute.accepted`. Copy its signing secret into `DODO_WEBHOOK_SECRET` (the `whsec_...` value as shown).
4. The app refuses to start payments if a test key is used with `PAYMENTS_MODE=live`, or the reverse.

## 4. Email (Resend)
1. Verify your domain (SPF and DKIM records at your DNS host).
2. `RESEND_API_KEY` and `EMAIL_FROM`, e.g. `The World's Best Registry <hello@your-domain>`.

## 5. Analytics (PostHog)
- `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` (`https://us.i.posthog.com` or `https://eu.i.posthog.com`).
- In PostHog project settings, consider discarding IP data (Settings > Project > General > IP data capture). The app sends no personal data, but PostHog adds IP-based location unless told not to.
- Save two insights: the funnel `title_searched → claim_started → checkout_started → claim_completed`, and the loop metrics (`certificate_viewed` with `is_owner_session = false`, and `claim_completed` where `ref_slug` is set).

## 6. Admin and secrets
```powershell
npm run admin:hash
```
Type the admin password (12+ characters); put the output in `ADMIN_PASSWORD_HASH`. Generate `SESSION_SECRET` and `VIEWER_HASH_SALT` as two different random strings of 32+ characters. Set `NEXT_PUBLIC_CONTACT_EMAIL` to the address shown on the About, Refunds, Terms and Privacy pages.

## 7. Vercel
1. Import the repository. Framework: Next.js. No build settings to change.
2. Add every variable from `.env.example` to **Production** (and Preview if you use previews; give Preview its own test-mode keys).
3. Check the production environment before deploying:
   ```powershell
   vercel env pull .env.production.local --environment=production
   node --env-file=.env.production.local scripts/check-env.mjs
   ```
   It prints problems by name only, never values. Delete `.env.production.local` afterwards; `.gitignore` already excludes it.
4. Deploy, then open `https://<your-domain>/api/health`: it should return `{"ok":true,...}`.

## 8. Test-mode purchase on the deployed site
1. Claim a title with Dodo's test card `4242 4242 4242 4242`, expiry `06/32`, CVV `123` (from Dodo's testing docs).
2. Check: the success page shows the certificate; the email arrives with both links; `/c/<slug>` loads; the share image opens; PostHog shows `checkout_started` and `claim_completed`.
3. Refund it from the Dodo dashboard; the title should become free within a minute (the `refund.succeeded` webhook).
4. Paste the certificate link into WhatsApp, iMessage, X and LinkedIn and check the preview.
5. Claim once on an iPhone and once on an Android phone.

## 9. Going live
1. Switch Dodo to live mode: live products (new ids), live API key, live webhook secret. Set `PAYMENTS_MODE=live`.
2. Run `check-env.mjs` again, redeploy.
3. Buy one real $5 title yourself, then refund it. The first real claim gets No. 000001 only if no test claims were made in the production database; if they were, decide whether to start the production database fresh before launch.

## 10. Monitoring
- Point an uptime monitor at `https://<your-domain>/api/health` every 5 minutes, alerting your phone on two failures in a row.
- In Vercel, set log alerts on `webhook: handling failed`, `checkout failed` and `email send failed`.

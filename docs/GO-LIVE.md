# Go-live guide: from "site is up" to "money in the bank"

The code is ready. What's left are accounts only you can open, because they need your identity (PAN, Aadhaar video KYC, bank account), your card, and your passwords. Do the steps in order. After each one, paste the values it gives you into **`.env.vercel-production`** in the project folder. That file is gitignored and already holds the secrets I generated (admin password, session keys, Razorpay webhook secret).

Facts below were checked on official pages on 23 Nov 2026. Prices change, so re-check them before paying.

## What it costs

| Item | Cost | Needed? |
|---|---|---|
| Vercel Pro | **US$20/month** | **Yes.** Hobby terms allow "personal or non-commercial use" only, and this site sells things. |
| Supabase | Free to start. Pro is **US$25/month**. | Free is fine for the first days. Upgrade before running ads: free projects pause after 1 week of inactivity, and only paid plans get daily backups. |
| Razorpay | ₹0 setup, ₹0 yearly. **2%** per domestic payment, **up to 3%** per international card, plus 18% GST on that fee. Payment Links have no extra charge. | Yes. Domestic money arrives T+2 working days, international T+7. |
| Resend (email) | Free: 3,000 emails/month, max 100/day. Pro is US$20/month. | Free until you pass about 100 sales a day. |
| PostHog | Free (1M events/month) | Optional |
| Google Analytics 4, Search Console | Free | Recommended |
| Google Ads | No minimum spend. India sometimes offers new-advertiser credit; the amount shows at sign-up. | Your budget |
| Meta ads | No official minimum I could verify. Blogs say about US$1–5/day. | Your budget |
| Domain worldsbest.cv | Already paid | — |

**Monthly fixed cost:** about US$20 (roughly ₹1,700) at launch, or about US$45 (roughly ₹3,800) with Supabase Pro. A ₹399 sale nets about ₹389 after Razorpay's fee and GST, so **10 Standard sales a month covers the fixed costs**.

**Suggested ad test (my suggestion, not a platform rule):** ₹500/day on Meta for 7–10 days (about ₹3,500–5,000). Then put money only into what produced claims. Add Google Search ads for gift-intent searches ("gift for girlfriend", "christmas gift for mom") once Meta shows which titles sell.

## 1. Vercel Pro (5 min, card)

Vercel → your team → Settings → Billing → upgrade to Pro. Then turn on **Spend Management** with an alert amount, so a traffic spike can't surprise you.

## 2. Supabase database (10 min)

1. Sign up at supabase.com and create a project. Region: **Mumbai (ap-south-1)**. Click **Generate a password** and save it in your password manager.
2. Click **Connect**, then fill in the file:
   - `DATABASE_URL` = the **Transaction pooler** string (port 6543).
   - `MIGRATION_DATABASE_URL` = the **Session pooler** string (port 5432).
   - Put the password into both.
3. Project Settings → **Data API** → turn it **off**. The site talks to the database directly and never through Supabase's public API, so this closes that door completely. Every table also has row-level security on, as a second lock.
4. Tell me. I'll create the tables and load the title lists.

## 3. Resend email (15 min, needs DNS at ola.cv)

1. Sign up at resend.com → Domains → add `worldsbest.cv`. Add the DNS records it shows (SPF, DKIM and an MX for bounces) at ola.cv.
2. Also add a DMARC record so your emails don't land in spam:
   - Type `TXT`, name `_dmarc`, value `v=DMARC1; p=none; rua=mailto:YOUR-EMAIL`.
3. Turn off click tracking for this domain, so certificate links aren't rewritten.
4. API Keys → create one with **Sending access** → `RESEND_API_KEY`.

## 4. Razorpay (30–60 min plus approval time)

1. Sign up at razorpay.com and complete KYC: PAN, bank account, business details, and the 3–4 minute video KYC with Aadhaar and PAN.
2. **Business website details:** add `https://worldsbest.cv` and these pages. Razorpay checks them automatically.

   | Page | Link |
   |---|---|
   | About us | https://worldsbest.cv/about |
   | Contact us | https://worldsbest.cv/contact |
   | Pricing | https://worldsbest.cv/pricing |
   | Terms | https://worldsbest.cv/terms |
   | Privacy | https://worldsbest.cv/privacy |
   | Refunds | https://worldsbest.cv/refunds |
   | Delivery (digital, if asked) | https://worldsbest.cv/delivery |

   Razorpay also asks for a sample invoice; a screenshot of a test-mode claim works.
3. Fill in `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_BUSINESS_NAME`, `NEXT_PUBLIC_CONTACT_ADDRESS` and `NEXT_PUBLIC_CONTACT_PHONE`. They appear on /contact, which Razorpay expects.
4. **API keys:** switch the dashboard to **Test mode** → Account & Settings → API Keys → generate → `RAZORPAY_KEY_ID` (starts `rzp_test_`) and `RAZORPAY_KEY_SECRET`.
5. **Webhook:** Account & Settings → Webhooks → Add.
   - URL: `https://worldsbest.cv/api/webhooks/payments`
   - Secret: copy `RAZORPAY_WEBHOOK_SECRET` from the file.
   - Events: `payment_link.paid`, `refund.processed`, `payment.dispute.lost`.
6. **International payments** (UAE, UK, US buyers): Account & Settings → International payments → **Activate** next to International Cards. They may ask for GSTIN or Udyam if you have them, address proof and a purpose code. Prices stay in INR and foreign cards are converted automatically.
7. Once everything is approved and tested, repeat steps 4 and 5 in **Live mode** and replace the test keys.

## 5. Put the settings live (5 min)

Vercel → the project → Settings → Environment Variables → **Production** → paste the whole `.env.vercel-production` file into the first Key box → Save. Then redeploy (any push does it, or ask me). Tell me, and I'll run a full test-mode purchase on the live site.

## 6. Measurement for ads (20 min)

- **Google Analytics 4:** analytics.google.com → create a property for worldsbest.cv → Web stream → `NEXT_PUBLIC_GA_ID` (starts `G-`).
  - In the stream's **Enhanced measurement**, open "Page views" settings and turn off **"Page changes based on browser history events"**. The site sends clean page views itself.
- **Google Ads:** create the account (check for the new-advertiser credit). Goals → Conversions → New → Website → add manually → category **Purchase**, value "use different values". From the tag it shows:
  - `NEXT_PUBLIC_GOOGLE_ADS_ID` = `AW-…`
  - `NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL` = the part after the slash in `send_to`.
- **Meta:** business.facebook.com → Events Manager → Connect data → Web → Meta Pixel → `NEXT_PUBLIC_META_PIXEL_ID`.
- **What the site sends:**
  - PageView everywhere except private pages.
  - InitiateCheckout / begin_checkout on the claim form.
  - Purchase with the real amount and currency on the success page.
- **Consent:** nothing loads until the visitor taps **Accept** on the cookie banner, which Google and Meta require for UK/EU visitors.
- **Search Console:** search.google.com/search-console → Domain property → add the TXT record at ola.cv → Sitemaps → submit `https://worldsbest.cv/sitemap.xml`.

## 7. Affiliate commission (do this later)

- **Amazon Associates India:** they want "robust original content", roughly 10 posts, updated in the last 60 days. **A rejected application can't be re-assessed.** The gift shop alone is mostly links, so apply after the site has a few gift-guide articles.
  - Commission: 5% on most categories, gift cards 0%.
  - You need 3 qualified sales in 180 days, and your own orders don't count.
  - When `NEXT_PUBLIC_AMAZON_TAG_IN` is set, the shop shows Amazon's required line, "As an Amazon Associate I earn from qualifying purchases."
- **Amazon.com (US):** same three-sale rule. Non-US members complete a W-8BEN tax interview, or 30% is withheld.
- **Flipkart:** direct sign-ups appear to be closed. People use networks like Cuelinks or EarnKaro instead, which use their own link format, so tell me before using one.
- **Myntra:** no link-based affiliate id.

## Things that don't apply, and why

- **Google Business Profile:** not available for online-only businesses. Google's rule is that the business "must make in-person contact with customers". Use Search Console and Instagram instead.
- **"Free" Meta ads:** there aren't any. Posting on Instagram and Facebook is free; promoting is paid.

## Ad copy rules (to avoid rejected ads)

- **Meta:** don't imply personal attributes.
  - Not allowed: *"Are you the world's best mom?"*
  - Allowed: *"Make her the World's Best Mom. One holder, ever."*
- **Google:** no misleading claims and no gimmicky capitals ("WORLD'S BEST!!!").
- **Everywhere:**
  - Never call the certificate official, certified or accredited.
  - No fake countdowns or "only 2 left" (see docs/PSYCHOLOGY.md §6).
  - What is true and works: *"Each title can belong to one person. Is theirs still free?"*

## Before you spend on ads

- [ ] One full test-mode purchase on the live site: email received, certificate page live, webhook marked as delivered in Razorpay.
- [ ] Live keys in, one real ₹399 purchase, then refund it from the Razorpay dashboard.
- [ ] Log in at /admin with the generated password.
- [ ] A free uptime monitor (for example UptimeRobot) on `https://worldsbest.cv/api/health`, alerting your email.
- [ ] Supabase Pro on, so backups and no pausing are guaranteed.

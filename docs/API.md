# API

## Endpoints
| Method and path | Purpose | Notes |
|---|---|---|
| GET /api/titles/check?q= | Availability, tier, price, holder if taken, three variants | Expires stale reservations for that key first. 60 requests a minute per IP |
| POST /api/checkout | Validate input, reserve the title for 15 minutes, create a hosted checkout | Price is looked up on the server, never taken from the client. 5 an hour per IP |
| POST /api/webhooks/payments | Verify signature, record event, claim the title or refund | Idempotent through webhook_events |
| GET /api/registry?tab=&cursor= | Paginated registry lists | Cached for 30 seconds |
| GET /c/[slug]/opengraph-image | 1200 x 630 share image | Cached, revalidated on edit |
| GET /api/cert/[slug]/story | 1080 x 1920 story image | Cached |
| GET /api/cert/[slug]/print?token= | Print file, add-on buyers only | Requires manage token |
| POST /api/manage/[token] | Fix recipient name, from line or dedication within 24 hours | Re-runs moderation |
| POST /api/report | Report a certificate | 5 an hour per IP |
| POST /api/admin/login | Set admin session cookie | Lockout after 5 failures |
| POST /api/admin/titles/[id]/approve, /reject, /remove | Moderation actions | Reject and remove free the title; reject triggers a refund |
| GET /api/admin/stats | Daily visitors, searches, claims, revenue, loop metrics | Admin only |

## Analytics events
| Event | Fired when | Key properties |
|---|---|---|
| page_view | Any page loads | path, referrer, ref_slug |
| title_searched | A check returns | result (available, taken, reserved, blocked), tier, source (home, certificate, registry) |
| variant_clicked | A suggested variant is tapped | tier |
| claim_started | Claim form opens | tier, price_cents, ref_slug |
| checkout_started | Reservation created | tier, addon_print, price_cents |
| claim_completed | Webhook confirms payment | tier, addon_print, price_cents, ref_slug, registry_no |
| certificate_viewed | A certificate page loads | slug, is_owner_session, referrer |
| share_clicked | A share button is tapped | channel, slug |
| download_clicked | Image or print file downloaded | kind |
| report_submitted | A report is sent | slug |

ref_slug is set when a session starts on a certificate page and is carried to checkout. It is how loop purchases are counted. No personal data is sent to analytics.

## Loop metrics
| Metric | Definition | Healthy | Broken |
|---|---|---|---|
| Share rate | Claims whose certificate page gets 3+ unique outside views in 7 days | Above 40% | Under 20% |
| Views per claim | Unique outside views per certificate in 7 days | Above 15 | Under 5 |
| Viewer search rate | Certificate viewers who run a search | Above 30% | Under 10% |
| Loop purchases | New purchases per 10 claims that began on a certificate page | 2 or more | Under 1 |

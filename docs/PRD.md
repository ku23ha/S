# PRD: The World's Best Registry

One sentence: every "World's Best ___" title can belong to exactly one person on Earth, so claim yours before someone else does.

## Exact concept
1. The homepage is one search box prefixed with "World's Best". The visitor types the rest.
2. The site answers at once: Available with a price, or Taken with the holder's name, registry number and date.
3. To claim, the buyer enters the recipient's name, an optional "from" line and dedication, and pays.
4. The title is locked to that recipient permanently. No transfers, no resale, no outbidding.
5. The recipient gets a public certificate page, a share image and a print file.
6. A public registry lists every claimed title, newest first, plus the famous titles still open.

Every page carries one plain line: "A novelty registry for fun and affection. Titles have no legal or official status."

On certificates: "Entered in The World's Best Registry, No. 000482".

## Product requirements
- Goal: let a visitor check a title in under 5 seconds and complete a claim in under 90 seconds on a phone.
- Success metrics: first revenue targets (first stranger payment within 48 h of launch; 10 stranger claims within 7 days; $100 gross within 14 days) and the loop metrics in docs/API.md.
- Non-goals: accounts, social features, physical goods, any claim of official status.

## Personas
| Persona | Situation | Wants | Pays |
|---|---|---|---|
| The gift giver | Needs a small, personal, funny extra for a partner or parent | Something unique in two minutes | $5 to $19 |
| The recipient | Receives a link or a printed certificate | To show it off | Nothing; they are the distribution |
| The curious viewer | Saw a certificate online | To know whether their own title is taken | Converts into a gift giver |
| The self-claimer | Has a trade or hobby identity | A title for a bio or a wall | $5 to $99 |

## User journey
1. Lands on the homepage or on someone's certificate.
2. Types a title and sees Available or Taken.
3. If taken, sees the holder and three free variants.
4. Taps Claim, fills four fields, pays on hosted checkout.
5. Lands on a success page with the certificate, a copy-link button and download buttons.
6. Receives an email with the same link and a private manage link.
7. Sends the link or prints the certificate.

## MVP scope
- Title search with instant availability, tier and price.
- Claim form and hosted checkout with a 15-minute reservation.
- Certificate page with share image, share buttons and embedded search.
- Public registry: recent claims, search, and the iconic titles board.
- Print file download (add-on).
- Buyer email with certificate link and manage link (fix a typo in the name within 24 hours).
- Report link on every certificate.
- Admin page: review queue, remove, stats.
- About, terms, privacy and refund pages.

## Explicitly out of scope
- User accounts and login.
- Transfers, resale, bidding or renewals.
- Scheduled gift delivery by email.
- Physical products.
- Titles with any prefix other than "World's Best".
- Languages other than English.
- Comments, likes or leaderboards.
- Any AI-generated text shown to users.
- Native apps.

## Pricing (fixed public list, server-side lookup)
| Item | Price (USD) | Covers |
|---|---|---|
| Standard title | $5 | Any title not on the two lists below |
| Popular title | $19 | About 300 common family, relationship and job titles |
| Iconic title | $99 | 25 titles everyone knows (Dad, Mom, Boss, Friend, Teacher) |
| Print add-on | +$7 | High-resolution print file in A4 and US Letter, plus a longer dedication |

Prices never rise on a timer or a counter. Limit of five claims per checkout email per day.

## Page-by-page layout
| Page | Route | Contents, top to bottom |
|---|---|---|
| Home | / | Wordmark. Headline: "Every 'World's Best' title can belong to one person. Is yours taken?" Search box with fixed prefix. Live result card. Strip of the six latest claims. Iconic board teaser ("World's Best Mom: open, $99"). Three-step how it works. Real total-claimed counter. Footer with the disclaimer line. |
| Claim | /claim?title= | Title preview styled as the certificate. Fields: recipient name, from (optional), dedication (optional, 120 characters), email. Print add-on toggle. Price summary. Pay button. Reservation timer shown only after checkout starts. |
| Success | /success?id= | Certificate render. Copy link, share buttons, download image, download print file. "Claim another" search box. |
| Certificate | /c/[slug] | Certificate: title, recipient, registry number, date, optional from line and dedication. Share buttons. "Is your title taken?" search box. Report link. Disclaimer. |
| Registry | /registry | Search. Tabs: Recent, Iconic titles (open and taken, with prices), Lowest numbers. Infinite list of cards. |
| About | /about | What this is and is not, pricing lists, refund and removal policy, contact. |
| Admin | /admin | Password gate. Review queue, reports, search, remove with reason, daily stats. |

## UX flows and states
- Search: debounced at 250 ms. States: empty, checking, available, taken, reserved ("someone is claiming this right now; try again in 15 minutes"), not allowed.
- Taken: shows holder, number and date, then three variants generated by rules.
- Checkout abandoned: the reservation expires and the title reopens.
- Late payment on an expired reservation: if still free, claim it; if not, refund automatically and email the buyer.
- Flagged entry: payment succeeds, the page shows "in review", and admin approves or rejects with a refund within 24 hours.

## Mobile-first behaviour
- Design at 375 px first. One column everywhere.
- The search box is in the first screen with a 16 px or larger font, so iOS does not zoom.
- The certificate renders as an image with a fixed aspect ratio.
- Share uses the native share sheet where available, with copy-link as fallback.
- Share image is 1200 x 630. A 1080 x 1920 story version is included.
- Largest contentful paint under 2 seconds on a mid-range phone on 4G.

## Milestones
| # | Name | Deliverables | Acceptance criteria |
|---|---|---|---|
| 1 | Foundation | Payment provider application sent. Domain bought. Repo, Next.js app, Supabase project, first migration, seed lists (25 iconic, about 300 popular, blocklist). Skeleton deployed. | Production URL serves the home page. Migration applies on a clean database. A second active row for the same title_key is rejected by the index. |
| 2 | Core product | Title library (normalise, validate, tier, variants). Check API. Search box and result card. Claim form. Certificate page. Registry page. | 30 or more normalisation unit tests pass. "Dad", "dad " and "DAD!" resolve to one key. A 40-character title and a non-Latin recipient name render without overflow. All pages usable at 375 px. |
| 3 | Payment and revenue | Provider interface. Test-mode checkout. 15-minute reservation. Webhook that claims the title and assigns the registry number. Refund path. Buyer email. | A test payment claims a title end to end. A repeated webhook changes nothing. Two simultaneous checkouts for one title produce one reservation. A late payment on a lost title triggers a refund. |
| 4 | Viral loop | Share image and story image. Share bar with native share. Search box on every certificate. ref_slug attribution. Success page. Print file. | Link previews render correctly in WhatsApp, iMessage, X and LinkedIn. A purchase begun on a certificate page stores ref_title_id. |
| 5 | Analytics and admin | All analytics events. Unique certificate view counting. Admin login, review queue, reports, remove, daily stats. Moderation rules. Rate limits. | Each event appears in PostHog with its properties. A blocked term sends an entry to review. Remove frees the title. The sixth failed admin login is locked out. |
| 6 | Testing | Unit, integration and end-to-end tests. Real-device checks on one iPhone and one Android phone. Security pass. | Every item in the testing checklist in docs/LAUNCH.md is ticked. No error-level logs during a full claim. |
| 7 | Deployment | Live payment keys. Paid hosting plan. Legal pages. Database backup. One real $5 purchase and one real refund by the owner. | The real purchase produces certificate No. 000001 and an email. The refund frees the title. Uptime check is green. |
| 8 | Launch and distribution | Ten real gifts seeded. Two reaction videos filmed. Launch posts drafted. | Ten live certificates in the registry. Videos exported in vertical format. Posts scheduled. |

If the payment provider has not approved by hour 60, finish milestones 6 and 8 in test mode and hold the public launch. Do not launch with a broken or manual payment step.

# Launch

## Testing checklist
- [ ] "Dad", " dad", "DAD!" and "dad" map to one key and one holder
- [ ] A 41-character title, a URL, an email and a blocked term are each rejected with a clear message
- [ ] Two parallel checkout requests for one title create exactly one reservation
- [ ] An abandoned checkout frees the title after 15 minutes
- [ ] A test payment claims the title, assigns the next registry number and sends the email
- [ ] The same webhook delivered twice changes nothing the second time
- [ ] A webhook with a bad signature is rejected
- [ ] A late payment on a title now held by someone else is refunded
- [ ] A refund frees the title and retires the registry number
- [ ] A client-modified price is ignored
- [ ] Certificate renders correctly with a 40-character title, an emoji and a non-Latin name
- [ ] Link preview is correct in WhatsApp, iMessage, X and LinkedIn
- [ ] Print file opens at A4 and US Letter without clipping
- [ ] A purchase started from a certificate page stores the referring title
- [ ] Every analytics event arrives with its properties
- [ ] A flagged entry shows "in review" and appears in the admin queue
- [ ] Admin remove frees the title; the sixth bad admin password is locked out
- [ ] Rate limits trigger on search, checkout and report
- [ ] Full claim completed on one iPhone and one Android phone
- [ ] The disclaimer line is present on every page, image and email

## Deployment checklist
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

# Marketing Features & Automations: Full Inventory for Lucky Diesel

Researched 2026-09-17 for the owner admin's future **Marketing** panel. This is research only. No code was changed.

- **Scope:** every marketing feature or automation a small diesel performance and repair shop could plausibly need. It is benchmarked against GoHighLevel, Podium, Birdeye, Broadly, HubSpot Starter, Mailchimp, Klaviyo, the marketing modules of Tekmetric, Shopmonkey, AutoLeap and Kukui, and the AI ad tools AdCreative.ai, Meta Advantage+ creative and Google Performance Max / Asset Studio.
- **Companion doc:** `docs/research/marketing-tech.md` covers API mechanics, AI Gateway, ad-API approvals and email/SMS plumbing. This file covers **what** to build. That file covers **how** to connect it.
- **Baseline (already built, not repeated here):** the 20 automations in `lib/automations/catalog.ts` (lead alert, auto-reply, day 1/3 follow-up, booking confirmation, 24h/2h reminders, job status texts, inspection/estimate plus 4h nudge, approval alert, waiting on parts, ready plus pay link, receipt, review request plus one reminder, service due, declined work at 30 days, owner daily summary). Also built: the quote form with photo upload, online booking, Shopify store links, build planner, gallery, builds/dyno pages, platform pages, portals, a VIN decode, demo phone and message log. Rows below that extend a built item say **"extends built"**.

## How to read the tables

**Priority**
- **[core]**: needed for the Marketing panel to be credible or legally safe. Build first.
- **[strong]**: clear revenue or retention impact for this shop. Build second.
- **[nice]**: useful polish, scale feature or edge case.

**Needs account?** `App` means it runs entirely inside our Next.js/Supabase/Vercel app. Otherwise the third-party account or approval is named:

| Code | Account / approval |
|---|---|
| `TW-10DLC` | Twilio number plus an **approved A2P 10DLC brand and campaign** (needs the LLC's EIN). This covers any SMS/MMS. |
| `TW-Voice` | Twilio voice number (no 10DLC for calls; any SMS leg still needs `TW-10DLC`) |
| `Resend` | Resend with a verified sending domain (DNS access to luckydiesel.com) |
| `GBP` | Claimed and **verified** Google Business Profile. API use also needs approved Business Profile API access. |
| `G-Ads` | Google Ads account. Offline conversions go through the **Data Manager API**. |
| `LSA` | Google Local Services Ads with business verification (license, insurance) |
| `GA4` / `GSC` / `GTM` | Google Analytics 4 / Search Console / Tag Manager |
| `Meta` | Meta Business portfolio, Facebook Page, Instagram professional account, ad account, and Business Verification plus app review for API permissions |
| `TikTok` | TikTok Ads account and/or TikTok for Developers app. **Public API posting requires an audit.** |
| `Shopify` | Shopify custom app with an Admin API token (store already exists) |
| `Stripe` | Stripe (already planned) |
| `LLM` | AI model access (e.g. Vercel AI Gateway, which needs a card on file; see marketing-tech.md) |
| `Vendor: X` | Optional named vendor |

---

## 0. Hard constraints found (read before building anything)

| # | Constraint | Consequence for the panel | Source |
|---|---|---|---|
| C1 | **Emissions tampering is still illegal.** On 2026-01-21 DOJ stopped *criminal* defeat-device prosecutions, but **civil enforcement (EPA) and state enforcement remain active**. The "Freedom to Fix" memo (2026-06-29) and EPA guidance (2026-07-01) left the 2020 tampering policy in place. **OBD tampering is still enforceable regardless of emissions effect.** SEMA's emissions testing program is now accepted as a "reasonable basis" for aftermarket parts. | No "delete", "DPF/EGR/DEF delete", "off-road only tune", "race pipe" or "emissions removal" wording anywhere: ads, posts, SMS, SEO, AI output. Tag tuning SKUs with compliance status (CARB EO / SEMA-verified / not verified). Exclude unverified SKUs from every promotion and feed. Counsel reviews the wording. | Arnold & Porter; CDLLife; TruckingInfo |
| C2 | **Ad platforms:** Meta's Advertising Standards ban "Locally Illegal Content, Products or Services". Google bans misrepresentation, enabling dishonest behavior and dangerous products. **I found no named "emissions defeat device" category in the current Google Ads, Google Merchant Center or Meta policy text I fetched.** Enforcement comes through the general illegal-product and misrepresentation rules plus reviewer judgment. eBay explicitly bans performance tuners and DPF/cat removal products. | Treat defeat products as prohibited on every platform. Add a pre-flight claims linter and negative keywords (delete, deleted, DPF delete, EGR delete, straight pipe, etc.). An account suspension would take down all paid channels at once. | Meta Ad Standards; Google Ads policies; eBay policy |
| C3 | **Quiet hours.** The TCPA baseline is 8am–9pm in the recipient's local time. The **SC Telephone Privacy Protection Act** explicitly covers texts to SC residents or SC area codes: 8am–9pm, the solicitor must give the business name, and an **in-house do-not-call list** is required. Florida and Oklahoma cut off at **8pm**, and Florida also allows **3 messages per 24h** on the same subject. | Enforce quiet hours per recipient timezone and area code. Default the shop to 9am–8pm. Put the business name in every marketing SMS. Keep an internal DNC list. | SC Code 37-21-30; Justia; LeadFriendly |
| C4 | **Revocation of consent.** Customers can opt out by **any reasonable means** (not only STOP), and the business must honor it within **10 business days** (in force since 2025-04-11). The "revoke-all" provision (one opt-out covers all purposes) is delayed to **2027-01-31**, and on 2026-09-09 the FCC circulated a draft order that would narrow it. The **one-to-one consent rule was vacated** (11th Cir., Jan 2025). | Classify free-text opt-outs ("stop texting me") with AI plus a keyword list and act immediately. Design the consent ledger so one flag can make a revocation global. | ActiveProspect; CFS Law Monitor; Womble Bond Dickinson |
| C5 | **10DLC.** Unregistered A2P SMS is carrier-blocked. TCR fees are about $4 for the brand and $15 for campaign vetting, plus $1.50–10/mo. SHAFT content is not allowed. Sample messages must match the declared use case. | Promotional SMS needs a Marketing or Mixed campaign use case. SMS marketing features stay in demo mode until approval. | Tychron; TextBolt |
| C6 | **Reviews.** Google's rules were tightened 2026-04-16/17 and now ban **review gating, incentives, staff review quotas, asking reviewers to name employees, on-premises pressure and shared devices/kiosks**. The **FTC Consumer Reviews Rule** (effective 2024-10-21) bans fake or insider reviews, sentiment-conditioned incentives and review suppression, with civil penalties up to **$51,744 per violation**. **Yelp tells businesses not to ask for reviews at all.** | Send the review link to every customer, never conditional on NPS. No Yelp review asks. Track *requests sent* per staff member, never *reviews received*. No "mention Jake in your review." | Launchcodex; FTC; Yelp Support |
| C7 | **Google Business Profile deprecations.** The Q&A API was discontinued **2025-11-03**, and public Q&A has been removed since 2025-12-03 (replaced by Gemini "Ask"). **GBP chat and call history were removed 2024-07-31.** The **Local Posts API is still supported.** | Don't build "GBP Q&A" or "GBP chat". Build an on-site FAQ hub and GBP posts instead. | PPC Land; Google Dev docs; GBP Help |
| C8 | **TikTok Content Posting API.** Unaudited apps post **SELF_ONLY (private)**, for at most 5 users per 24h. | TikTok auto-posting ships as a draft/manual handoff until the app passes audit. | TikTok for Developers |
| C9 | **Google Customer Match** *targeting* needs 90 days of account history and **more than $50,000 lifetime spend**. Observation and exclusion lists work for any policy-compliant account. | For this shop, customer lists are useful on Google only for exclusions and observation. Use Meta Custom Audiences for list targeting. | Google Ads API docs |
| C10 | **Google offline conversions / enhanced conversions for leads** have had to go through the **Data Manager API since 2026-06-15**. The legacy Ads API upload path is blocked. | Build revenue feedback to Google on the Data Manager API from day one. | Google Ads Help; Google Developers |
| C11 | **Local Services Ads.** Auto categories exist (auto repair, brake, transmission, oil change and more), but **performance tuning is not a category**. LSA is migrating into **Performance Max pay-per-lead**: first wave August 2026 (home services), broader groups late 2026, the rest in 2027. Auto repair was not named in the first wave. | LSA fits the repair side only. Plan the migration. | Google Ads Help; Search Engine Land |
| C12 | **Meta AI labels and auto-edits.** Meta auto-labels ads made or edited with generative AI and, since June 2026, detects third-party AI through C2PA metadata. **Since 2026-07-27, Advantage+ Creative rewrites text in uploaded images by default** (up to 8 headline variants). | Turn off text-rewrite enhancements on compliance-sensitive ads so Meta can't generate non-compliant claims. Never present AI imagery as a real customer build. | Meta newsroom; Coinis; Common Thread |
| C13 | **Shopify abandoned checkouts.** There is **no dedicated abandoned-checkout webhook**. App access to abandoned-checkout data is being restricted. Marketing messages require the customer's marketing consent flags. | Keep Shopify's native abandoned-checkout flow as the primary recovery tool. Our app only does a consented "want it installed?" handoff for high-ticket SKUs (see M17). | Shopify dev docs; TheConvertWay (secondary) |
| C14 | **Bulk email rules** (Gmail/Yahoo/Microsoft; hard 550 rejections enforced in 2026): SPF plus DKIM with DMARC alignment, **RFC 8058 one-click unsubscribe**, spam complaint rate under **0.3%**. Formally these apply to senders of more than 5,000/day, but deliverability rewards following them at any volume. | Marketing mail goes from a subdomain, with List-Unsubscribe-Post headers and complaint-rate monitoring. | Gmail Help; Red Sift |
| C15 | **Meta promotion rules** for contests: you can't require sharing to personal timelines or tagging friends to enter. Sweepstakes need official rules. | Build-of-the-month voting and giveaways need a rules generator and a compliant entry method. | RafflePress; Aligned Media (secondary) |
| C16 | **South Carolina has no emissions inspection program.** | Irrelevant to legality (federal law still applies). **Never** market "no inspections in SC" as a reason to tamper. | SouthCarolinaLicensePlate.org (secondary) |

---

## 1. Platform teardown (where each feature idea came from)

| Platform | Marketing features observed | Notes relevant to us |
|---|---|---|
| **GoHighLevel** | CRM, pipelines, funnels and website builder, email/SMS, workflows with a "recipes" library, **missed-call text-back (SMS within ~15s)**, reputation management (review requests, AI review replies), Social Planner (FB/IG/**GBP** with AI posts and best times), Conversation AI (SMS/chat/social), **Voice AI receptionist**, Workflow AI (automation from plain language), affiliate manager, trigger links. AI Employee costs $97/mo per sub-account. | Closest "everything" benchmark. Its reputation module can route negative feedback privately, which is **review gating** and is now banned by Google (C6). Don't copy it. |
| **Podium** | Unified inbox (SMS, email, webchat, FB, Google, voice), text review invites, text-to-pay, **SMS campaigns** with templates and scheduling, AI Employee add-on (answers, qualifies, books) | Webchat and AI are paid add-ons. Payments by text is already built for us. |
| **Birdeye** | Reviews across 200+ sites, AI review responses, listings sync to 50+ directories, social scheduling, **Surveys AI** (sentiment), **Referrals AI** (finds advocates), email/SMS campaigns, Reports AI, local SEO assistant | Listings plus the referral-advocate idea. |
| **Broadly** | Review requests (Google/FB/Yelp), web chat, payments plus "Pay Over Time" financing, Surveys AI, Referrals AI (timing the ask) | Financing CTA and referral timing. |
| **HubSpot Marketing Starter** | Forms, pop-ups, live chat/bots, landing pages, email (drag and drop), **ad management**, CRM segments, basic automation. 1,000 marketing contacts, from $20/seat/mo. A/B tests and branching are **Pro-only**. | Ads-in-CRM attribution idea. |
| **Mailchimp** | Customer Journeys, **send-time optimization**, predicted demographics, Content Optimizer (AI copy), SMS, landing pages, surveys | STO and content scoring. |
| **Klaviyo** | Email and SMS flows, **Personalized Send Time** (per-profile, respects quiet hours), predictive analytics (CLV, churn risk), unified segments, **SMS quiet hours (default 8pm–11am)**, Smart Sending | Predictive churn and send-time ideas. |
| **Tekmetric Marketing** (launched Oct 2025) | Online booking, automated reminders, campaigns, post-visit follow-ups, reviews, **declined-work follow-ups**. **Frequency caps: 1 marketing SMS/day, 2 per rolling 7 days, 2 marketing emails per rolling 30 days, with priority transactional > campaign > automated.** | Adopt this cap model almost verbatim. |
| **Shopmonkey** | Automated and one-time campaigns, **Canned Service Reminder** (recurring services like oil), **Deferred Service Reminder** (declined items), email blasts, template library, appointment reminders | Deferred and canned reminder split. |
| **AutoLeap** | SMS/email campaigns in the built-in CRM, review requests, **AIR AI receptionist** (after-hours, recognises returning callers, books into calendar; launched Apr 2026) | Voice AI tied to the customer record. |
| **Kukui** | SEO websites, CRM, **PPC management, call tracking, automated ROI tracking** (new customers by source from POS), online booking and payments, AI review tools, **mileage- or calendar-based reminders** (claims +18% repeat frequency), direct mail partner (Mudlick Mail) | Source → POS revenue attribution. Mileage reminders. Direct mail. |
| **AdCreative.ai** | Ad image/text generation, **Product Photoshoot AI**, **Creative Scoring AI** (pre-launch prediction), **Competitor Insights**, UGC video AI, background removal, upscaling | Product-shot generation from Shopify images. Pre-flight scoring. |
| **Meta Advantage+ creative** | AI background generation, image expansion to 9:16, text variations, image animation and image-to-video, Muse image generation, AI music, dubbing, Brand Memory. **Text-in-image rewrite on by default since 2026-07-27.** 2026: Advantage+ campaigns need about 25 conversions/week. | Useful when there are no photos, but needs guardrails (C12). |
| **Google PMax / Asset Studio** | Generates headlines, descriptions, images and logos from the site. Asset Studio (Marketing Live 2026): prompt-based text, image and video, product → lifestyle image, batch edit up to 100 images. Gemini long headlines and sitelinks. | Auto-generated assets must go through our approval queue. |

---
## 2. Module → feature tables

### M1. Lead capture & funnels

| Feature | What it does (≤12 words) | Trigger / timing | Priority | Needs account? |
|---|---|---|---|---|
| Offer landing page builder | Template page: offer, proof, form, schema, expiry | Publish manually; auto-unpublishes at offer end date | [core] | App |
| Instant price estimator | Truck + service picked → "starting at" range, then capture | On estimate view; lead created with range attached | [core] | App |
| Build goal quiz | Towing/power/mileage/reliability answers → recommended compliant package | Quiz complete → lead + build planner prefilled | [strong] | App |
| Build planner → lead handoff (extends built) | Saves the planned build as a lead with deal value | On "send to shop" or email-to-self | [core] | App |
| Used-diesel pre-purchase inspection offer | Lead magnet for people buying used trucks | Evergreen page; booking CTA | [strong] | App |
| Downloadable platform guides (lead magnets) | "6.0 Powerstroke reliability guide", "Towing prep checklist" PDF | Form submit → email delivery instantly | [strong] | App + Resend |
| Seasonal free check offers | Pre-towing-season / hurricane-prep inspection landing pages | Seasonal calendar (M8) turns pages on/off | [strong] | App |
| Multi-step form with partial capture | Saves contact after step 1; reduces abandonment | Each step autosaves | [strong] | App |
| Abandoned-form follow-up | Emails/texts incomplete quote forms (consented contacts only) | 1h after abandonment; one touch only | [strong] | App + Resend / TW-10DLC |
| VIN / year-make-model autofill on forms (extends built) | Decodes VIN, sets platform/generation automatically | On VIN entry (NHTSA vPIC, free) | [strong] | App |
| Fitment checker | "Will this part fit my truck?" → Shopify link or install lead | On check; logs product interest | [strong] | Shopify |
| Link-in-bio page | Branded IG/TikTok bio page with UTM-tagged buttons | Always on; clicks tracked | [core] | App |
| QR codes per placement | Unique QR per decal, card, banner, invoice; scan tracking | Generated per placement; scans logged | [strong] | App |
| Missed-call text-back | Auto-SMS to missed or after-hours callers | Within 60s of a missed call | [core] | TW-Voice + TW-10DLC |
| Call tracking numbers | Distinct numbers per channel (GBP, ads, truck wrap, print) | Call → lead with source; recording optional | [strong] | TW-Voice |
| Dynamic number insertion | Website number swaps by visitor source | On page load by UTM/referrer | [nice] | TW-Voice |
| Web chat widget | Site chat that continues by SMS after visitor leaves | Visitor message → inbox; SMS handoff with consent | [strong] | App (+ TW-10DLC) |
| AI after-hours chat qualifier | Answers FAQs, collects truck/service, books slot | Outside business hours or on no reply in 2 min | [strong] | LLM |
| AI voice receptionist | Answers overflow/after-hours calls, recognises customers, books | Call unanswered after N rings or after hours | [strong] | TW-Voice + LLM / Vendor: Retell, Vapi |
| Meta Lead Ads sync | Instant-form leads flow into leads inbox with ad IDs | Webhook on submission; alert within 1 min | [strong] | Meta (leads_retrieval) |
| Google lead form asset sync | Google Ads form leads into inbox | Webhook on submission | [nice] | G-Ads |
| LSA lead import | LSA calls/messages logged as leads for attribution | Poll/report import daily | [strong] | LSA |
| Third-party lead email parsing | Parses Yelp/Nextdoor/Angi/Facebook Marketplace lead emails into leads | On inbound email to a parse address | [nice] | Resend inbound / Vendor |
| Event registration pages | Dyno day / open house sign-up with capacity | Registration → confirmation + reminders (M19) | [strong] | App |
| Fleet inquiry funnel | B2B form: company, fleet size, truck mix, service needs | Submit → Fleet pipeline (M3) | [strong] | App |
| Financing pre-qualification CTA | "Check payments" button on builds and estimates | On click → partner flow; lead tagged "financing" | [nice] | Vendor: Synchrony / Affirm / Snap |
| "Notify me" waitlist | Back-in-stock, new tune revision, event waitlist capture | On sign-up; fires when condition is met | [nice] | App (+ Shopify) |
| Spam and bot protection | Honeypot, rate limit, Turnstile on all forms | Every submission | [core] | App (+ Vendor: Cloudflare Turnstile, free) |
| Lead dedupe and merge | Matches phone/email/VIN to existing customer | On lead creation | [core] | App |
| "How did you hear about us?" field | Self-reported source alongside tracked source | Every form and booking | [core] | App |

### M2. Conversations & speed-to-lead

| Feature | What it does (≤12 words) | Trigger / timing | Priority | Needs account? |
|---|---|---|---|---|
| Unified inbox | SMS, email, web chat, FB Messenger, IG DMs in one thread | Real-time | [core] | App + TW-10DLC + Resend + Meta |
| Speed-to-lead SLA timer | Shows minutes since lead; escalates if unanswered | Re-alert owner at 5 min, backup contact at 15 min | [core] | App (+ TW-10DLC) |
| Assignment and internal notes | Assign thread to owner/advisor; private notes, @mentions | On new thread | [strong] | App |
| Canned replies / snippets | Saved answers: hours, pricing ranges, compliance stance | Manual insert | [core] | App |
| AI suggested replies | Drafts a reply using customer, truck and job context | On thread open; human sends | [strong] | LLM |
| Missed-message follow-up | Reminds staff of threads awaiting a reply | Thread unanswered 2 business hours | [strong] | App |
| Voicemail transcription and summary | Voicemail → text + summary + lead fields | On voicemail | [strong] | TW-Voice + LLM |
| Call summary to CRM | Transcribes recorded calls; logs outcome and next step | After call ends | [nice] | TW-Voice + LLM |
| IG/FB comment-to-DM | Keyword comment ("SPECS") auto-DMs build sheet link | On comment with keyword | [strong] | Meta (instagram_manage_comments, messaging) |
| Comment inbox | FB/IG ad and post comments with reply and hide | Real-time | [strong] | Meta |
| Text-to-book link | Sends booking link with truck prefilled from thread | Manual button | [core] | App |
| Snooze and reminders | Hide a thread until a date ("call me after payday") | Resurfaces at chosen time | [nice] | App |
| Business-hours auto-responder | Sets expectation after hours with booking link | Inbound outside hours; once per 12h per contact | [core] | App + TW-10DLC |
| Opt-out intent detection | Detects "stop texting me" style replies; suppresses | Every inbound SMS (C4) | [core] | App + LLM |

### M3. Pipelines & lead scoring

| Feature | What it does (≤12 words) | Trigger / timing | Priority | Needs account? |
|---|---|---|---|---|
| Kanban sales pipeline | New → Contacted → Quoted → Booked → In shop → Won/Lost | Drag or automatic moves | [core] | App |
| Multiple pipelines | Separate boards: Performance build, Repair, Parts install, Fleet | Chosen by service type | [strong] | App |
| Automatic stage moves | Booking, estimate approval, invoice paid move the deal | On system events | [core] | App |
| Deal value | Estimate or build-planner total as pipeline value | On quote/estimate | [core] | App |
| Rule-based lead score | Points for service value, platform, source, engagement, recency | Recomputed on every event | [strong] | App |
| Engagement signals | Quote opened, pricing page revisit, email click raise score | Real-time events | [strong] | App |
| Hot-lead alert | Owner SMS when score crosses a threshold | On threshold cross | [strong] | TW-10DLC |
| Predictive win score | Model trained on won/lost history (once 200+ outcomes exist) | Nightly | [nice] | App (+ LLM optional) |
| Stale deal alerts | Flags deals with no activity | 48h without touch | [strong] | App |
| Quote expiry nudge | Reminds before a quote's price lock ends | 3 days before expiry | [strong] | App + TW-10DLC / Resend |
| Lost-reason capture | Required reason: price, timing, went elsewhere, no response, not a fit | On marking Lost | [core] | App |
| Lost-reason nurture tracks | Price → financing/phased build; timing → check back later | 30/60/90 days by reason | [strong] | App + Resend / TW-10DLC |
| Task queue with call scripts | Daily callback list with suggested talk track | Morning; generated from pipeline | [strong] | App (+ LLM) |
| Win/loss dashboard | Conversion by stage, source, service, response time | Live | [strong] | App |

### M4. Audience, segmentation & customer data

| Feature | What it does (≤12 words) | Trigger / timing | Priority | Needs account? |
|---|---|---|---|---|
| 360° customer timeline | Visits, spend, messages, web visits, Shopify orders, reviews | Live | [core] | App (+ Shopify) |
| Diesel segment builder | Filters by platform, engine, year, mileage, tune, services, spend | Dynamic, re-evaluated at send | [core] | App |
| Platform/engine taxonomy | Duramax LB7–L5P, Powerstroke 7.3/6.0/6.4/6.7, Cummins 5.9/6.7 | On vehicle create (VIN decode) | [core] | App |
| Truck usage profile | Towing (boat/RV/trailer/work), daily driver, show, fleet | Asked at booking; editable | [strong] | App |
| Tune/build state per truck | Stock / tuned (tuner, revision) / parts installed | From tune log and work orders | [core] | App |
| Predicted mileage | Estimates current odometer from reading history | Nightly; used by reminders | [strong] | App |
| RFM and VIP flags | Recency/frequency/monetary tiers; VIP auto-tag | Nightly | [strong] | App |
| Churn-risk flag | Overdue beyond 1.5× the customer's usual visit interval | Nightly | [strong] | App |
| Fleet/household grouping | One account → many trucks and contacts | On setup | [strong] | App |
| Tags and custom fields | Freeform tags, e.g. "boat owner", "military", "hunts" | Manual or rule-based | [core] | App |
| Consent state per channel | SMS marketing, SMS transactional, email marketing, with evidence | On capture/revoke (M20) | [core] | App |
| Suppression lists | Opt-outs, bounces, complaints, internal DNC, deceased/sold truck | Checked before every send | [core] | App |
| CSV import with consent mapping | Imports old customer lists; no SMS marketing unless consent proven | Manual import wizard | [core] | App |
| Phone line-type lookup | Flags landlines/VoIP before SMS | On new number | [nice] | Vendor: Twilio Lookup |
| Email validation | Catches typos and dead domains at capture | On form submit | [nice] | Vendor (e.g. ZeroBounce) or App regex + MX |
| Shopify customer/order sync | Parts buyers and their consent flags become profiles | Webhooks: orders/customers | [strong] | Shopify |
| Truck sold / ownership change | Stops truck reminders; asks for new truck | On reply "sold" or manual | [strong] | App + LLM |
| Data export and deletion request | Honors customer data requests | On request | [strong] | App |

### M5. Email campaigns

| Feature | What it does (≤12 words) | Trigger / timing | Priority | Needs account? |
|---|---|---|---|---|
| Broadcast composer | Block editor: text, image, build card, dyno chart, products, coupon | Send now or scheduled | [core] | Resend |
| Template library | Seasonal, event, new part, build spotlight, newsletter templates | Reusable | [core] | App |
| Shopify product blocks | Pulls live product image, price, link by SKU | At render time | [strong] | Shopify |
| Build/dyno content blocks | Inserts build page card with before/after HP/TQ | At render time | [strong] | App |
| Merge fields and conditional blocks | Truck name, platform-specific sections, VIP-only offers | At render time | [core] | App |
| Monthly newsletter autopilot | Assembles builds, blog posts, events, offer; owner approves | 1st Tuesday monthly → approval queue | [strong] | App + LLM + Resend |
| A/B testing | Subject/content variants on a sample; winner auto-sent | Winner after 4h (configurable) | [nice] | App + Resend |
| Send-time optimization | Per-contact best hour from past opens/clicks | Within a chosen delivery window | [nice] | App |
| Preview and test send | Desktop/mobile/dark-mode previews; send to owner | Before scheduling | [core] | App + Resend |
| Link and spam pre-check | Broken links, missing alt text, spammy wording, compliance lint | Before scheduling | [core] | App + LLM |
| Marketing subdomain and auth checklist | SPF/DKIM/DMARC status for e.g. mail.luckydiesel.com | On setup; weekly check | [core] | Resend + DNS |
| One-click unsubscribe | RFC 8058 List-Unsubscribe-Post plus footer link | Every marketing email (C14) | [core] | App + Resend |
| Preference center | Topics: promos, events, service reminders, new parts, builds | Linked from every email | [strong] | App |
| Bounce/complaint handling | Hard bounces and complaints suppressed automatically | Resend webhooks, real-time | [core] | Resend |
| Engagement sunset | Re-permission then suppress long-inactive addresses | No engagement 180 days | [strong] | App |
| CAN-SPAM footer | Physical address, identity, opt-out on every marketing email | Enforced by template | [core] | App |
| Campaign reports | Delivered, clicks, bookings and revenue attributed | Live; 7-day click window | [core] | App |
| Plain-text owner-style emails | "From Lucas" personal-looking mail for win-back | Per campaign | [strong] | Resend |

### M6. SMS / MMS campaigns

| Feature | What it does (≤12 words) | Trigger / timing | Priority | Needs account? |
|---|---|---|---|---|
| SMS broadcast to segment | Text campaign to a consented segment with preview | Scheduled; quiet-hours aware | [core] | TW-10DLC |
| MMS with image | Sends dyno sheet, build photo, event flyer | Scheduled | [strong] | TW-10DLC |
| Keyword opt-in | "Text DYNO to (843)…" joins list with confirmation | Inbound keyword → confirm message instantly | [strong] | TW-10DLC |
| Keyword auto-responders | HOURS, BOOK, PRICE replies with links | Inbound keyword | [strong] | TW-10DLC |
| STOP/HELP/START handling | Carrier-standard keywords plus natural-language opt-out | Real-time (C4) | [core] | TW-10DLC + App |
| Business name in every message | Auto-prefix "Lucky Diesel:" for SC TPPA | Every marketing SMS (C3) | [core] | App |
| Quiet-hours scheduler | Holds sends outside 8am–9pm local (FL/OK 8pm); shop default 9–8 | Per recipient timezone/area code | [core] | App |
| Frequency caps | ≤1 marketing SMS/day, ≤2/7 days; transactional exempt | Checked per send (Tekmetric model) | [core] | App |
| Branded short links | Own domain links with click tracking (no public shorteners) | Auto on send | [core] | App |
| Cost estimator | Segments × recipients × carrier fees before send | Pre-send | [strong] | App |
| Send throttling | Queue respecting 10DLC throughput limits | On send | [core] | App + TW-10DLC |
| Reply routing | Campaign replies land in inbox with campaign context | Real-time | [core] | App |
| A/B test SMS copy | Split test, winner by click-to-book rate | Winner after 2h | [nice] | App |
| Re-permission campaign | Emails existing customers inviting SMS opt-in before 10DLC go-live | One-time at launch | [core] | Resend |
| SMS terms and privacy page | Versioned terms referenced in consent text | Always on; version logged | [core] | App |

### M7. Lifecycle & retention automations (beyond the 20 built)

| Feature | What it does (≤12 words) | Trigger / timing | Priority | Needs account? |
|---|---|---|---|---|
| New customer welcome series | Portal tour, what to expect, maintenance plan intro | Day 0, 7, 30 after first paid invoice | [strong] | Resend (+ TW-10DLC) |
| Post-tune check-in | Asks about codes, regens, drivability; offers datalog review | 3 and 30 days after tune job | [core] | TW-10DLC / Resend |
| Post-install follow-up by job type | Break-in guidance, re-check appointments (e.g. re-torque) | Per canned job's configured delay | [strong] | TW-10DLC / Resend |
| Mileage-based service intervals (extends built) | Oil, fuel filters, trans, coolant, air filter by platform table | Predicted mileage hits interval minus 500 mi | [core] | App + TW-10DLC |
| Time-based fallback reminders | Uses months when mileage is unknown | 6 months since last service | [core] | App |
| "Reply with your mileage" update | Customer texts odometer; reminders recalibrate | 1 week before predicted due date | [strong] | TW-10DLC |
| Declined work multi-step (extends built 30d) | Adds safety-critical fast track and later touches | 7, 30, 90 days; safety items 3 days | [core] | App + TW-10DLC / Resend |
| Win-back ladder | Lapsed-customer sequence with escalating value | 9, 12, 18 months since last visit | [core] | Resend + TW-10DLC |
| Lost-lead re-engagement | Revives unconverted leads with new builds/offers | 60 and 120 days after lost | [strong] | Resend |
| Tune revision available | Notifies owners of trucks on an older tune revision | When a new compliant revision is logged | [strong] | App + TW-10DLC |
| Parts warranty expiring | Reminds before turbo/injector warranty window closes; offers inspection | 30 days before expiry | [strong] | App + Resend |
| Build anniversary | "1 year since your build" + UGC photo ask + check-up offer | Annually on build completion date | [strong] | Resend / TW-10DLC |
| Customer anniversary | Thanks note with small perk | Annually on first visit date | [nice] | Resend |
| Birthday | Optional perk if birthday was volunteered | Birthday morning, 9am | [nice] | Resend |
| Recall notices | Matches customer trucks to open NHTSA recalls; informs owner | Weekly check; new recall → notify | [strong] | App (NHTSA recalls API, free, no key) |
| Platform known-issue education | E.g. LML CP4.2 pump, 6.0 head studs, 6.4 fuel dilution content | Segment-triggered, max once per truck | [strong] | App + Resend |
| Next-stage build ladder | Suggests next compliant upgrade after previous stage | 60–90 days after a performance job | [strong] | App + Resend |
| Parts buyer → install offer | Shopify buyer of install-heavy SKU gets install booking offer | 1 day after Shopify order (consent required) | [strong] | Shopify + Resend |
| Service customer → parts cross-sell | Relevant accessories/maintenance parts from Shopify | 14 days after service | [nice] | Shopify + Resend |
| Portal activation nudge | Encourages magic-link login to My Garage | 2 and 7 days after first job if never logged in | [nice] | Resend |
| Maintenance plan renewal | Renewal reminder and prepaid-service balance | 30 and 7 days before renewal | [strong] | Stripe + Resend |
| NPS promoter → referral ask | Promoters get the referral link (reviews stay ungated) | 2 days after score 9–10 | [strong] | App |
| Detractor recovery task | Creates owner call task; no public-review suppression | Immediately on score ≤6 | [core] | App |
| Automation holdout groups | Random 10% get no message; measures true lift | Per automation, optional | [nice] | App |

### M8. Seasonal & local campaign calendar (Charleston-specific)

| Feature | What it does (≤12 words) | Trigger / timing | Priority | Needs account? |
|---|---|---|---|---|
| Seasonal calendar engine | Prebuilt dated campaigns the owner switches on | Auto-drafts 14 days before each window | [core] | App |
| Boat/towing season prep | Towing inspection, trans/cooling, brakes for boat and camper owners | Late Feb–Apr launch; reminder Jun | [core] | App + channels |
| Summer heat cooling check | Coolant, fan clutch, EGT/trans temps for Lowcountry heat | May–Jun | [strong] | App + channels |
| Hurricane-season readiness | "Evacuation-ready truck" check, fuel system, tow prep | Late May; storm-watch trigger in season | [strong] | App + channels |
| Hunting season | Towing and reliability offers for hunters | Aug–Sep | [nice] | App + channels |
| Winter travel / cold start | Batteries, glow plugs/grid heater, anti-gel, DEF for trips north | Nov–Jan | [strong] | App + channels |
| Tax refund build season | Build planner + financing push | Feb–Apr | [strong] | App + channels |
| Black Friday / holiday parts sale | Shopify discount + install bundles + gift cards | Late Nov–Dec | [strong] | Shopify + channels |
| Local event tie-ins | Truck shows, Cars & Coffee, fishing tournaments, Military appreciation | Event dates in calendar | [nice] | App |
| Weather-triggered sends | Cold snap or storm watch triggers relevant prep message | Forecast threshold, max once per event | [nice] | Vendor: NWS API (free) |
| Open-bay fill (yield) | Offers a limited slot deal when schedule has gaps | 48–72h lookahead finds empty capacity | [strong] | App + TW-10DLC |

### M9. Reputation, reviews & feedback

| Feature | What it does (≤12 words) | Trigger / timing | Priority | Needs account? |
|---|---|---|---|---|
| GBP claim/verify wizard | Step-by-step setup checklist; stores Place ID and review link | One-time; blocks review features until done | [core] | GBP |
| Review request to every customer (extends built) | Ungated Google link; channel chosen by consent | Day after paid invoice; one reminder max (C6) | [core] | GBP link + TW-10DLC / Resend |
| Review link on invoice/receipt and QR | Passive, non-pressured ask on paperwork | Every invoice | [strong] | App |
| Review monitoring (Google) | Pulls new reviews and ratings | Poll every 30 min via GBP API | [core] | GBP |
| Review monitoring (Facebook, Yelp, BBB, Nextdoor) | Aggregates other sites into one feed | Hourly/daily where APIs allow; else manual | [nice] | Meta; Vendor for Yelp |
| New-review alert | Owner push/SMS; 1–3 stars escalate to urgent | On detection | [core] | App + TW-10DLC |
| AI reply drafts | Brand-voice reply; never reveals job or PII details | On new review → approval queue | [strong] | LLM + GBP |
| Auto-publish positive replies | Optional auto-post for 5-star reviews after delay | 2h after draft if not edited | [nice] | GBP |
| Reply SLA tracker | Flags reviews unanswered | 24h (negative), 72h (positive) | [strong] | App |
| Website review widget | Shows real Google reviews; no self-serving star schema | Syncs hourly | [strong] | App + GBP |
| Review → social card | Turns a 5-star review into a branded image post (first name only) | On new 5-star → content queue | [strong] | App |
| NPS/CSAT survey | 0–10 plus comment; separate from the review ask | 3 days after job; never gates the review link | [strong] | App + TW-10DLC / Resend |
| Sentiment and theme analysis | Tags feedback: price, communication, turnaround, quality | On each response | [nice] | LLM |
| Competitor rating tracker | Tracks rating/count for Palmetto Diesel and other competitors | Weekly | [nice] | Vendor: Google Places API |
| Review velocity dashboard | Reviews/month, average rating, response rate, request→review % | Live | [strong] | App |
| Staff request leaderboard | Counts requests *sent*, not reviews (quotas banned) | Weekly | [nice] | App |
| Flag-and-report workflow | Guides reporting fake or policy-violating reviews | On owner flag | [nice] | GBP |
| Video testimonial capture | Customer records a clip via link; signed media release | After promoter NPS or on request | [strong] | App |
| Testimonial/media release ledger | Records permission to use name, face, truck, plate | Before any public use | [core] | App |
| Yelp guardrail | Blocks any "review us on Yelp" wording in templates | Template lint (C6) | [core] | App |

### M10. Social media & organic content

| Feature | What it does (≤12 words) | Trigger / timing | Priority | Needs account? |
|---|---|---|---|---|
| Channel connections | FB Page, IG professional, GBP, YouTube, TikTok | One-time OAuth; token health alerts | [core] | Meta, GBP, Google (YouTube), TikTok |
| Content calendar | Drag-and-drop schedule across channels, with approvals | Always on | [core] | App |
| AI content calendar | Proposes a month of posts from jobs, builds, seasons, events | 25th of month → approval queue | [strong] | LLM |
| Build published → auto post | New build page becomes post/carousel on FB, IG, GBP | On build publish → approval queue | [core] | Meta + GBP |
| Dyno result card generator | Branded graphic: truck, mods, before/after HP/TQ, graph | On dyno entry saved | [core] | App |
| Dyno pull auto-post | Posts dyno video/card when customer media consent exists | On dyno entry + consent → queue | [strong] | Meta + TikTok (draft) |
| Before/after compositor | Side-by-side or slider image from tech photos | On job photos tagged before/after | [strong] | App |
| Reel/short auto-assembly | Stitches clips with captions, logo, safe audio | On clips tagged "shareable" | [nice] | App (ffmpeg) / Vendor |
| Plate and VIN auto-blur | Detects and blurs plates, VINs, faces without release | Every media upload for public use | [core] | App + vision model (LLM) |
| Tech shot-list prompts | Shop portal asks for specific photos per job type | On job status change | [core] | App |
| Media consent per work order | Customer opts in to having their truck featured | At booking/estimate e-sign | [core] | App |
| AI captions and hashtags | Platform-specific captions; compliance lint; local hashtags | On draft | [strong] | LLM |
| GBP posts autopilot | Weekly update/offer/event post to Google profile | Weekly, Tuesday 10am | [core] | GBP (Local Posts API) |
| GBP photo uploads | Adds new job photos to profile | Weekly batch | [strong] | GBP |
| TikTok handoff | Sends video to TikTok drafts/inbox or manual-post checklist | On approval (C8) | [strong] | TikTok |
| YouTube Shorts / long dyno videos | Uploads with SEO titles and build page links | On approval | [nice] | Google (YouTube Data API) |
| Best-time suggestions | Suggests posting times from engagement history | On scheduling | [nice] | App |
| Evergreen recycler | Re-queues top-performing evergreen posts | Every 90 days | [nice] | App |
| UGC submissions | Customers upload truck photos/videos; approve and repost with credit | On submission | [strong] | App |
| Social analytics | Reach, engagement, followers, link clicks → bookings | Daily sync | [strong] | Meta, TikTok, GBP |
| Community task prompts | Reminders to engage in local diesel/boat FB groups | Weekly | [nice] | App |
| Nextdoor business posts | Neighborhood updates/deals (manual assist) | Monthly reminder | [nice] | Vendor: Nextdoor |

### M11. Paid advertising

| Feature | What it does (≤12 words) | Trigger / timing | Priority | Needs account? |
|---|---|---|---|---|
| Ad account connections | Meta, Google Ads, TikTok, Microsoft; status and token health | One-time | [core] | Meta, G-Ads, TikTok |
| Campaign templates by goal | Prebuilt: Search "diesel repair Charleston", call ads, Meta leads, retargeting | Owner picks → draft | [core] | Meta, G-Ads |
| Geo targeting presets | Radius around shop plus named towns; excludes irrelevant areas | Template default | [core] | Meta, G-Ads |
| Approval gate | Every new ad, AI asset, budget change routes to owner | Before publish; no bypass | [core] | App |
| Compliance pre-flight | Blocks delete/tamper claims, unverified SKUs, fake testimonials | Before approval (C1, C2) | [core] | App + LLM |
| Negative keyword guard lists | Delete, DPF/EGR/DEF delete, straight pipe, "off road only" etc. | Applied to every Search/PMax campaign | [core] | G-Ads |
| Budget caps and pacing | Daily/monthly caps; pace vs plan; auto-pause at cap | Hourly check | [core] | Meta, G-Ads |
| Seasonal budget multipliers | Raises budget in towing season, lowers in slow months | Calendar-driven, owner-approved | [strong] | Meta, G-Ads |
| Spend and performance alerts | CPL spike, zero leads, disapprovals, card failures | Daily 8am, or real-time for disapproval | [core] | Meta, G-Ads |
| Automated rules | Pause ad if CPL > target for 7 days or frequency > 3 | Daily evaluation | [strong] | Meta, G-Ads |
| Meta CAPI (web + CRM events) | Sends Lead, Booked, Won with value; dedupes with pixel | Real-time on event | [core] | Meta |
| Meta conversion-leads optimisation | Optimises for leads that became paid jobs | Needs CRM stage events via CAPI | [strong] | Meta |
| Google offline conversions | Uploads booked/won/revenue with gclid/enhanced data | Hourly batch via Data Manager API (C10) | [core] | G-Ads |
| Call conversion tracking | Counts qualified calls ≥60s from ads and tracking numbers | On call end | [strong] | G-Ads + TW-Voice |
| Website retargeting audiences | Quote-page, build-planner, platform-page visitors | Consent-aware pixels, 30/90-day windows | [strong] | Meta, G-Ads |
| Customer list audiences | Hashed customer lists for Meta targeting; Google exclusions only | Weekly sync (C9) | [strong] | Meta, G-Ads |
| Lookalike audiences | Meta lookalikes from paid customers and high-value builds | Monthly refresh | [nice] | Meta |
| Engagement audiences | IG/FB video viewers (50%+), page engagers, TikTok viewers | Auto-created on connect | [strong] | Meta, TikTok |
| Exclusions | Excludes customers with open jobs or recent visits | Daily sync | [strong] | Meta, G-Ads |
| Local Services Ads setup | Repair-category LSA profile, dispute invalid leads | One-time; weekly lead review (C11) | [strong] | LSA |
| Performance Max for local | Store-visit/call goals with approved assets only | Owner-approved launch | [nice] | G-Ads |
| TikTok Spark Ads | Boosts top organic dyno/build videos | On top-performer detection → approval | [nice] | TikTok |
| Microsoft Ads import | Mirrors Google Search campaigns to Bing | On request | [nice] | Vendor: Microsoft Ads |
| Nextdoor / Yelp ads | Local deal ads; Yelp for repair searchers | Manual campaigns tracked by call number | [nice] | Vendor: Nextdoor, Yelp |
| Ad extensions manager | Sitelinks, callouts, structured snippets, promotion and location assets | On campaign create | [strong] | G-Ads |
| Dayparting for call ads | Call ads only during staffed hours | Schedule on campaign | [strong] | G-Ads |
| Disapproval monitor and appeal helper | Explains policy hit, suggests compliant rewrite | On disapproval webhook/poll | [strong] | Meta, G-Ads + LLM |
| Competitor ad research | Views local competitors' active Meta ads | On demand | [nice] | Meta Ad Library (public) |
| Financing ad special category | Forces Meta special ad category for credit/financing ads | When ad mentions financing | [nice] | Meta |
| Direct mail (EDDM/postcards) | New-mover and radius postcards with QR attribution | Monthly or triggered | [nice] | Vendor: Mudlick Mail / Lob / USPS EDDM |

### M12. AI creative studio (for when no photos exist)

| Feature | What it does (≤12 words) | Trigger / timing | Priority | Needs account? |
|---|---|---|---|---|
| Brand kit | Logo, colors, fonts, voice rules, banned words, disclaimers | Setup; used by every generator | [core] | App |
| Data-driven templates (no photo needed) | Dyno numbers, review quotes, "starting at" prices, offer cards | On demand or from events | [core] | App |
| Ad copy variant generator | Headlines/primary text per platform character limits | On campaign draft | [core] | LLM |
| Product shot enhancer | Shopify catalog images → clean backgrounds, lifestyle scenes | On SKU selection | [strong] | LLM image model / Vendor: AdCreative.ai |
| Illustrative AI scenes | Generic scenes (truck towing boat at dusk), labeled illustrative | On draft; never shown as a real build | [nice] | LLM image model |
| Stills-to-video | Animates cards and photos into short vertical video | On draft | [nice] | Meta Advantage+ / Vendor |
| Placement auto-resize | Exports 1:1, 4:5, 9:16, 1.91:1 | On approval | [core] | App |
| Creative pre-flight scoring | Text density, legibility, policy risk, brand compliance | Before approval | [strong] | App + LLM |
| Native AI toggles control | Chooses which Advantage+/PMax AI enhancements are allowed | Per campaign; text rewrite off by default (C12) | [core] | Meta, G-Ads |
| AI provenance log | Records model, prompt, and AI label status per asset | On generation | [strong] | App |
| Real-photo replacement queue | Swaps AI placeholders for real shop photos once captured | When matching tagged photo arrives | [strong] | App |
| Creative fatigue detector | Flags ads with falling CTR / rising frequency; proposes refresh | Daily | [nice] | Meta, G-Ads |
| Licensed stock library | Curated stock with license record | On search | [nice] | Vendor: stock provider |

### M13. SEO, local listings & content

| Feature | What it does (≤12 words) | Trigger / timing | Priority | Needs account? |
|---|---|---|---|---|
| GBP profile manager | Categories, services, products, attributes, description, hours | On setup; monthly audit | [core] | GBP |
| Holiday/special hours sync | Pushes closures to GBP and site banner | On calendar closure entry | [strong] | GBP |
| GBP performance import | Calls, direction requests, website clicks, search terms | Daily | [strong] | GBP |
| AI build-page writer (extends built) | Drafts build story from work order, parts, dyno, photos | On job closed with "showcase" flag → approval | [core] | LLM |
| AI article/blog generator | Topic clusters per platform; human edit required | Monthly topic plan; 2 posts/month | [strong] | LLM |
| Service-area pages | Unique pages for Summerville, Mt Pleasant, Goose Creek, Awendaw and others | One-time; quarterly refresh | [strong] | App |
| FAQ hub (replaces GBP Q&A) | Answers real customer questions with FAQ schema | From inbox questions monthly (C7) | [core] | App + LLM |
| Structured data | AutoRepair, Service, Product, Event, VideoObject, FAQ schema | On page publish | [core] | App |
| Citation builder and NAP audit | Apple Business Connect, Bing Places, Yelp, BBB, Nextdoor, FB, aggregators | One-time; quarterly audit | [core] | Vendor accounts per directory / BrightLocal |
| Brand disambiguation | Checks listings for confusion with Oklahoma "Lucky Diesel" | Quarterly | [strong] | App |
| Manufacturer dealer-locator listings | Gets listed on DDP, EZ LYNK and other brand dealer maps (links) | One-time outreach tasks | [strong] | Vendor relationships |
| Search Console integration | Queries, pages, indexing issues surfaced in panel | Daily | [strong] | GSC |
| Local rank grid tracking | Map-pack rank for key terms across a grid | Weekly | [nice] | Vendor: Local Falcon / BrightLocal |
| Internal link automation | Builds ↔ platform pages ↔ Shopify collections ↔ articles | On publish | [strong] | App |
| Content decay alerts | Flags pages losing clicks for refresh | Monthly | [nice] | GSC |
| Image SEO | Auto alt text, file names, compression | On upload | [strong] | App + LLM |
| AI search visibility check | Tracks mentions in AI answers (Gemini, ChatGPT, Perplexity) | Monthly | [nice] | Vendor: Ahrefs Brand Radar / Semrush |
| Local PR / backlink tasks | Sponsorships, event listings, local news pitches | Monthly task list | [nice] | App |
| Compliance content hub (extends built) | Emissions stance, legal tuning explainer; kept current | Review on each regulatory change | [core] | App |
| Scaled-content guard | Blocks bulk low-value AI pages (Google spam policies) | Pre-publish check | [strong] | App |

### M14. Referrals & loyalty

| Feature | What it does (≤12 words) | Trigger / timing | Priority | Needs account? |
|---|---|---|---|---|
| Personal referral links/codes | Unique link per customer shared from their own phone | Issued after first paid job | [core] | App |
| Share sheet (customer-sent) | Customer texts friend themselves; shop never cold-texts referrals | On share tap | [core] | App |
| Double-sided rewards | Shop credit for referrer; discount for friend | Credit issued when friend's invoice is paid | [strong] | App (+ Stripe) |
| Reward ledger | Tracks credits earned, redeemed, expired | Live | [strong] | App |
| Referral ask timing | Asks promoters and right after pickup | 2 days after NPS 9–10 or build completion | [strong] | App |
| Partner referral program | Codes for boat/RV/trailer dealers, towing co., body shops | On partner onboarding; monthly statements | [strong] | App |
| Loyalty points | Points per $ on service; redeem at invoice | On invoice paid | [nice] | App |
| VIP tiers | Stock → Stage 1 → Stage 2 → Full Build tiers with perks | Recomputed on spend | [nice] | App |
| Tier perks | Priority booking, free dyno pull, event early access | On tier upgrade → notify | [nice] | App |
| Maintenance membership | Prepaid oil/fuel filter plan billed monthly/annually | Stripe subscription events | [strong] | Stripe |
| Wallet pass | Apple/Google Wallet membership card with barcode | On join | [nice] | Vendor: Apple Developer / Google Wallet |
| Gift cards | Shop gift cards for holidays | Always on; holiday push | [nice] | Stripe / Shopify |
| Creator/affiliate codes | Local truck creators get tracked codes; disclosure required | On onboarding; monthly payout report | [nice] | App + Shopify |
| Referral leaderboard | Top referrers recognised (opt-in) | Monthly | [nice] | App |

### M15. Promotions & coupons

| Feature | What it does (≤12 words) | Trigger / timing | Priority | Needs account? |
|---|---|---|---|---|
| Coupon engine | %/$ off, free add-on, bundle price; limits and expiry | On creation | [core] | App |
| Unique single-use codes | Per-recipient codes that prevent sharing | Generated at send | [strong] | App |
| Segment eligibility rules | Offer valid only for defined segment/platform | Checked at redemption | [strong] | App |
| Redemption at estimate/invoice | Advisor applies code; margin impact shown | At invoice | [core] | App |
| Shopify discount sync | Same code works for parts online | On coupon create | [strong] | Shopify |
| Parts + install bundles | Turbo + install + (compliant) tune package pricing | Campaign-based | [strong] | App + Shopify |
| Offer expiry reminders | "Ends Friday" reminder to non-redeemers | 48h before expiry | [strong] | App + channels |
| Military / first responder pricing | Verified discount for Joint Base Charleston community | Always on; verification at check-in | [strong] | App |
| Fleet volume pricing | Tiered pricing per truck count | On fleet account | [strong] | App |
| Financing promos | "Payments from $X/mo" with required disclosures | Campaign-based | [nice] | Vendor: financing partner |
| Merch gift with purchase | Hat/shirt with builds over $X | Campaign-based | [nice] | App |
| Promo ROI report | Redemptions, revenue, discount cost, margin | Live | [core] | App |
| Offer-claim lint | Terms, "starting at" language, no bait pricing | Pre-publish | [core] | App |

### M16. Website engagement & tracking

| Feature | What it does (≤12 words) | Trigger / timing | Priority | Needs account? |
|---|---|---|---|---|
| UTM and click-ID capture | Stores utm_*, gclid/gbraid/wbraid, fbclid/_fbc/_fbp, ttclid, msclkid | First visit and conversion; first + last touch | [core] | App |
| Landing page and referrer capture | Records entry page, referrer, device on lead | On lead creation | [core] | App |
| Cookie consent + Consent Mode v2 | Banner that gates pixels and passes consent signals | Before tags fire | [core] | App (+ GTM) |
| GA4 event map | generate_lead, book_appointment, click_to_call, planner_complete, shop_click | On events | [core] | GA4 |
| Meta Pixel + CAPI dedupe | Browser and server events with shared event_id | On events | [strong] | Meta |
| Google Ads tag + enhanced conversions | Hashed first-party data with conversions | On lead/booking | [strong] | G-Ads |
| TikTok pixel + Events API | Conversion tracking for TikTok ads | On events | [nice] | TikTok |
| Sticky mobile action bar | Call / Text / Book always visible on mobile | Always | [core] | App |
| Announcement bar | Current event/promo with countdown | Calendar-driven | [strong] | App |
| Exit-intent popup | Offers guide or towing checklist on exit (desktop) | Exit intent; once per 7 days | [nice] | App |
| Scroll/time popups | Page-specific offers (e.g. platform guide on platform pages) | 50% scroll or 45s; capped | [nice] | App |
| Returning-visitor personalization | Shows last-viewed platform builds and resume planner | On return visit | [nice] | App |
| Session replay and heatmaps | Understand form drop-off and CTA clicks | Always; privacy masking | [nice] | Vendor: Microsoft Clarity (free) |
| CTA / page A/B testing | Split tests headline, CTA, form length | Per experiment | [nice] | App (Vercel Flags) |
| Truthful social-proof toasts | "4 trucks dyno'd this week" from real data only | Live, capped | [nice] | App |
| Privacy policy and data-sharing notice | Discloses pixels, CAPI, SMS data handling; versioned | Always; version logged | [core] | App |

### M17. Shopify bridge (parts store)

| Feature | What it does (≤12 words) | Trigger / timing | Priority | Needs account? |
|---|---|---|---|---|
| Order and customer sync | Shopify buyers into profiles, segments, attribution | Webhooks (orders/create, customers/update) | [strong] | Shopify |
| Consent flag sync | Mirrors email/SMS marketing consent from Shopify | Consent webhooks | [core] | Shopify |
| SKU compliance tags | Marks tuning SKUs CARB EO / SEMA-verified / unverified | On product sync; blocks promos if unverified (C1) | [core] | Shopify |
| Feed exclusion rules | Keeps unverified tuning SKUs out of Google/Meta catalogs | On feed sync | [core] | Shopify + G-Ads/Merchant Center + Meta |
| Install-recommended handoff | Big parts orders get "book install" offer | 1 day after order (consented or transactional note) | [strong] | Shopify |
| Abandoned checkout handoff (limited) | Shopify native flow first; our app flags high-ticket carts to owner only | Daily report; no auto-SMS without consent (C13) | [nice] | Shopify |
| Back-in-stock alerts | Notifies waitlisted customers | On inventory change | [nice] | Shopify |
| Product reviews | Post-purchase product review ask (ungated) | 14 days after delivery | [nice] | Shopify app |
| Unified revenue view | Parts + service revenue per customer and source | Live | [strong] | Shopify |
| Catalog blocks for email/social | Live products in campaigns | At render | [strong] | Shopify |

### M18. Fleet & B2B

| Feature | What it does (≤12 words) | Trigger / timing | Priority | Needs account? |
|---|---|---|---|---|
| Fleet account CRM | Company, contacts, units, PO rules, terms | On setup | [strong] | App |
| Fleet landing page and proposal generator | Volume pricing proposal with PM schedule and SLA | On inquiry | [strong] | App + LLM |
| Prospect list builder | Local diesel fleets: marine, landscaping, construction, towing, farms | Manual/import | [nice] | Vendor: Apollo / manual |
| B2B cold email sequence | CAN-SPAM compliant intro sequence to business emails | 3 touches over 14 days | [nice] | Resend (separate domain recommended) |
| Cold-call/SMS guard | Blocks marketing SMS to prospects without consent | Always (TCPA) | [core] | App |
| Fleet PM automation | Per-unit mileage/hours reminders batched to fleet manager | Weekly digest | [strong] | App + Resend |
| Monthly fleet report | Units serviced, downtime, spend, upcoming due | 1st of month | [strong] | App + Resend |
| Quarterly business review | Value summary and renewal/upsell | Quarterly | [nice] | App |
| Priority scheduling SLA | Reserved fleet slots advertised in proposals | Calendar rule | [nice] | App |
| Net-terms invoicing | Invoice with terms and statements | On invoice | [nice] | Stripe |

### M19. Events & community (dyno days etc.)

| Feature | What it does (≤12 words) | Trigger / timing | Priority | Needs account? |
|---|---|---|---|---|
| Event manager | Dyno day, open house, tech clinic; capacity and waitlist | On creation | [strong] | App |
| Dyno slot booking + waiver | Timed pulls with e-signed waiver and fee | At registration | [strong] | App + Stripe |
| Event reminder sequence | Details, parking, what to bring | 7 days, 1 day, morning of | [strong] | App + channels |
| Live dyno leaderboard | Public page updating results by class | Real-time during event | [strong] | App |
| Per-truck result card | Shareable graphic for each participant (with consent) | On pull saved | [strong] | App |
| Post-event follow-up | Photos, results, attendee-only offer | Next day | [strong] | App + channels |
| Event syndication | FB Event, GBP event post, site Event schema, Diesel World guide submission | On publish | [strong] | Meta, GBP |
| Build of the month | Nominate, vote, winner feature post and perk | Monthly | [strong] | App |
| Contest rules generator | Official rules, eligibility, no-purchase entry, Meta-compliant entry | On contest create (C15) | [strong] | App |
| Sponsor/vendor coordination | Vendor reps, giveaways, co-marketing asks | Per event | [nice] | App |
| Charity tie-ins | Toy drive / food bank truck meet | Seasonal | [nice] | App |
| Tech clinic series | "Learn to datalog", "towing setup" sessions | Quarterly | [nice] | App |

### M20. Analytics & attribution

| Feature | What it does (≤12 words) | Trigger / timing | Priority | Needs account? |
|---|---|---|---|---|
| Source → revenue funnel | Visits → leads → booked → jobs → paid revenue by channel | Live | [core] | App |
| Attribution models | First touch, last touch, lead-creating touch, self-reported | Selectable | [core] | App |
| Ad cost import | Daily spend from Meta, Google, TikTok; manual costs for print/events | Daily 6am | [core] | Meta, G-Ads, TikTok |
| CPL / cost per booking / CAC | Unit economics per channel and campaign | Live | [core] | App |
| ROAS on gross profit | Revenue and parts margin vs spend | Live | [strong] | App |
| LTV by source | 12-month customer value by acquisition channel | Monthly | [strong] | App |
| Call attribution report | Calls by tracking number, answered/missed, booked | Live | [strong] | TW-Voice |
| Speed-to-lead report | Median first-response time vs conversion rate | Live | [core] | App |
| Campaign and automation reports | Sends, clicks, bookings, revenue per campaign/automation | Live | [core] | App |
| Retention metrics | Returning rate, days between visits, reminder conversion | Monthly | [strong] | App |
| Cohort analysis | Behavior by first-visit month or source | Monthly | [nice] | App |
| Weekly marketing digest | Owner email: leads, cost, reviews, top post, suggestions | Monday 7am | [core] | App + Resend + LLM |
| Anomaly alerts | Lead drop, CPL spike, rating drop, SMS opt-out spike | Daily check | [strong] | App |
| Marketing calendar overlay | Plots campaigns/events against leads and revenue | Live | [nice] | App |
| Goal tracking | Monthly targets for leads, reviews, bookings | Live | [strong] | App |
| Export/Looker Studio | CSV and connector for outside analysis | On demand | [nice] | App |

### M21. AI assistant features

| Feature | What it does (≤12 words) | Trigger / timing | Priority | Needs account? |
|---|---|---|---|---|
| Marketing copilot chat | Natural-language: build segment, draft campaign, schedule for approval | On demand | [strong] | LLM |
| Weekly opportunity finder | Finds due services, empty bays, stale leads; proposes campaigns | Monday 6am | [strong] | LLM |
| Natural-language segment builder | "Cummins owners not seen in 12 months who tow" | On demand | [strong] | LLM |
| Draft everything | Emails, SMS, posts, ads, build pages, replies in brand voice | On draft | [core] | LLM |
| Compliance linter (AI + rules) | Deterministic banned-terms list plus model review | Every public/paid output (C1–C6) | [core] | App + LLM |
| Insight narrator | Explains dashboard changes in plain English | Weekly digest / on view | [nice] | LLM |
| Inbox reply assistant | Contextual reply drafts; never quotes unapproved prices | On thread open | [strong] | LLM |
| Voice/chat receptionist | See M1 | Real-time | [strong] | LLM + TW-Voice |
| Call/voicemail summarizer | See M2 | After call | [strong] | LLM |
| Image understanding | Tags photos (platform, part, before/after), blurs plates | On upload | [strong] | LLM (vision) |
| Guardrails and cost caps | Human approval for public output; monthly AI spend cap; prompt/output logs | Always | [core] | App |
| No-fabrication rule | Blocks invented dyno numbers, testimonials, reviews, customer names | Every generation | [core] | App |

### M22. Compliance & governance

| Feature | What it does (≤12 words) | Trigger / timing | Priority | Needs account? |
|---|---|---|---|---|
| Consent ledger (extends built) | Per channel/purpose: text version, timestamp, IP, UA, URL, method | On every capture/change | [core] | App |
| Consent proof export | One-click evidence packet for any phone/email | On demand (disputes, carrier audits) | [core] | App |
| Opt-out by any reasonable means | STOP synonyms, free text, email reply, verbal note by staff | Processed immediately; legal max 10 business days (C4) | [core] | App + LLM |
| Revoke-all switch | Config to make one opt-out global across purposes | Ready for 2027-01-31 (rule under revision) | [strong] | App |
| Quiet-hours engine | Recipient-local 8am–9pm; FL/OK 8pm; shop default 9–8 | Every SMS/call send (C3) | [core] | App |
| Frequency caps with priority | Transactional > campaign > automated; per contact per channel | Every send | [core] | App |
| Internal do-not-call list | Required by SC TPPA; honored across calls/texts | On request, immediate | [core] | App |
| National DNC scrub | Scrubs non-customer numbers before any outbound marketing call | Before call lists; every 31 days | [nice] | Vendor: FTC DNC Registry SAN |
| Reassigned Numbers Database check | Detects numbers reassigned since consent (safe harbor) | Before messaging long-dormant contacts (>12 months) | [strong] | Vendor: FCC RND subscription |
| 10DLC registration helper | Brand/campaign details, sample messages, opt-in screenshots | One-time; on use-case change (C5) | [core] | TW-10DLC |
| Marketing vs transactional classifier | Tags each template so caps/consent rules apply correctly | On template save | [core] | App |
| CAN-SPAM enforcement | Address, sender identity, honest subject, unsubscribe | Template validation | [core] | App |
| Bulk sender compliance monitor | SPF/DKIM/DMARC, one-click unsubscribe, complaint rate < 0.3% | Daily (C14) | [core] | Resend |
| Review policy guard | Blocks gating, incentives, employee-name asks, quotas, Yelp asks | Template and automation validation (C6) | [core] | App |
| Emissions claims guard | Banned terms, required disclaimer, SKU compliance gating | Every output, feed and campaign (C1–C2) | [core] | App + LLM |
| Endorsement/testimonial rules | Media releases; influencer/affiliate disclosure (#ad) enforced | On publish | [core] | App |
| AI content labeling policy | Tracks AI-generated assets; no photoreal fake customers | On generation (C12) | [strong] | App |
| Ad platform policy pre-check | Meta/Google/TikTok restricted-content checklist per ad | Before approval | [core] | App + LLM |
| Contest/sweepstakes compliance | Official rules, no-purchase-necessary, Meta promo rules | On contest create (C15) | [strong] | App |
| Financing disclosure check | Flags Reg Z "trigger terms" (e.g. APR/payment amounts) needing disclosures | On financing copy | [nice] | App |
| Call recording disclosure | Plays notice before recorded calls | Every recorded call | [nice] | TW-Voice |
| Approval workflow + audit log | Who drafted, approved, sent what, when, to whom | Always | [core] | App |
| Role permissions | Techs capture media; only owner/manager send or spend | Always | [core] | App |
| Record retention | Keeps consent and send logs 5+ years (TCPA 4-yr limitations) | Retention policy job | [strong] | App |
| Data sharing hygiene | SMS opt-in data never shared/sold; hashed uploads only | Always (carrier + platform terms) | [core] | App |
| Legal review checkpoints | Counsel sign-off flags on SMS terms, waivers, tuning copy | Before go-live and on change | [core] | Outside counsel |

### M23. Marketing operations & admin

| Feature | What it does (≤12 words) | Trigger / timing | Priority | Needs account? |
|---|---|---|---|---|
| Marketing home dashboard | Today: leads, replies owed, approvals pending, spend, reviews | Live | [core] | App |
| Approval queue | One list of drafts awaiting owner OK (mobile-friendly) | Push/SMS when items waiting > 4h | [core] | App |
| Unified marketing calendar | Campaigns, posts, events, seasonal windows, ad flights | Live | [core] | App |
| Asset library | Photos/videos tagged by truck, platform, part, consent status | On upload | [core] | App (Supabase Storage) |
| Template library | Email, SMS, social, ad, review reply templates with versions | Always | [core] | App |
| Campaign builder wizard | Goal → audience → channels → content → schedule → approve | On demand | [core] | App |
| Automation builder (visual) | Trigger → wait → condition → action for custom flows | On demand | [strong] | App (Vercel Workflow) |
| Automation recipe library | One-click installs of M7/M8 flows | On demand | [strong] | App |
| Budget planner | Monthly marketing budget by channel vs actual | Monthly | [strong] | App |
| Integration health page | Token expiry, webhook failures, 10DLC status, domain auth | Daily check; alert on failure | [core] | App |
| Channel settings | Numbers, sender names, domains, quiet hours, caps | Setup | [core] | App |
| Demo/test mode (extends built) | Per-channel sandbox with demo phone | Env flag per channel | [core] | App |
| Owner mobile quick actions | Approve, reply, pause ads, post from phone | Always | [strong] | App |
| Checklists | Weekly GBP post, monthly citation audit, quarterly compliance review | Recurring | [strong] | App |

---

## 3. Diesel-specific marketing plays

| Play | How it works in the panel | Modules | Priority | Notes and limits |
|---|---|---|---|---|
| **Dyno days** | Quarterly event with slot booking, waivers, live leaderboard, per-truck result cards, next-day attendee offer, GBP/FB event posts | M19, M10, M1 | [strong] | Only verified-compliant builds on the dyno for public content. Class results by platform. Get media consent at check-in. |
| **Build of the month** | Nominations from completed showcase jobs → public vote (compliant mechanics) → winner build page + posts + perk | M19, M10, M13 | [strong] | Contest rules (C15). Don't require shares or tags to enter. The perk must not be tied to a review (C6). |
| **Dyno-sheet content engine** | Every dyno entry produces a branded card; with consent it auto-drafts IG/FB/GBP posts and a build page | M10, M13, M12 | [core] | Real numbers only (no-fabrication rule). Blur plates. |
| **Towing season** (Charleston boat season ~Mar–Oct) | Pre-season towing inspection offer to trucks tagged "tows", trans/cooling focus, trailer-brake check; Meta ads to boat-owner interests near marinas | M8, M7, M11 | [core] | Big local angle: marine and fishing culture. Partner with boat/trailer dealers (M14). |
| **Hurricane readiness** | "Evacuation-ready truck" check in late May; storm-watch triggered reminder | M8 | [strong] | Avoid crisis exploitation in ads (Meta restricted "commercial exploitation of crises"). Keep the tone as a service reminder. |
| **Winter diesel issues** | Batteries, glow plugs/grid heaters, anti-gel additive, DEF for owners traveling north or hunting inland; Nov–Jan | M8 | [strong] | Charleston rarely gels. Frame it as trips, towing and cold starts. |
| **Platform known-issue campaigns** | Segment by engine: LML CP4.2 fuel pump risk, 6.0 head studs/EGR cooler, 6.4 fuel dilution, early L5P/6.7 items; educational content + inspection offer | M7, M4, M13 | [strong] | Educational tone, no fear-mongering. The fix must be compliant (no EGR delete as the "fix"). |
| **Tune revision notices** | When a new *compliant* revision is logged for a platform, notify trucks on older revisions | M7, M4 | [strong] | Requires the tune log (built) plus SKU compliance tags (M17). |
| **"Legal power" positioning** | Compliance content hub + "EPA-compliant performance" messaging vs local shops still deleting | M13, M22 | [core] | Differentiator plus risk reduction. Counsel approves claims. Only claim "CARB EO"/"SEMA verified" with documentation. |
| **Fleet accounts** | Fleet funnel, proposal generator, PM automation, monthly fleet reports; targets marine, landscaping, construction, towing | M18 | [strong] | No cold texting (TCPA). B2B email is OK under CAN-SPAM. |
| **Parts-bundle promos** | Turbo + install + (compliant) tune; injector set + fuel filters + install; Shopify code + shop invoice bundle | M15, M17 | [strong] | Unverified tuning SKUs are excluded automatically. Show "starting at" pricing honestly. |
| **Shopify parts → install handoff** | Order of install-heavy SKU from a local ZIP → "want us to install?" booking offer | M17, M7 | [strong] | Needs marketing consent, or phrase it as a transactional order follow-up. Counsel should confirm the phrasing. |
| **Shopify abandoned-cart handoff limits** | Shopify's native abandoned-checkout email stays primary. Our app only reports high-ticket abandoned carts to the owner; personal outreach only to consented contacts | M17 | [nice] | No abandoned-checkout webhook, restricted API access, consent flags required (C13). No SMS without SMS consent. |
| **Used diesel pre-purchase inspection** | Lead magnet + booking page for buyers of used trucks; converts to long-term customers | M1, M7 | [strong] | Strong search intent. Good for LSA (repair category). |
| **Datalog review service** | Customers upload datalogs; the shop reviews and recommends compliant fixes; follow-up offer | M1, M7 | [nice] | Positions expertise. Leads to service. |
| **Manufacturer dealer-locator backlinks** | Get listed as a DDP/EZ LYNK/other brand installer | M13 | [strong] | Free referral traffic plus links. |
| **Military appreciation** | Verified discount + events for Joint Base Charleston personnel | M15, M19 | [strong] | Local demographic fit. |
| **Truck of the week (UGC)** | Customers submit trucks; feature posts; photo consent | M10 | [nice] | Builds the small social following (IG 188 / TikTok 294 at discovery). |
| **Tech clinics** | "Learn to datalog", "towing setup" nights; lead capture | M19 | [nice] | Community plus email list growth. |
| **Maintenance membership for diesel owners** | Prepaid fuel filters/oil plan; recurring revenue | M14 | [strong] | Stripe subscriptions. |

---

## 4. Ten highest-impact items (recommended build order)

1. **GBP claim/verify + review engine + weekly GBP posts** (M9, M10, M13). There are zero reviews and no profile today, and local ranking and trust depend on both.
2. **Compliance core: consent ledger, quiet hours, frequency caps, opt-out by any means, audit log** (M22). This unlocks SMS marketing safely and is a prerequisite for 10DLC approval.
3. **Emissions claims guard + SKU compliance tags + ad negative lists** (M22, M17, M11). One ad-account ban or EPA civil action costs more than every other feature earns.
4. **Missed-call text-back + speed-to-lead SLA escalation** (M1, M2), with the AI after-hours receptionist next. Fast replies win the lead.
5. **Source → revenue attribution**: UTM/click IDs, call tracking, self-reported source, cost import, offline conversions to Meta CAPI and the Google Data Manager API (M16, M20, M11).
6. **Job → build page → social/GBP content pipeline** with dyno cards, media consent and plate blur (M10, M13). This turns the shop's best asset into free marketing.
7. **Mileage-predicted service reminders + declined-work ladder + win-back** (M7). Highest-ROI retention, proven by Kukui, Shopmonkey and Tekmetric.
8. **Diesel segment builder + email/SMS broadcasts + seasonal calendar** (towing/boat season, hurricane, winter trips) (M4, M5, M6, M8).
9. **Referral program + partner referrals** (boat/RV/trailer dealers, fleets) (M14).
10. **Instant price estimator + offer landing pages + Meta lead-ads sync with an approval-gated ad template** (M1, M11, M12).

---

## 5. Gaps, uncertainties, things to verify

- **Named emissions category in ad policies.** I did not find explicit "defeat device" wording in the Google Ads, Merchant Center or Meta policy pages fetched on 2026-09-17. One secondary source (scubemarketing.com) says Merchant Center disapproves defeat devices. The treat-as-prohibited stance is still right, but don't quote a specific policy clause to the owner without checking the live policy page.
- **Revoke-all rule.** An FCC draft order to narrow it circulated on 2026-09-09. Recheck before building cross-purpose revocation.
- **Shopify abandoned-checkout access.** The deprecation detail comes from a secondary source. Check the Admin API changelog for the store's API version.
- **TikTok draft/inbox upload vs Direct Post.** Audit restrictions definitely apply to Direct Post. Confirm the draft-upload behavior for unaudited apps before promising it.
- **LSA diesel categories.** Confirm which auto categories are open in Charleston and whether "diesel repair" maps to one.
- **Instagram publishing limit.** Sources say both 50 and 100 posts/24h. Query `content_publishing_limit` per account.
- **Meta "commercial exploitation of crises".** It is listed as restricted. Check the exact wording before running hurricane-themed ads.
- **Platform known-issue claims** (CP4.2, head studs, fuel dilution) are widely discussed in the diesel community. Have the owner/techs validate wording before publishing.
- **Service interval tables** must come from OEM schedules and the shop's own practice. None are asserted here.
- **Financing, Reg Z trigger terms, sweepstakes law:** flagged for counsel. No SC-specific research was done here.
- **Priorities assume a new single-location shop** with a small following and no reviews. Revisit after 6 months of data.

---

## 6. References (accessed 2026-09-17)

Credibility: **P** = primary/official, **R** = reputable legal/trade press, **S** = secondary blog or vendor marketing (verify).

**Compliance and law**
- P: FTC, final rule banning fake reviews and testimonials: https://www.ftc.gov/news-events/news/press-releases/2024/08/federal-trade-commission-announces-final-rule-banning-fake-reviews-testimonials
- P: FTC, Consumer Reviews and Testimonials Rule Q&A: https://www.ftc.gov/business-guidance/resources/consumer-reviews-testimonials-rule-questions-answers
- P: SC Code §37-21-30, time restrictions (Justia): https://law.justia.com/codes/south-carolina/title-37/chapter-21/section-37-21-30/
- P: SC Telephone Privacy Protection Act: https://www.scstatehouse.gov/code/t37c021.php
- R: Arnold & Porter, "Freedom to Fix" memo and EPA guidance (Jul 2026): https://www.arnoldporter.com/en/perspectives/blogs/environmental-edge/2026/07/new-presidential-memorandum-and-epa-guidance-on-vehicle-tampering
- R: CDLLife, DOJ stops criminal charges for deletes/tunes: https://cdllife.com/2026/doj-will-no-longer-pursue-criminal-charges-for-diesel-deletes-and-tunes/
- R: TruckingInfo, DOJ pulls back on criminal prosecution: https://www.truckinginfo.com/news/justice-department-pulls-back-on-criminal-prosecution-of-diesel-emissions-delete
- P: EPA enforcement alert on aftermarket defeat devices: https://www.epa.gov/sites/default/files/2020-12/documents/tamperinganddefeatdevices-enfalert.pdf
- R: Day Pitney, 11th Circuit vacates one-to-one consent: https://www.daypitney.com/eleventh-circuit-vacates-fccs-one-to-one-consent-rule
- R: Womble Bond Dickinson, FCC repeals one-to-one rule: https://www.womblebonddickinson.com/us/insights/blogs/fcc-repeals-one-one-consent-rule-following-eleventh-circuit-decision
- R: CFS Law Monitor, revoke-all rule extended to 2027: https://www.consumerfinancialserviceslawmonitor.com/2026/01/fcc-further-extends-effective-date-for-tcpa-revoke-all-rule/
- S: ActiveProspect, revocation of consent guide: https://activeprospect.com/blog/tcpa-revocation-of-consent/
- P: FCC DA 26-12: https://docs.fcc.gov/public/attachments/DA-26-12A1.pdf
- S: LeadFriendly, TCPA calling hours by state: https://www.leadfriendly.com/guides/tcpa-calling-hours-by-state
- S: Tychron, 10DLC/TCR fees: https://www.tychron.com/the-campaign-registry/
- S: TextBolt, 10DLC compliance: https://textbolt.com/blog/10dlc-compliance/
- P: Gmail email sender guidelines FAQ: https://support.google.com/a/answer/14229414?hl=en
- S: Red Sift, 2026 bulk sender checklist: https://redsift.com/guides/bulk-email-sender-requirements
- S: SouthCarolinaLicensePlate.org, SC emissions testing: https://southcarolinalicenseplate.org/emissions-testing

**Platform policies**
- P: Meta Advertising Standards: https://transparency.meta.com/policies/ad-standards/
- P: Google Ads policies: https://support.google.com/adspolicy/answer/6008942?hl=en
- P: Google Ads, Enabling dishonest behavior: https://support.google.com/adspolicy/answer/6016086?hl=en
- P: Google Ads, Dangerous products or services: https://support.google.com/adspolicy/answer/6014299?hl=en
- P: Google Merchant Center, Shopping ads policies: https://support.google.com/merchants/answer/6149970?hl=en
- S: Scube Marketing, Merchant Center auto-parts disapprovals: https://www.scubemarketing.com/blog/troubleshooting-common-google-merchant-center-disapprovals-auto-parts
- P: eBay, emissions control defeat devices policy: https://www.ebay.com/help/policies/prohibited-restricted-items/emissions-control-defeat-devices-policy?id=5383
- P: Google Maps, prohibited and restricted content: https://support.google.com/contributionpolicy/answer/7400114?hl=en
- S: Launchcodex, GBP review policy update (Apr 2026): https://launchcodex.com/blog/seo-geo-ai/google-business-profile-review-policy-update/
- R: Search Engine Roundtable, review-gating language moved (2022): https://www.seroundtable.com/google-removes-maps-review-gating-policy-34002.html
- P: Yelp, Don't Ask for Reviews: https://www.yelp-support.com/article/Don-t-Ask-for-Reviews?l=en_US
- P: Google, Q&A API change log: https://developers.google.com/my-business/content/qanda/change-log
- R: PPC Land, GBP Q&A API discontinued: https://ppc.land/google-discontinues-business-profile-q-a-api-effective-november-3/
- P: GBP Help, chat and call history changes: https://support.google.com/business/answer/14919056?hl=en
- P: GBP Local Posts API: https://developers.google.com/my-business/reference/rest/v4/accounts.locations.localPosts
- P: TikTok Content Sharing Guidelines: https://developers.tiktok.com/doc/content-sharing-guidelines
- P: Google Customer Match policy: https://support.google.com/google-ads/answer/6299717?hl=en
- P: Google Ads API, Customer Match get started: https://developers.google.com/google-ads/api/docs/remarketing/audience-segments/customer-match/get-started
- P: Google Ads API, manage offline conversions: https://developers.google.com/google-ads/api/docs/conversions/upload-offline
- P: Google Ads Help, enhanced conversions for leads: https://support.google.com/google-ads/answer/15713840?hl=en
- P: Google Ads Help, LSA → Performance Max transition: https://support.google.com/google-ads/answer/17213585?hl=en
- R: Search Engine Land, LSA categories expanded: https://searchengineland.com/google-expands-local-services-ads-categories-ahead-of-migration-485695
- P: Meta newsroom, GenAI transparency for ads: https://about.fb.com/news/2025/02/gen-ai-transparency-metas-ads-products/
- S: Coinis, Meta AI labels in ads 2026: https://coinis.com/blog/meta-ai-content-labeling-facebook-instagram-ads-2026
- S: Common Thread, Meta ads changes 2026: https://commonthreadco.com/blogs/coachs-corner/meta-ads-changes-2026
- P: Meta for Developers, Conversions API for CRM integration: https://developers.facebook.com/documentation/ads-commerce/conversions-api/conversion-leads-integration
- S: RafflePress, Facebook contest rules: https://rafflepress.com/facebook-contest-rules/
- P: Shopify, Abandoned checkouts REST resource: https://shopify.dev/docs/api/admin-rest/latest/resources/abandoned-checkouts
- P: Shopify changelog, SMS marketing consent: https://shopify.dev/changelog/sms-marketing-consent
- S: TheConvertWay, Shopify abandoned checkout deprecation: https://www.theconvertway.com/blog/shopify-abandoned-checkout-deprecation
- S: Elfsight, Instagram Graph API guide 2026: https://elfsight.com/blog/instagram-graph-api-complete-developer-guide-for-2026/
- P: NHTSA datasets and APIs (recalls): https://www.nhtsa.gov/nhtsa-datasets-and-apis

**Platform feature teardowns**
- P: GoHighLevel, missed call text back: https://help.gohighlevel.com/support/solutions/articles/48001239140
- S: GHL Stack, GoHighLevel features 2026: https://ghlstack.com/gohighlevel-features-2026-guide/
- S: GoHighLevel.ai, AI features 2026: https://www.gohighlevel.ai/blog/gohighlevel-ai-features
- S: Business News Daily, Podium review: https://www.businessnewsdaily.com/16139-podium.html
- S: Capterra, Podium: https://www.capterra.com/p/164285/Podium/
- P: Birdeye, AI agents: https://birdeye.com/ai-agents/
- P: Broadly: https://broadly.com/
- P: HubSpot, Marketing Hub pricing guide: https://blog.hubspot.com/marketing/hubspot-marketing-hub-pricing
- P: Mailchimp features: https://mailchimp.com/features/
- P: Klaviyo, SMS quiet hours in flows: https://help.klaviyo.com/hc/en-us/articles/4408737146651
- P: Klaviyo, Personalized Send Time: https://help.klaviyo.com/hc/en-us/articles/45231714007323
- P: Tekmetric, Marketing Automations (support; frequency caps; page returned 403 to fetch, figures from search index): https://support.tekmetric.com/hc/en-us/articles/33212380922007-Marketing-Automations
- P: Tekmetric, Introducing Tekmetric Marketing: https://www.tekmetric.com/post/introducing-tekmetric-marketing-keep-customers-coming-back-automatically
- R: MOTOR, Tekmetric launches built-in marketing: https://www.motor.com/2025/10/tekmetric-launches-built-in-marketing-tool/
- P: Shopmonkey, campaigns: https://www.shopmonkey.io/product/automotive-marketing/campaigns
- P: Shopmonkey, CRM Essentials Campaigns: https://support.shopmonkey.io/hc/en-us/articles/38744487859860-CRM-Essentials-Campaigns
- P: AutoLeap, marketing CRM: https://autoleap.com/marketing/
- P: BusinessWire, AutoLeap AIR launch (Apr 2026): https://www.businesswire.com/news/home/20260428092601/en/AutoLeap-Introduces-the-First-AI-Receptionist-for-Auto-Shops-AutoLeap-AIR
- P: Kukui: https://www.kukui.com/
- P: Kukui, Mudlick Mail partnership: https://www.kukui.com/kukui-forms-partnership-with-mudlick-mail
- P: AdCreative.ai v5 announcement: https://www.adcreative.ai/post/announcing-adcreative-ai-v5-with-two-new-features-product-photoshoot-ai-and-creative-scoring-ai
- P: Meta Advantage+ creative: https://www.facebook.com/business/ads/meta-advantage-plus/creative
- P: Google Ads Help, PMax asset group with generative AI: https://support.google.com/google-ads/answer/15097192?hl=en
- P: Google blog, Gemini models in Performance Max: https://blog.google/products/ads-commerce/gemini-models-are-coming-to-performance-max/
- S: DigitrendZ, Asset Studio upgrades: https://digitrendz.blog/digital-marketing/189318/google-upgrades-asset-studio-with-gemini-video-and-creative-tools/

**Diesel and local**
- R: Diesel World, 2026 diesel events guide: https://www.dieselworldmag.com/?p=78405
- S: Heavy Duty Journal, diesel shop marketing strategies: https://heavydutyjournal.com/heavy-duty-marketing-8-strategies-diesel-shop-marketing/
- R: The Drive, diesel tuning black market as shops stop deleting: https://www.thedrive.com/news/sketchy-diesel-tuning-black-market-forming-as-us-shops-stop-deleting-trucks
- P: Nextdoor Ads Manager: https://business.nextdoor.com/en-us/nam/nextdoor-ads-manager

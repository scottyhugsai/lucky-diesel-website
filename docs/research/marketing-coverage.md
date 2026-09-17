# Marketing coverage matrix

Every feature in `docs/research/marketing-features.md` (all 392 rows, in the same
order), with where it lives in the app. Verified by reading the code, not by
reading file names. Written 2026-09-17.

## Status counts

| Status | Rows | Means |
|---|---|---|
| **Built** | 231 | Works in the app today. The `where` column names the route and/or function. |
| **Built, demo until account connected** | 94 | The whole path exists and runs in demo mode; a named third-party account makes it live. |
| **Needs owner** | 53 | Cannot be code alone: an account, a payment, a verification or counsel. The note is the exact step. |
| **Gap** | 14 | Not built. The note says why and what exists already. |

## How to read it

- **Built, demo** names the account in brackets: `TW-10DLC` (Twilio A2P texts),
  `TW-Voice`, `Resend`, `GBP`, `G-Ads`, `Meta`, `TikTok`, `Shopify`, `Stripe`,
  `GA4`/`GSC`, `LLM` (AI Gateway key). Same codes as the inventory.
- Demo mode never pretends: sends are simulated or go to the demo inbox, AI
  falls back to templates, and the admin shows a **Demo mode** chip.
- Compliance constraints C1–C16 from the inventory are enforced in code:
  emissions-claims lint, review-policy lint (no gating, incentives or Yelp
  asks), quiet hours per recipient with the 8pm states, consent ledger with
  revoke-all, and unverified SKUs excluded from every promotion and feed.

## The 14 remaining gaps

| Module | Feature | Why it is still a gap |
|---|---|---|
| M6 | Send throttling | Dispatcher sends a fixed batch per cron run; no per-minute cap until a carrier is live. |
| M9 | Flag-and-report workflow | Removals happen in Google's and Facebook's own consoles. |
| M10 | Plate and VIN auto-blur | Owner photos are flagged for privacy review instead; detection needs a vision model. |
| M10 | Best-time suggestions | Calendar suggests fixed windows; engagement-based timing needs platform insights. |
| M11 | Customer list audiences | Hashed-list export screen not built (Google also needs $50k history, C9). |
| M11 | Competitor ad research | No in-app view; the Meta Ad Library is a manual look. |
| M12 | Creative pre-flight scoring | Compliance lint runs; no readability/contrast score. |
| M12 | Real-photo replacement queue | AI images are labelled, but there is no swap-in queue. |
| M12 | Licensed stock library | No license ledger; the studio uses shop photos and generated frames. |
| M14 | Referral leaderboard | Opt-in flag and name helper exist; no public board. |
| M19 | Dyno slot booking + waiver | Slot maths, waiver text and columns exist; the public form has no slot or waiver step. |
| M19 | Live dyno leaderboard | Leaderboard builder and result columns exist; no public board. |
| M19 | Per-truck result card | Results are recorded; no shareable card image. |
| M23 | Asset library | Photos live in Gallery, creatives in the studio; no tagged library with license fields. |

## Owner steps, grouped

- **Twilio** — buy a number, register the A2P 10DLC brand and campaign with the
  LLC's EIN (Settings › 10DLC assembles the packet). Unlocks every SMS row.
- **Resend** — verify the sending subdomain, then paste the key. Unlocks email
  broadcasts, lead-magnet delivery, digests and fleet reports.
- **Google Business Profile** — claim and verify at business.google.com, then
  request Business Profile API access. Unlocks review sync, replies, posts.
- **Google Ads / Data Manager, Meta, TikTok** — accounts plus business
  verification and app review. Unlocks pixels, CAPI, offline conversions,
  audiences and posting.
- **Shopify** — custom app with an Admin API token. Unlocks order, customer and
  consent sync, discount push and true store revenue.
- **Stripe** — subscription product for the maintenance membership and gift cards.
- **AI Gateway** — card on file, then `MARKETING_AI_MODE=live`. Turns every
  template generator into a real writer, inside the monthly cap.
- **Counsel** — SMS terms, the privacy page (still marked draft), tuning copy
  and the contest rules.

## M1. Lead capture & funnels

| Module | Feature | Status | Notes |
|---|---|---|---|
| M1 | Offer landing page builder | Built — `/admin/marketing/pages` · `/l/[slug]` · `lib/marketing/content/landing-service.ts listActiveOffers` | Blocks hero/offer/proof/form/FAQ; expired offer shows expired + noindex, not unpublished |
| M1 | Instant price estimator | Built — `/#quote` range hint · `lib/marketing/engage/rules.ts priceRangeFor`; ranges set in Pages › Site widgets | Honest range, price confirmed after inspection |
| M1 | Build goal quiz | Built — `/build-planner` goal/budget steps · `components/planner/QuoteRequest.tsx` | Planner goal+budget → recommended parts → lead via /api/lead |
| M1 | Build planner → lead handoff (extends built) | Built — `components/planner/QuoteRequest.tsx` → `/api/lead createWebsiteLead` | Plan saved as text details; no numeric deal value stored |
| M1 | Used-diesel pre-purchase inspection offer | Needs owner — write the page in Pages › Landing pages (builder + blocks ready) | Template, schema and form already exist |
| M1 | Downloadable platform guides (lead magnets) | Built, demo until account connected — Resend · `/l/[slug]` MagnetForm · `deliverLeadMagnet` | Emails checklist text (not PDF); send fails without RESEND_API_KEY |
| M1 | Seasonal free check offers | Built — `/admin/marketing/pages` offer endsAt · `/admin/marketing/campaigns/seasonal` | Manual publish; calendar does not auto-toggle pages |
| M1 | Multi-step form with partial capture | Built — `/api/lead/partial` · `lib/marketing/engage/partial.ts savePartial` | Step-1 contact saved before the rest |
| M1 | Abandoned-form follow-up | Built, demo until account connected (TW-10DLC / Resend) — `runPartialFollowUps` in the marketing cron | Consent text stored with the partial |
| M1 | VIN / year-make-model autofill on forms (extends built) | Built — `/api/marketing/vin` (free NHTSA) + VIN field in `components/quote/QuoteForm.tsx` | Fills truck and engine |
| M1 | Fitment checker | Built — `/store/products/[handle]` · `components/store/FitmentCheck.tsx` | Uses Shopify catalog; no install-lead CTA or interest logging |
| M1 | Link-in-bio page | Built — `/links` · admin in Pages › Link in bio | Buttons are counted short links |
| M1 | QR codes per placement | Built — `components/admin/marketing/growth-ui/UtmBuilder.tsx` · `lib/marketing/engage/qr.ts` | In-repo encoder, SVG, carries UTMs |
| M1 | Missed-call text-back | Built, demo until account connected — TW-Voice + TW-10DLC · `/api/marketing/twilio/voice` · `handleVoiceStatus` | SMS simulated unless MESSAGING_SMS_MODE=live; owner alerted |
| M1 | Call tracking numbers | Built, demo until account connected (TW-Voice) — Reports › Calls by source · `marketing_tracking_numbers` | Numbers recorded; routing needs Twilio |
| M1 | Dynamic number insertion | Built — `useDynamicNumber` via `MarketingWidgets` (source from the attribution cookie) | Swaps tel:/sms: links per source |
| M1 | Web chat widget | Built — site bubble `ChatPanel` + `/api/marketing/chat`; shop replies in Contacts › Inbox › Web chat | Texts the visitor when they opted in |
| M1 | AI after-hours chat qualifier | Built, demo until account connected (LLM) — `lib/marketing/engage/chat.ts afterHoursPrompt` auto-reply | Template reply until AI Gateway is on |
| M1 | AI voice receptionist | Needs owner — buy a Twilio voice number and an AI voice vendor, then point the webhook at `/api/marketing/twilio/voice` | No in-app path without a carrier |
| M1 | Meta Lead Ads sync | Needs owner — Meta app review for leads_retrieval, then add the webhook; mapper ready (`external-leads.ts mapMetaLead`) | Mapper and tests exist |
| M1 | Google lead form asset sync | Needs owner — Google Ads lead-form webhook key; mapper ready (`mapGoogleLead`) | Mapper and tests exist |
| M1 | LSA lead import | Needs owner — LSA profile verification first (no in-app path) | LSA has no diesel-tuning category |
| M1 | Third-party lead email parsing | Needs owner — Resend inbound domain; parser ready (`parseLeadEmail`) | Parses Yelp/Angi style emails |
| M1 | Event registration pages | Built — `/events/[id]` · `app/(site)/events/[id]/actions.ts` | Capacity + waitlist; no confirmation/reminder messages sent |
| M1 | Fleet inquiry funnel | Built — `/fleet` + `FleetInquiryForm` → `/api/marketing/fleet`; queue in Growth › Fleet | Separate fleet fields and source |
| M1 | Financing pre-qualification CTA | Needs owner — pick a partner and paste the link in Pages › Site widgets | Link field and CTA wiring ready |
| M1 | "Notify me" waitlist | Built — `NotifyMeForm` → `/api/marketing/waitlist`; `notifyWaitlist` sends when the topic opens | Back-in-stock runs from the cron |
| M1 | Spam and bot protection | Built — `lib/lead.ts parseLead` honeypot · `/api/lead` rate limit | In-memory per-instance throttle; no Turnstile |
| M1 | Lead dedupe and merge | Built — `lib/domain/leads.ts findOrCreateCustomer` | Matches email then phone; no VIN match or merge UI |
| M1 | "How did you hear about us?" field | Built — select in `QuoteForm` → `leads.heard_about` · segment field | Self-reported source next to UTMs |

## M2. Conversations & speed-to-lead

| Module | Feature | Status | Notes |
|---|---|---|---|
| M2 | Unified inbox | Built — `/admin/marketing/contacts/inbox` · `lib/marketing/core/inbox-service.ts` | Texts, email and web chat per person |
| M2 | Speed-to-lead SLA timer | Built — `lib/marketing/core/crm-sweep.ts slaAlerts` · owner then backup alert | Thresholds in Settings |
| M2 | Assignment and internal notes | Built — Inbox assign + notes · `crm_notes` | Notes never leave the shop |
| M2 | Canned replies / snippets | Built — Inbox snippets · `reply_snippets` with `{{booking_link}}` | Five ship with the seed |
| M2 | AI suggested replies | Built, demo until account connected (LLM) — Inbox Suggest · `draftReply` | Template draft until AI is on |
| M2 | Missed-message follow-up | Built — `crm-sweep.ts unansweredAlerts` (2h default) | Skips snoozed and closed threads |
| M2 | Voicemail transcription and summary | Needs owner — Twilio voice number and recording consent wording | App does not take calls yet |
| M2 | Call summary to CRM | Needs owner — same Twilio voice step | Demo phone log only |
| M2 | IG/FB comment-to-DM | Needs owner — Meta app review for messaging permissions | No in-app path |
| M2 | Comment inbox | Needs owner — Meta app review | No in-app path |
| M2 | Text-to-book link | Built — Inbox "Text the booking link" · `bookingLinkFor` prefills truck and service | Demo send until 10DLC |
| M2 | Snooze and reminders | Built — Inbox snooze · `snoozeJustEnded` fires the follow-up alert | A new message reopens it |
| M2 | Business-hours auto-responder | Built, demo until account connected (TW-10DLC) — `lib/marketing/core/after-hours.ts autoReplyIfClosed` | Once per 2h per person |
| M2 | Opt-out intent detection | Built, demo until account connected — TW-10DLC · `/api/marketing/twilio/sms` · `consent.ts handleInboundSms` | Regex natural-language STOP (`compliance.ts NATURAL_STOP`), no LLM needed |

## M3. Pipelines & lead scoring

| Module | Feature | Status | Notes |
|---|---|---|---|
| M3 | Kanban sales pipeline | Built — `/admin/marketing/contacts/pipeline` · `moveLeadStageAction` | Select-based mover; stages only created by `scripts/seed-marketing-core.mjs` |
| M3 | Multiple pipelines | Built — Contacts › Pipeline picker (Service / Builds / Fleet) · `lib/marketing/core/pipelines.ts` | Stages auto-create on first use |
| M3 | Automatic stage moves | Built — `crm-sweep.ts syncStages` (booked / won / lost) | Manual moves inside a status are kept |
| M3 | Deal value | Built — `leads.deal_value_cents` on pipeline cards · `parseDealValue` | Open value in the win/loss card |
| M3 | Rule-based lead score | Built — `lib/marketing/core/scoring.ts scoreLead` · cron `syncScoresAndStages` | Service/platform/source/recency/consent; recomputed daily, not per event |
| M3 | Engagement signals | Built — `lib/marketing/core/engagement.ts` folded into the card score | Touches, checkout clicks, replies, campaign clicks |
| M3 | Hot-lead alert | Built, demo until account connected (TW-10DLC) — `crm-sweep.ts leadAlerts` at the hot-score threshold | Once per lead |
| M3 | Predictive win score | Built — `lib/marketing/core/win-model.ts` shown as "% likely" on cards | Hidden until 20 outcomes |
| M3 | Stale deal alerts | Built — `crm-sweep.ts` stale digest (48h default) | One digest, not one alert each |
| M3 | Quote expiry nudge | Built, demo until account connected (TW-10DLC) — `crm_quote_expiry_nudge` · `work_orders.estimate_expires_at` | 3 days before expiry |
| M3 | Lost-reason capture | Built — `components/admin/marketing/core-ui/StageMover.tsx` · `moveLeadStageAction` | Required reason when moving to Lost stage |
| M3 | Lost-reason nurture tracks | Built, demo until account connected (Resend/TW-10DLC) — `speed.ts LOST_NURTURE` per reason | Price, timing, elsewhere, no response |
| M3 | Task queue with call scripts | Built — `/admin/marketing/contacts/tasks` · `lib/marketing/core/tasks.ts` | Scripts never quote a price |
| M3 | Win/loss dashboard | Built — Pipeline › Win / loss + By source · `winLossReport` | Median first reply and lost reasons |

## M4. Audience, segmentation & customer data

| Module | Feature | Status | Notes |
|---|---|---|---|
| M4 | 360° customer timeline | Built — `/admin/marketing/contacts/[id]` · `components/admin/marketing/core-ui/contact-detail-data.ts loadContactDetail` | Visits, messages, campaigns, conversions, consent, LTV. No Shopify orders or reviews. |
| M4 | Diesel segment builder | Built — `/admin/marketing/contacts/segments` · `lib/marketing/core/segment-rules.ts`, `segments.ts refreshSegment` | Platform, generation, mileage, services (incl. tune), LTV, visits, tags. Re-evaluated at send. |
| M4 | Platform/engine taxonomy | Built — `components/admin/core/vin.ts guessPlatform/guessGeneration` · `app/admin/customers/actions.ts` | NHTSA VIN decode sets platform and generation from `lib/site` PLATFORMS. |
| M4 | Truck usage profile | Built — contact panel + `TRUCK_USAGES` segment field | Tows, hauls, daily, show |
| M4 | Tune/build state per truck | Built — `app/shop/jobs/[id]/_performance/actions.ts` · `tune_records`/`build_items` · `components/portal/BuildSheet.tsx` | Tuner, revision, parts logged. Segments use them via service_history. |
| M4 | Predicted mileage | Built — `lib/marketing/core/scoring.ts predictMileage` | Used nightly by segments and `service.due` lifecycle emits. |
| M4 | RFM and VIP flags | Built — `lib/marketing/core/loyalty.ts syncScoresAndStages` · `scoring.ts lifecycleStageFor` | Nightly stage (repeat/vip/lapsed) plus spend tier. No true RFM score grid. |
| M4 | Churn-risk flag | Built — `visitRhythm` at-risk flag in Contacts list and detail | 1.5× their usual gap |
| M4 | Fleet/household grouping | Built — `/admin/marketing/growth` FleetPanel · `fleet_accounts`, `customers.fleet_account_id` | Fleet accounts with members and PM intervals. |
| M4 | Tags and custom fields | Built — `/admin/marketing/contacts/[id]` TagsPanel · `contacts/actions.ts saveTagsAction` | Tags manual, segmentable. No custom fields or rule-based auto-tags. |
| M4 | Consent state per channel | Built — `lib/marketing/core/consent.ts recordConsent` · `contact_consent_events` | SMS marketing/transactional, email marketing, evidence ledger. Email status defaults to "subscribed". |
| M4 | Suppression lists | Built — `/admin/marketing/settings#suppressions` · `gate.ts gateOutbound` | STOP, unsubscribe, bounce, complaint, DNC checked before every send. No sold/deceased reason. |
| M4 | CSV import with consent mapping | Built — `/admin/marketing/contacts/import` · `contact-import.ts` + `contact-import-run.ts` | Consent column required per row |
| M4 | Phone line-type lookup | Needs owner — Twilio Lookup (paid per number) | Landline texts fail silently today |
| M4 | Email validation | Built — `email-check.ts` MX check + `email-typo.ts` suggestions at capture | Blocks typos before send |
| M4 | Shopify customer/order sync | Built, demo until account connected (Shopify) — `/api/marketing/shopify` + `lib/store/shopify-sync.ts` | Webhook handler ready for a token |
| M4 | Truck sold / ownership change | Built — sold tag from the contact panel and inbound text (`truck-sold.ts`) | Stops truck-specific reminders |
| M4 | Data export and deletion request | Built — `/admin/marketing/contacts/[id]/export` + anonymize action | Consent proof included |

## M5. Email campaigns

| Module | Feature | Status | Notes |
|---|---|---|---|
| M5 | Broadcast composer | Built — campaign steps with blocks · `email-blocks.ts renderEmail` (HTML + text) | Sends stay demo until Resend |
| M5 | Template library | Built — `/admin/marketing/campaigns/seasonal` · `core-ui/seasonal.ts`, `draft-actions.ts createFromTemplateAction` | 4 templates (towing, hurricane, dyno day, winter). No newsletter/new-part/build spotlight. |
| M5 | Shopify product blocks | Built — product block from the public catalog (`lib/store/catalog.ts`) | No token needed |
| M5 | Build/dyno content blocks | Built — build and dyno blocks · `blockRefs` | Real numbers only |
| M5 | Merge fields and conditional blocks | Built — `lib/marketing/core/merge.ts renderConditionals` | Truck, service, tier conditions |
| M5 | Monthly newsletter autopilot | Built — `autopilot.ts draftMonthlyNewsletter` in the cron | Drafts only; owner approves |
| M5 | A/B testing | Built, demo until account connected (Resend) — `ScheduleFields.tsx` · `campaign-plan.ts assignVariant/pickWinner` | Test %, decide-after minutes, click or booking winner. Click winner needs campaign short links (see M6). |
| M5 | Send-time optimization | Built — `campaign-plan.ts` per-contact best hour from our own opens and bookings | Falls back to the shop window |
| M5 | Preview and test send | Built, demo until account connected (Resend) — `MessageEditor.tsx EmailPreview` · `draft-actions.ts testSendAction` | Single preview; no desktop/mobile/dark-mode variants. |
| M5 | Link and spam pre-check | Built — `deliverability.ts checkDeliverability` on every step | Broken-link probe exists (`link-check.ts`) but is not wired to a screen |
| M5 | Marketing subdomain and auth checklist | Built — Settings › Email deliverability (SPF/DKIM/DMARC via node:dns) | Owner still verifies the domain at Resend |
| M5 | One-click unsubscribe | Built, demo until account connected (Resend) — `gate.ts` List-Unsubscribe headers · `app/api/marketing/unsubscribe/route.ts` | RFC 8058 POST plus confirm page; token-signed. |
| M5 | Preference center | Built — `/preferences` signed-token page · `consent.ts preferencesForToken` | Topic-level choices |
| M5 | Bounce/complaint handling | Built, demo until account connected (Resend) — `/api/marketing/resend/webhook` | Suppresses on bounce and complaint |
| M5 | Engagement sunset | Built — `autopilot.ts runEngagementSunset` (`topics.ts sunsetStep`) | Asks, then stops mailing |
| M5 | CAN-SPAM footer | Built — `compliance.ts marketingEmailFooter` via `gate.ts` | Postal address is optional; owner must enter it in Settings. |
| M5 | Campaign reports | Built — `/admin/marketing/campaigns/[id]` · `CampaignReport.tsx`, `analytics.ts` | Delivered, bookings, revenue per variant. Clicks stay 0 without campaign short link. |
| M5 | Plain-text owner-style emails | Built — plain-text part from the stored sender name and address | No template chrome |

## M6. SMS / MMS campaigns

| Module | Feature | Status | Notes |
|---|---|---|---|
| M6 | SMS broadcast to segment | Built, demo until account connected (TW-10DLC) — `/admin/marketing/campaigns/new` · `campaigns.ts`, `campaign-dispatch.ts` | Simulated unless `MESSAGING_SMS_MODE=live`; consent-gated with preview. |
| M6 | MMS with image | Built, demo until account connected (TW-10DLC) — media URL supported in `lib/messaging/send.ts` | Demo mode logs the image |
| M6 | Keyword opt-in | Built, demo until account connected (TW-10DLC) — `topics.ts matchKeyword` START/JOIN in the inbound handler | Reply confirms the opt-in |
| M6 | Keyword auto-responders | Built, demo until account connected (TW-10DLC) — `sms_keywords` table + inbound handler | HOURS, PRICE, BOOK out of the box |
| M6 | STOP/HELP/START handling | Built, demo until account connected (TW-10DLC) — `app/api/marketing/twilio/sms/route.ts` · `consent.ts handleInboundSms` | Carrier keywords plus natural-language opt-out; signature-validated. |
| M6 | Business name in every message | Built — `compliance.ts ensureMarketingSms` via `gate.ts` | Prefixes business name and STOP line. |
| M6 | Quiet-hours scheduler | Built — `policy.ts quietHoursWindow/nextSendTime` · Settings sending rules | Shop time zone only; no per-recipient area code or FL/OK 8pm rule. |
| M6 | Frequency caps | Built — `gate.ts sentThisWeek` · Settings | Weekly cap (default 2 SMS); no 1/day cap. Transactional exempt. |
| M6 | Branded short links | Built — `ensureCampaignLink` per campaign · `/r/[code]` counts the click | Fixes campaign click reporting |
| M6 | Cost estimator | Built — segment and cost estimate in `MessageEditor` | Per-send and per-blast |
| M6 | Send throttling | Gap — the dispatcher sends a fixed batch per cron run; there is no per-minute cap | Batch size 500/run; add a cap when a carrier is live |
| M6 | Reply routing | Built, demo until account connected (TW-10DLC) — `consent.ts handleInboundSms` → `messages` · `/admin/messages`, contact timeline | Replies logged and exit drips; not tagged with campaign. |
| M6 | A/B test SMS copy | Built, demo until account connected (TW-10DLC) — `StepsComposer.tsx` · `campaign-dispatch.ts ensureWinner` | Booking metric works; click metric needs campaign short links. |
| M6 | Re-permission campaign | Built, demo until account connected (Resend) — email broadcast + `app/api/marketing/consent` (OfferDialog) | No prebuilt re-permission template or dedicated opt-in page. |
| M6 | SMS terms and privacy page | Built — `app/(site)/privacy/page.tsx` · `SMS_CONSENT_VERSION` in `lib/lead.ts`, Settings consent versions | Marked draft for attorney review; no separate terms page. |

## M7. Lifecycle & retention automations (beyond the 20 built)

| Module | Feature | Status | Notes |
|---|---|---|---|
| M7 | New customer welcome series | Built, demo until account connected (Resend/TW-10DLC) — `lifecycle-retention.ts welcomeEmits` (3 steps) | Runs from the lifecycle sweep |
| M7 | Post-tune check-in | Built, demo until account connected (TW-10DLC) — `lifecycle-rules.ts tuneEmits` · `mkt_tune_follow_up`, `mkt_dyno_recheck` | Day 3–10 and day 30–45 after `tune_records.flashed_at`. SMS only. |
| M7 | Post-install follow-up by job type | Built, demo until account connected (TW-10DLC) — `installFollowUpEmits` per job type | Break-in wording per install |
| M7 | Mileage-based service intervals (extends built) | Built, demo until account connected (TW-10DLC) — `lifecycle-rules.ts serviceDueEmits` · `scoring.ts predictMileage/isServiceDue` | Oil/filter only (7,500 mi minus 500). No per-platform interval table. |
| M7 | Time-based fallback reminders | Built, demo until account connected (TW-10DLC) — `lifecycle-rules.ts winBackEmits` (6 mo) | Runs as a marketing 6-month win-back, not as a `service.due`. |
| M7 | "Reply with your mileage" update | Built, demo until account connected (TW-10DLC) — `mileageAskEmits`; portal odometer form as the in-app path | Inbound parse needs a carrier |
| M7 | Declined work multi-step (extends built 30d) | Built, demo until account connected (TW-10DLC) — 30/90/180-day ladder in the lifecycle rules | Stops if they book |
| M7 | Win-back ladder | Built, demo until account connected (TW-10DLC / Resend) — `winBackEmits` · `mkt_win_back_6m/12m` · Settings | Month thresholds configurable, but only 6m/12m templates. No escalating value. |
| M7 | Lost-lead re-engagement | Built, demo until account connected — `lostLeadEmits` | Skips opted-out leads |
| M7 | Tune revision available | Built, demo until account connected (TW-10DLC) — `local-triggers.ts notifyTuneRevision` · `tune_revision_releases` | Only compliant revisions |
| M7 | Parts warranty expiring | Built, demo until account connected — `warrantyEmits` | From the parts line date |
| M7 | Build anniversary | Built, demo until account connected — `buildAnniversaryEmits` | One a year |
| M7 | Customer anniversary | Built, demo until account connected (Resend) — `birthdayAndAnniversaryEmits` · `mkt_customer_anniversary` | Uses the date of the first paid invoice. No perk. |
| M7 | Birthday | Built, demo until account connected — `birthdayAndAnniversaryEmits`; birthday collected in the portal profile | Local date, no year shown |
| M7 | Recall notices | Built — `syncVehicleRecalls` (free NHTSA API) in the cron · `vehicle_recalls` | Owner alert, factual wording |
| M7 | Platform known-issue education | Built, demo until account connected — `KNOWN_ISSUES` + `knownIssueEmits` | Educational, no fear-mongering |
| M7 | Next-stage build ladder | Built, demo until account connected — `NEXT_STAGE` + `nextStageEmits` | Compliant stages only |
| M7 | Parts buyer → install offer | Built, demo until account connected (Resend) — `checkoutClickEmits` · `mkt_store_checkout_follow_up` | Triggered by a store checkout click, not a real Shopify order. |
| M7 | Service customer → parts cross-sell | Built, demo until account connected — `crossSellEmits` from the live catalog | Excludes unverified SKUs |
| M7 | Portal activation nudge | Built, demo until account connected — `portalNudgeEmits` | Once per customer |
| M7 | Maintenance plan renewal | Needs owner — needs Stripe subscriptions and a plan product | No in-app plan yet |
| M7 | NPS promoter → referral ask | Built, demo until account connected — `promotions.ts referralAskTargets` + `sweepReferralAsks` | Never tied to leaving a review |
| M7 | Detractor recovery task | Built, demo until account connected (TW-10DLC / Resend) — `recordNpsResponse` owner alert · `detractorEmits` · `review_detractor_follow_up` | Sends an alert but creates no task record. Depends on NPS sends, which are broken (see M9). |
| M7 | Automation holdout groups | Built — holdout share in `campaign-plan.ts`, honoured by the automation engine | Measures lift honestly |

## M8. Seasonal & local campaign calendar (Charleston-specific)

| Module | Feature | Status | Notes |
|---|---|---|---|
| M8 | Seasonal calendar engine | Built — `/admin/marketing/campaigns/seasonal` · `lifecycle-rules.ts seasonalEmits` · Settings toggles | Auto-sends inside the window and has one-tap drafts. No 14-day auto-draft. |
| M8 | Boat/towing season prep | Built, demo until account connected (TW-10DLC / Resend) — `mkt_seasonal_towing` | Mar 1–Apr 15. No June reminder. |
| M8 | Summer heat cooling check | Built — `SEASONS` summer_heat (Jun 16–Jul 31) | Sends stay demo until a channel is live |
| M8 | Hurricane-season readiness | Built, demo until account connected (Resend) — `mkt_seasonal_hurricane` | May 20–Jun 15. No storm-watch trigger. |
| M8 | Hunting season | Built — `SEASONS` hunting_season, tag-gated | Only tagged trucks |
| M8 | Winter travel / cold start | Built, demo until account connected (Resend) — `mkt_seasonal_winter` | Oct 15–Nov 30. |
| M8 | Tax refund build season | Built — `SEASONS` tax_refund (Feb 1–Mar 15) | Build-plan angle |
| M8 | Black Friday / holiday parts sale | Built — `SEASONS` holiday_parts + offer engine; Shopify discount codes still need the store | Codes are app-side today |
| M8 | Local event tie-ins | Built — `local_events` + `draftLocalEventCampaigns` in the cron | Drafts 14 days ahead |
| M8 | Weather-triggered sends | Built — `runWeatherTriggers` (free NWS alerts) in the cron | Service tone, no crisis pitch |
| M8 | Open-bay fill (yield) | Built, demo until account connected — `runOpenBayFill` when the schedule is light | Caps recipients |

## M9. Reputation, reviews & feedback

| Module | Feature | Status | Notes |
|---|---|---|---|
| M9 | GBP claim/verify wizard | Built — Content › Local SEO checklist + `gbp_profile` fields; the claim itself is owner work | Needs owner: verify at business.google.com |
| M9 | Review request to every customer (extends built) | Built, demo until account connected (TW-10DLC / Resend; GBP review URL) — `review_request` + `review_reminder` · `/review` redirect | Fixed SMS then email. Channel isn't chosen by consent. |
| M9 | Review link on invoice/receipt and QR | Built — review link and QR on the invoice document · `logReviewRequest` records the ask | Sent to everyone, never gated |
| M9 | Review monitoring (Google) | Built, demo until account connected (GBP) — `reputation-service.ts syncGbpReviews` | Daily, not every 30 min. BUG: never scheduled (cron omits `?daily=1`). |
| M9 | Review monitoring (Facebook, Yelp, BBB, Nextdoor) | Needs owner — each platform needs its own account/API; Yelp forbids asking | Google sync is built |
| M9 | New-review alert | Built, demo until account connected (TW-10DLC / Resend) — `ingestReview` · `content_review_negative_alert` | Only 1–3 stars alert. New positive reviews send nothing. |
| M9 | AI reply drafts | Built, demo until account connected (LLM + GBP) — `draftReplyForReview` · /admin/marketing/reviews | Templated drafts in demo mode. Compliance-checked and approval-gated. |
| M9 | Auto-publish positive replies | Built, demo until account connected (GBP) — `autoPostPositiveReplies` in the daily cron | 5★, clean, unedited, 2h wait |
| M9 | Reply SLA tracker | Built — Reviews › replies overdue (24h low / 72h high) | From `replyOverdue` |
| M9 | Website review widget | Built — `components/marketing-public/ReviewStrip` (all 3 home designs) · `GET /api/marketing/content/reviews` | Shows only real manual reviews until GBP sync runs. |
| M9 | Review → social card | Built — "Make a post from this" on 4★+ reviews · `createReviewSocialPost` | Draft only, approval still applies |
| M9 | NPS/CSAT survey | Built, demo until account connected (TW-10DLC / Resend) — `requestNpsSurveys` · `/api/marketing/content/nps` | Review link is never gated. BUG: surveys never scheduled (cron omits `?daily=1`). |
| M9 | Sentiment and theme analysis | Built — `tagReviewThemes` in the daily cron · Reviews › What they talk about | Keyword themes, no LLM needed |
| M9 | Competitor rating tracker | Needs owner — needs a Google Places API key; `competitor_ratings` table is ready | Table exists, no fetcher |
| M9 | Review velocity dashboard | Built — Reviews › Review pace (6 months) | Public reviews only |
| M9 | Staff request leaderboard | Built — Reviews › Requests sent per staff member | Asks only, never reviews received |
| M9 | Flag-and-report workflow | Gap — no in-app flag queue; Google/Facebook removals are done in their consoles | Owner alert on low ratings exists |
| M9 | Video testimonial capture | Built — Reviews › Video testimonials (ask, upload link, approve) · `video_testimonials` | Release accepted at upload |
| M9 | Testimonial/media release ledger | Built — Social › Releases · `media_releases` | Scope, method and revoke per person |
| M9 | Yelp guardrail | Built — `REVIEW_POLICY_RULES` in `content/compliance.ts`, run by the template lint and Settings › Policy scan | Covers campaigns and automations |

## M10. Social media & organic content

| Module | Feature | Status | Notes |
|---|---|---|---|
| M10 | Channel connections | Built, demo until account connected (Meta, GBP, TikTok) — `/admin/marketing/content/connections` · `channels/registry.ts saveConnection/resolveConnection` | You paste tokens (no OAuth flow). No YouTube. Shows expiry/errors but sends no health alerts. |
| M10 | Content calendar | Built — `/admin/marketing/social` (week/month) · `SocialCalendar.tsx`, `social/actions.ts movePost` | Covers all channels and goes through approval. No drag-and-drop: open a post to move it. |
| M10 | AI content calendar | Built — `/admin/marketing/ads/autopilot` · `planner.ts planWeek`, `social-service.ts draftPillarPosts` | Rule-based weekly plan, not an LLM monthly plan. No events input. Not run on the 25th. |
| M10 | Build published → auto post | Built, demo until account connected (Meta + GBP) — `social-service.ts draftPostsForBuild` · `/admin/marketing/social` Auto-drafts | Drafts IG/FB/GBP/TikTok to approval queue. Auto trigger never fires (cron lacks daily=1). |
| M10 | Dyno result card generator | Built — `image/templates.tsx Dyno` · `/api/marketing/creative/[id]/image` · `draftPostsForDynoRun` | Card shows truck and HP/TQ bars; parts go in the caption. Not triggered when a dyno run is saved. |
| M10 | Dyno pull auto-post | Built, demo until account connected (Meta/TikTok) — daily cron drafts a card per new dyno run | Real numbers, consent gate on the release |
| M10 | Before/after compositor | Built — `before_after` image template in `content/image/templates.tsx` | Two photos side by side; no free-form editor |
| M10 | Reel/short auto-assembly | Needs owner — video generation needs a vendor; Meta/TikTok also need accounts | Stills only in-app |
| M10 | Plate and VIN auto-blur | Gap — every owner photo is flagged for privacy review instead; no blur tool | Auto-detection needs a vision model |
| M10 | Tech shot-list prompts | Built — Social › This week's ideas › Shots to grab · `shotListFor` from open jobs | Marks shots that need a release |
| M10 | Media consent per work order | Built — Social › Releases, linkable to a work order · `media_releases` | Endorsement check blocks unreleased posts |
| M10 | AI captions and hashtags | Built, demo until account connected (LLM) — `social.ts hashtagsFor/draftBuildPost` · `assistant.ts writeFromPrompt` · `checkContent` | GBP/TikTok captions are separate. Local hashtags added. Compliance-linted. Template copy until live AI. |
| M10 | GBP posts autopilot | Built, demo until account connected (GBP) — `channels/google.ts gbpPostAdapter` · `calendar.ts POSTING_WINDOWS.gbp` (Tue/Thu 10am) | Tip Tuesday pillar goes to GBP. Pillar drafting is a manual button (cron flag missing). |
| M10 | GBP photo uploads | Needs owner — verified Google Business Profile plus API access | Posts adapter is ready |
| M10 | TikTok handoff | Built, demo until account connected (TikTok) — `channels/tiktok.ts tiktokPostAdapter` (MEDIA_UPLOAD inbox draft) | Photo posts only. No video. No manual-post checklist. |
| M10 | YouTube Shorts / long dyno videos | Needs owner — YouTube channel and API project | No in-app path |
| M10 | Best-time suggestions | Gap — the calendar suggests fixed windows; engagement-based timing needs platform insights | Owner can pick any slot |
| M10 | Evergreen recycler | Built — Social › Worth another run · `pickEvergreen` + `recycleEvergreenAction` | 90-day age and cooldown |
| M10 | UGC submissions | Built — "Send us your truck" on `/gallery` → `/api/marketing/ugc`; moderation in Social › Releases | Private bucket, nothing auto-public |
| M10 | Social analytics | Needs owner — per-post metrics come from Meta/TikTok APIs | Click counts on our own links work |
| M10 | Community task prompts | Built — Social › Community weekly checklist · `social_task_log` | Ticks persist per ISO week |
| M10 | Nextdoor business posts | Built — Social › Nextdoor monthly copy block · `nextdoorPost` | Nextdoor has no posting API |

## M11. Paid advertising

| Module | Feature | Status | Notes |
|---|---|---|---|
| M11 | Ad account connections | Built, demo until account connected (Meta, G-Ads, TikTok) — `/admin/marketing/content/connections` · `channels/scopes.ts` | LSA card is read-only. No Microsoft. Status and expiry shown. Google tokens auto-refresh. |
| M11 | Campaign templates by goal | Built — `ad-presets.ts CAMPAIGN_TEMPLATES` in the ad campaign form | Objective, copy angle, radius |
| M11 | Geo targeting presets | Built — Charleston town presets and radius in the campaign form | Passed to every adapter |
| M11 | Approval gate | Built — `/admin/marketing/ads/approvals` · `approvals.ts canPublish/isApprovalValid` (payload hash) | Edits, budget changes or date changes void the approval. Spending needs a second click (`activateCampaign`). |
| M11 | Compliance pre-flight | Built — `compliance.ts checkContent` (+ `core/compliance checkClaims`) · off-road SKU block · real-review-only cards | Regex rules, no LLM. Blocked content can't be approved. |
| M11 | Negative keyword guard lists | Built — emissions and bargain-hunter negatives attached at publish | Blocks delete-related terms |
| M11 | Budget caps and pacing | Built, demo until account connected (Meta, G-Ads) — `budget.ts checkBudget/pacing` · `/admin/marketing/ads/campaigns` Budget caps | Caps fail closed. Pacing auto-pause runs only on manual "Sync now" (not hourly). |
| M11 | Seasonal budget multipliers | Built — Ads › Campaigns › season multipliers + `proposeSeasonalBudgets` (approval-gated) | Owner approves each proposal |
| M11 | Spend and performance alerts | Built — `ad_alerts` from `metrics-service.ts` with the cost-per-lead auto-pause | Owner alert once per condition |
| M11 | Automated rules | Built, demo until account connected (Meta, G-Ads) — `metrics-service.ts autoPauseReason` · `shouldPauseForCpl` | Pauses on lifetime CPL cap and pacing. No 7-day window or frequency rule. Not scheduled. |
| M11 | Meta CAPI (web + CRM events) | Needs owner — Meta business verification and app review | Conversion events are already stored |
| M11 | Meta conversion-leads optimisation | Needs owner — same Meta step | Adapter takes the objective |
| M11 | Google offline conversions | Needs owner — Google Ads account plus Data Manager API access | `syncConversions` prepares the payloads |
| M11 | Call conversion tracking | Needs owner — Twilio tracking numbers or Google forwarding numbers | Call rows and report exist |
| M11 | Website retargeting audiences | Needs owner — platform pixels (Meta/Google/TikTok) | Consent-gated loader is ready |
| M11 | Customer list audiences | Gap — the hashed-list export screen is not built; consent filtering and hashing helpers exist | Google also needs $50k history (C9) |
| M11 | Lookalike audiences | Needs owner — Meta ad account with a seed audience | No in-app path |
| M11 | Engagement audiences | Needs owner — Meta/TikTok accounts | No in-app path |
| M11 | Exclusions | Needs owner — platform audience lists | Suppression works for our own sends |
| M11 | Local Services Ads setup | Needs owner — create LSA profile in Google Local Services Ads and pass license, insurance and background checks | `lsaAdapter` imports leads only (demo). Disputes aren't built. |
| M11 | Performance Max for local | Built, demo until account connected (G-Ads) — `channels/google.ts googlePmaxAdapter` | Creates a PAUSED PMax with text assets. No image assets, no call/store goals, no geo. |
| M11 | TikTok Spark Ads | Needs owner — TikTok Ads account and creator codes | No in-app path |
| M11 | Microsoft Ads import | Needs owner — Microsoft Advertising › Import › Google Ads import (scheduled) | No Google Search campaigns exist yet to mirror. |
| M11 | Nextdoor / Yelp ads | Needs owner — run in Nextdoor Ads / Yelp Ads with a UTM or `?ref` link | Attribution already parses UTM/ref. No call tracking number. |
| M11 | Ad extensions manager | Needs owner — Google Ads account | Adapter stub only |
| M11 | Dayparting for call ads | Built — call-hours window per campaign in the ad form | Passed to the adapters |
| M11 | Disapproval monitor and appeal helper | Needs owner — platform review status comes from their APIs | Pre-flight claims lint runs in-app |
| M11 | Competitor ad research | Gap — no in-app research view; the Meta Ad Library is a manual look | Claims lint covers our own copy |
| M11 | Financing ad special category | Built — special-category flag with a minimum radius rule in the ad form | Blocks tight-radius financing ads |
| M11 | Direct mail (EDDM/postcards) | Needs owner — a print vendor; addresses export from Contacts | CSV export exists |

## M12. AI creative studio (for when no photos exist)

| Module | Feature | Status | Notes |
|---|---|---|---|
| M12 | Brand kit | Built — `/admin/marketing/settings` BrandVoiceForm · `brand.ts BRAND_COLORS/DEFAULT_VOICE` | Voice, rules, banned words and claims are editable. Logo, colours, fonts and disclaimers are code-only. |
| M12 | Data-driven templates (no photo needed) | Built — `image/templates.tsx` (dyno/product/offer/review/seasonal) · `/api/marketing/creative/[id]/image` | Review cards refuse reviews that aren't real. |
| M12 | Ad copy variant generator | Built, demo until account connected (LLM) — `/admin/marketing/ads` · `ai.ts generateAdVariants` · `brand.ts AD_LIMITS` | Per-platform character limits. Template copy until MARKETING_AI_MODE=live. |
| M12 | Product shot enhancer | Needs owner — needs an image model (AI Gateway with a card) | Product template renders without it |
| M12 | Illustrative AI scenes | Built, demo until account connected (LLM) — `photos.ts generateAiBackground` | Only used as a background for offer/seasonal/review. No visible "illustrative" label. |
| M12 | Stills-to-video | Needs owner — video vendor | No in-app path |
| M12 | Placement auto-resize | Built — `?format=1:1\|4:5\|9:16\|1.91:1` on image route · `/admin/marketing/ads/creative/[id]` | Rendered on demand at all 4 sizes. |
| M12 | Creative pre-flight scoring | Gap — compliance and claims lint run, but there is no readability/contrast score | Lint blocks the risky wording |
| M12 | Native AI toggles control | Built — Meta AI-rewrite opt-out per campaign in the ad form | Off by default on compliance-sensitive ads |
| M12 | AI provenance log | Built — `db.ts recordGeneration` → `ai_generation_jobs` · `creative_assets.ai_generation_id` | Logs model, prompt, tokens and cost. No AI-label field, no admin view. |
| M12 | Real-photo replacement queue | Gap — AI images are labelled but there is no swap-in queue | Owner can edit any creative |
| M12 | Creative fatigue detector | Needs owner — needs platform frequency metrics | Spend and CPL alerts exist |
| M12 | Licensed stock library | Gap — no license ledger; the studio uses shop photos and generated frames | Avoids stock entirely today |

## M13. SEO, local listings & content

| Module | Feature | Status | Notes |
|---|---|---|---|
| M13 | GBP profile manager | Built, demo until account connected (GBP) — Content › Local SEO profile fields · `gbp_profile` | Push needs verified GBP + API access |
| M13 | Holiday/special hours sync | Built — `shop_closures` + `components/seo/ClosureBanner.tsx` on the site; the GBP push waits on the account | Banner is live in-app |
| M13 | GBP performance import | Built, demo until account connected (GBP) — `search_metrics_daily` + `seo-search-service.ts` | Importer ready for a token |
| M13 | AI build-page writer (extends built) | Built — `/admin/marketing/content` · `seo-service.ts generateBuildPageDraft` → approval → `publishSeo` updates `builds` | Template copy only (generator hard-coded demo, no LLM path); manual trigger, not on job close |
| M13 | AI article/blog generator | Built, demo until account connected (LLM) — Content › drafts → `/blog`; template copy until the AI key is on | Only approved, non-sample posts are public |
| M13 | Service-area pages | Built — `/service-areas` + `/service-areas/[area]` from approved SEO content | Distinct copy per town, no doorway pages |
| M13 | FAQ hub (replaces GBP Q&A) | Built — `/faq` with FAQPage schema | GBP Q&A is gone (C7) |
| M13 | Structured data | Built — `components/seo/JsonLd.tsx` (LocalBusiness, Service, Event, FAQ, Article) | Sitemap includes the new pages |
| M13 | Citation builder and NAP audit | Needs owner — claim each directory listing | In-app tracker + `auditNap` built at `/admin/marketing/content` LocalSeoPanel; NAP not editable in UI |
| M13 | Brand disambiguation | Built — Content › Local SEO name/address/phone consistency checklist | Owner still fixes each listing |
| M13 | Manufacturer dealer-locator listings | Needs owner — ask DDP, EZ LYNK etc. for installer listings | Tracked as one seeded row in listings checklist |
| M13 | Search Console integration | Built, demo until account connected (GSC) — `search_metrics_daily` importer | Needs a Google property |
| M13 | Local rank grid tracking | Needs owner — subscribe to Local Falcon/BrightLocal | No code; vendor dashboard suffices |
| M13 | Internal link automation | Built — `components/seo/RelatedLinks.tsx` on builds, blog and service-area pages | Rule-based, no keyword stuffing |
| M13 | Content decay alerts | Built, demo until account connected (GSC) — decay check over `search_metrics_daily` | Needs search data first |
| M13 | Image SEO | Built — alt text required on gallery uploads and generated frames | Descriptive alts, no keyword stuffing |
| M13 | AI search visibility check | Needs owner — Ahrefs Brand Radar/Semrush subscription | No code path |
| M13 | Local PR / backlink tasks | Built — `seo_tasks` checklist in Content › Local SEO | Owner does the outreach |
| M13 | Compliance content hub (extends built) | Built — `/emissions-policy` page, linked from platform pages | Draft pending attorney review; no review-on-change log |
| M13 | Scaled-content guard | Built — `seo-guard.ts` blocks near-duplicate drafts before approval | Keeps service-area pages distinct |

## M14. Referrals & loyalty

| Module | Feature | Status | Notes |
|---|---|---|---|
| M14 | Personal referral links/codes | Built — `/portal`, `/refer/[code]`, `/admin/marketing/growth` · `referrals.ts ensureReferralCode` | Issued on portal visit/admin, not auto after first paid job |
| M14 | Share sheet (customer-sent) | Built — `components/marketing-public/ReferFriendPrompt.tsx` (navigator.share/copy) | On portal, quote and booking success screens |
| M14 | Double-sided rewards | Built — cron `processReferralRewards` on friend's first paid invoice | Referrer "credit" is loyalty points + message; friend discount applied manually |
| M14 | Reward ledger | Built — `loyalty_events` + referrals pipeline in growth Referrals/Loyalty panels | No expiry; redemptions only via manual negative adjust |
| M14 | Referral ask timing | Built — `sweepReferralAsks` after a paid job (and NPS promoters) | Never tied to a review |
| M14 | Partner referral program | Built — Growth › Referrals › partners · `referral_partners` + `partner_referrals` | Per-partner code and payout log |
| M14 | Loyalty points | Built — cron `syncLoyalty` earns on paid invoice; `adjustPoints` | No redeem-at-invoice flow |
| M14 | VIP tiers | Built — `rewards.ts tierForSpend`, nightly `syncLoyalty`, LoyaltyPanel | Thresholds in marketing settings |
| M14 | Tier perks | Built — Growth › Loyalty › Tier perks · `tier_perks` + upgrade message | Perk and labor % per tier |
| M14 | Maintenance membership | Needs owner — Stripe subscription product and terms | Prepaid plan not built |
| M14 | Wallet pass | Needs owner — Apple/Google pass certificates | No in-app path |
| M14 | Gift cards | Needs owner — Stripe or Shopify gift-card product | No in-app path |
| M14 | Creator/affiliate codes | Built — creator codes with commission tracking in Growth › Referrals | Commission per qualifying job |
| M14 | Referral leaderboard | Gap — opt-in flag and `leaderboardName` exist, but no public leaderboard page | Opt-in only by design |

## M15. Promotions & coupons

| Module | Feature | Status | Notes |
|---|---|---|---|
| M15 | Coupon engine | Built — `/admin/marketing/growth?tab=offers` · `offer-actions.ts createOffer`, `rewards.ts validateRedemption` | %/$/free service, limits, min spend, expiry; no bundle price |
| M15 | Unique single-use codes | Built — `singleUseCode` per offer claim · redeemed once | Checked at the invoice |
| M15 | Segment eligibility rules | Built — offer segment check runs at redemption (`redeemOffer`) | Blocks ineligible customers |
| M15 | Redemption at estimate/invoice | Built — Invoice › Discounts card · `lib/marketing/core/redemption.ts` | Code, points, referral and fleet % |
| M15 | Shopify discount sync | Built, demo until account connected (Shopify) — code push in `lib/store/shopify-sync.ts` | Needs an Admin API token |
| M15 | Parts + install bundles | Built — bundle offers with the install service attached | Unverified SKUs excluded |
| M15 | Offer expiry reminders | Built, demo until account connected — `sweepOfferExpiry` in the cron | 3 days before expiry |
| M15 | Military / first responder pricing | Built — program % applied at the invoice, staff-verified | No ID uploads stored |
| M15 | Fleet volume pricing | Built — `fleetPercentFor` tiers applied at the invoice | Per fleet account |
| M15 | Financing promos | Needs owner — sign up with a financing partner | Linter already warns on 0% APR copy |
| M15 | Merch gift with purchase | Built — gift-with-purchase offer type recorded on the invoice | Stock tracked by hand |
| M15 | Promo ROI report | Built — `promoRoi` in Growth › Offers | Redemptions, revenue and discount cost |
| M15 | Offer-claim lint | Built — `lintOffer` on save (no fake urgency, honest "starting at") | Blocks risky claims |

## M16. Website engagement & tracking

| Module | Feature | Status | Notes |
|---|---|---|---|
| M16 | UTM and click-ID capture | Built — `proxy.ts` · `capture.ts captureAttribution`, `attribution.ts recordTouch` | First+last touch; fbclid stored but no _fbc/_fbp |
| M16 | Landing page and referrer capture | Built — `attribution_touches.landing_path/referrer`, `/api/marketing/track` | Device only as user_agent on tracking_visitors |
| M16 | Cookie consent + Consent Mode v2 | Built — `ConsentBanner` + `TagLoader` (Consent Mode denied until they answer) | Nothing optional loads first |
| M16 | GA4 event map | Built, demo until account connected (GA4 ID) — `analytics.ts EVENT_MAP` through the consent-gated loader | Set `GA4_MEASUREMENT_ID` to turn it on |
| M16 | Meta Pixel + CAPI dedupe | Built, demo until account connected (Meta) — pixel via the loader with a shared event id | Server side needs app review |
| M16 | Google Ads tag + enhanced conversions | Built, demo until account connected (G-Ads) — tag via the loader; uploads need the Data Manager API | Env ids gate the tag |
| M16 | TikTok pixel + Events API | Built, demo until account connected (TikTok) — pixel via the loader | Env id gates the tag |
| M16 | Sticky mobile action bar | Built — `components/layout/MobileActionBar.tsx` (v3: `TabBarV3`) | Call/Text/Book |
| M16 | Announcement bar | Built — `AnnouncementBar` on the site · edited in Pages › Site widgets | Dates, countdown, per-visitor dismissal |
| M16 | Exit-intent popup | Built — `MarketingWidgets` · `hooks.ts useExitIntent`, `OfferDialog` | Once per 7 days; magnet or offer |
| M16 | Scroll/time popups | Built — `site_popups` + `PopupDialog`, one per path prefix | Views and clicks counted |
| M16 | Returning-visitor personalization | Built — `ResumeCard` "pick up where you left off" (browser only) | Nothing leaves the browser |
| M16 | Session replay and heatmaps | Built, demo until account connected (Clarity) — loader entry behind consent | Set `CLARITY_PROJECT_ID` |
| M16 | CTA / page A/B testing | Built — `ab_tests` + `/api/marketing/engage` bucketing; results in Pages › Site widgets | Two to four wordings per slot |
| M16 | Truthful social-proof toasts | Built — `SocialProofToast` from this week's real job and dyno counts | Hidden below a real threshold |
| M16 | Privacy policy and data-sharing notice | Built — tracking section + `PRIVACY_VERSION_LOG` on `/privacy`; consent asks again on a new version | Needs owner: attorney review |

## M17. Shopify bridge (parts store)

| Module | Feature | Status | Notes |
|---|---|---|---|
| M17 | Order and customer sync | Built, demo until account connected (Shopify) — `/api/marketing/shopify` webhook → `ingestShopifyOrder` / `ingestShopifyCustomer` | Needs an Admin API token |
| M17 | Consent flag sync | Built, demo until account connected (Shopify) — `syncShopifyConsent` | Marketing flags respected either way |
| M17 | SKU compliance tags | Built — Settings › Part compliance (`sku_compliance`: CARB EO / SEMA / not verified) | Unverified SKUs excluded from promos and feeds |
| M17 | Feed exclusion rules | Built — `/api/marketing/store/feed` drops unverified and off-road-only SKUs | Feed is app-side |
| M17 | Install-recommended handoff | Built, demo until account connected (Resend) | `lib/marketing/core/lifecycle-rules.ts checkoutClickEmits` → `mkt_store_checkout_follow_up`; proxy is checkout click, not real orders. |
| M17 | Abandoned checkout handoff (limited) | Built, demo until account connected (Resend) — high-value cart summary in the community sweep | Owner summary only, per C13 |
| M17 | Back-in-stock alerts | Built — `/api/marketing/stock-alert` + `runStockAlerts` in the cron | Consented subscribers, public catalog check |
| M17 | Product reviews | Needs owner | Install a Shopify product-review app (e.g. Judge.me) with post-delivery ask. |
| M17 | Unified revenue view | Built — shop revenue plus store checkout value in Reports | True Shopify revenue needs the token |
| M17 | Catalog blocks for email/social | Built — `lib/marketing/content/social-service.ts draftPillarPosts` (product spotlight) · `/admin/marketing/ads` product picker | Live catalog in social/ads/AI creative; no product block in email campaigns. |

## M18. Fleet & B2B

| Module | Feature | Status | Notes |
|---|---|---|---|
| M18 | Fleet account CRM | Built — `/admin/marketing/growth?tab=fleet` · `app/admin/marketing/growth/fleet-actions.ts createFleet/linkFleetCustomer` | Company, contact, trucks, terms, PM interval; no PO rules. |
| M18 | Fleet landing page and proposal generator | Built — `/fleet` + Growth › Fleet › proposal (`/admin/marketing/growth/fleet/[id]/proposal`) | Print-ready proposal |
| M18 | Prospect list builder | Built — fleet prospects in `FleetPanel` with source and stage | No cold texting (TCPA) |
| M18 | B2B cold email sequence | Built, demo until account connected (Resend) — fleet campaign steps; CAN-SPAM footer enforced | Owner approves before send |
| M18 | Cold-call/SMS guard | Built — `lib/marketing/core/gate.ts consentReason` | Marketing SMS blocked without customer record + SMS consent. |
| M18 | Fleet PM automation | Built, demo until account connected (Resend) | `lifecycle-rules.ts fleetPmEmits` → `mkt_fleet_pm_reminder` weekly digest to fleet contact. |
| M18 | Monthly fleet report | Built, demo until account connected (Resend) — `sendFleetMonthlyReports` in the community sweep | Jobs, spend, upcoming PM |
| M18 | Quarterly business review | Built — QBR summary on the fleet account page (`monthlyStatement`) | Print or email it |
| M18 | Priority scheduling SLA | Built — fleet SLA flag drives the booking note and the owner alert | Same slot engine |
| M18 | Net-terms invoicing | Built — billing terms on the fleet account set the invoice due date | Terms stored per account |

## M19. Events & community (dyno days etc.)

| Module | Feature | Status | Notes |
|---|---|---|---|
| M19 | Event manager | Built — `/admin/marketing/growth?tab=events` · `event-actions.ts createEvent` · `/events/[id]` · `/admin/marketing/growth/events/[id]` | Capacity, waitlist, check-in, segment invite draft. |
| M19 | Dyno slot booking + waiver | Gap — slot maths (`dynoSlots`) and the waiver text exist, plus DB columns, but the public form has no slot picker or waiver step | Registration works without a slot |
| M19 | Event reminder sequence | Built, demo until account connected — `sendEventReminders` in the community sweep | 7 days, 1 day, morning-of |
| M19 | Live dyno leaderboard | Gap — `buildLeaderboard` and result columns exist; no public board | Results are recorded per registration |
| M19 | Per-truck result card | Gap — HP/torque are recorded (`setRegistrationResult`); no shareable card image yet | Dyno post card covers published runs |
| M19 | Post-event follow-up | Built, demo until account connected — `sendEventFollowUps` (next-day offer) | Attendees only |
| M19 | Event syndication | Built — Event schema on the public page + `draftEventPost`; Facebook/GBP posting needs those accounts | Draft lands in Social |
| M19 | Build of the month | Built — nominations and votes (`botm_nominations`, `botm_votes`) with admin review | No share-to-enter requirement (C15) |
| M19 | Contest rules generator | Built — Growth › Events › contest rules (`contest_rules` + `validateContest`) | Counsel should still read them |
| M19 | Sponsor/vendor coordination | Built — `event_sponsors` with status in the event admin | Contact, tier, status |
| M19 | Charity tie-ins | Built — charity field on the event; the post draft names it | Honest wording only |
| M19 | Tech clinic series | Built — `/admin/marketing/growth?tab=events` (kind `tech_clinic`) | Each session created manually; no recurring series. |

## M20. Analytics & attribution

| Module | Feature | Status | Notes |
|---|---|---|---|
| M20 | Source → revenue funnel | Built — `/admin/marketing` · `lib/marketing/core/analytics.ts getMarketingFunnel` | Visitors → leads → booked → paid revenue by source. |
| M20 | Attribution models | Built — Reports model picker: first, last, linear, decay, position | Same funnel, different credit |
| M20 | Ad cost import | Built, demo until account connected (Meta, G-Ads, TikTok) | `lib/marketing/content/metrics-service.ts syncAdMetrics` daily; in-app campaigns only, no manual print/event costs. |
| M20 | CPL / cost per booking / CAC | Built — `analytics-math.ts rollupFunnel` · `/admin/marketing/ads/performance` | CPL and cost per booking by source/campaign; no explicit CAC. |
| M20 | ROAS on gross profit | Built — Reports › Profit by source (unit cost from line items) | Gross-profit ROAS column |
| M20 | LTV by source | Built — Reports › Lifetime value by source | Paying customers only |
| M20 | Call attribution report | Built, demo until account connected (TW-Voice) — Reports › Calls by source | Numbers recorded in-app |
| M20 | Speed-to-lead report | Built — Reports › Speed to lead (median, under-5-min share) | From the first human reply |
| M20 | Campaign and automation reports | Built — `/admin/marketing/campaigns/[id]` CampaignReport · `/admin/automations` counts | Campaigns: sends/clicks/conversions/revenue; automations: sent/skipped/failed only. |
| M20 | Retention metrics | Built — Reports › Retention (returning share, gap, reminder conversion) | 12-month window |
| M20 | Cohort analysis | Built — Reports › Cohorts (repeat visits by first month) | Six months |
| M20 | Weekly marketing digest | Built, demo until account connected (Resend) — Monday digest in `analytics-jobs.ts`, shown on Reports | Build-now button too |
| M20 | Anomaly alerts | Built — `detectAnomalies` in the analytics job → `marketing_anomalies` + owner alert | Leads, bookings, spend, CPL |
| M20 | Marketing calendar overlay | Built — `/admin/marketing/calendar` (campaigns, posts, events, offers, ads, seasons) | Chart markers via `chartMarkers` |
| M20 | Goal tracking | Built — Reports › Goals with pace against the month | Leads, bookings, revenue, max CPL |
| M20 | Export/Looker Studio | Built — Reports CSV exports + revocable feed URL (`/api/marketing/report-feed`) | Admin-only, token shown once |

## M21. AI assistant features

| Module | Feature | Status | Notes |
|---|---|---|---|
| M21 | Marketing copilot chat | Built, demo until account connected (LLM) — `/admin/marketing/content/copilot` · `copilot.ts` over our own data | Deterministic answers until AI is on |
| M21 | Weekly opportunity finder | Built — `/admin/marketing/ads/autopilot` · `lib/marketing/content/planner.ts planWeek`, `planner-service.ts runWeeklyPlanner` | Rules only: builds, dyno runs, open bays, offers, season. Runs on demand, not Monday; no stale-lead check |
| M21 | Natural-language segment builder | Built — plain-English parser in the segment builder (`segment-nl.ts`) | Falls back to the rule rows |
| M21 | Draft everything | Built, demo until account connected (LLM: AI Gateway + `MARKETING_AI_MODE=live`) — `lib/marketing/content/ai.ts writeCopy/generateAdVariants` | Ads, captions, emails, review replies, SEO/build pages. Template copy until then. No inbox replies |
| M21 | Compliance linter (AI + rules) | Built — `lib/marketing/core/compliance.ts checkClaims` + `lib/marketing/content/compliance.ts checkContent` | Rules run on every editor, generator and send. No LLM review pass |
| M21 | Insight narrator | Built — `/admin/marketing` AssistantCard · `lib/marketing/content/assistant.ts summarizeLast30Days` | Template 30-day summary; no period-over-period "what changed" |
| M21 | Inbox reply assistant | Built, demo until account connected (LLM) — Inbox Suggest (`draftReply`) | Never quotes a price |
| M21 | Voice/chat receptionist | Needs owner — Twilio voice plus an AI voice vendor | Chat after-hours reply is built |
| M21 | Call/voicemail summarizer | Needs owner — Twilio voice recordings first | No calls in the app yet |
| M21 | Image understanding | Needs owner — a vision model on AI Gateway (card on file) | Photos are reviewed by hand |
| M21 | Guardrails and cost caps | Built — Settings › AI budget monthly cap (`spend-cap.ts`) | At the cap it falls back to templates |
| M21 | No-fabrication rule | Built — `fabrication.ts` post-check on AI output (numbers must match source data) | Blocks invented figures |

## M22. Compliance & governance

| Module | Feature | Status | Notes |
|---|---|---|---|
| M22 | Consent ledger (extends built) | Built — `lib/marketing/core/consent.ts recordConsent` · `contact_consent_events` | Append-only (RLS); version, IP, UA, URL, method in evidence |
| M22 | Consent proof export | Built — per-contact consent proof in the contact export route | Text version, method, timestamp |
| M22 | Opt-out by any reasonable means | Built — `lib/marketing/core/compliance.ts classifyInboundSms` · `/api/marketing/twilio/sms` · contact page "Record consent by hand" | STOP synonyms, free text, unsubscribe link, staff note. No email-reply parsing |
| M22 | Revoke-all switch | Built — Settings › Consent + contact panel (`revokeAllEnabled`) | One flag stops every purpose |
| M22 | Quiet-hours engine | Built — `lib/marketing/core/gate.ts gateOutbound` · `/admin/marketing/settings#sending` | Shop time zone, not recipient-local; no FL/OK 8pm rule |
| M22 | Frequency caps with priority | Built — `lib/marketing/core/gate.ts sentThisWeek` · settings caps | Weekly per contact per channel; transactional exempt |
| M22 | Internal do-not-call list | Built — `/admin/marketing/settings#suppressions` (reason "Do not contact") | Honored on texts/email; app places no outbound calls |
| M22 | National DNC scrub | Needs owner | Only if outbound marketing calls start: get FTC DNC Registry SAN (telemarketing.donotcall.gov) |
| M22 | Reassigned Numbers Database check | Needs owner — FCC RND subscription (paid per lookup) | No free path |
| M22 | 10DLC registration helper | Built — Settings › 10DLC packet with validation and copy-out | Needs owner: submit in Twilio with the EIN |
| M22 | Marketing vs transactional classifier | Built — `lib/marketing/core/policy.ts isMarketingAutomationKey` · `lib/messaging/send.ts` | By key prefix (`mkt_`, `campaign:`) at send time, not on template save |
| M22 | CAN-SPAM enforcement | Built — `lib/marketing/core/gate.ts` + `compliance.ts marketingEmailFooter` | Footer, postal address required, List-Unsubscribe one-click headers |
| M22 | Bulk sender compliance monitor | Built — Settings › Email deliverability (SPF/DKIM/DMARC); complaint rate needs Resend webhooks | One-click unsubscribe already sent |
| M22 | Review policy guard | Built — `REVIEW_POLICY_RULES` on AI output, templates, automations and campaign steps · Settings › Policy scan | No gating, incentives or Yelp asks |
| M22 | Emissions claims guard | Built — `lib/marketing/core/compliance.ts checkClaims` · planner/ads skip `offRoadOnly` SKUs | Blocks tamper terms everywhere; no required disclaimer; no CARB EO/SEMA tagging |
| M22 | Endorsement/testimonial rules | Built — `endorsement.ts` release + `#ad` check at UGC approval | Blocks posts without a release |
| M22 | AI content labeling policy | Built — `generator` columns, `creative_assets.source='ai'`, `lib/marketing/content/ai-gateway.ts gatewayImage` | Every draft tagged demo/ai; image prompt bans faces, plates, text |
| M22 | Ad platform policy pre-check | Built — `adPolicyChecklist` per platform in the ad flow | Meta/Google/TikTok rules |
| M22 | Contest/sweepstakes compliance | Built — contest rules generator with `validateContest` | No share-to-enter |
| M22 | Financing disclosure check | Built — `checkFinancing` Reg Z trigger-term lint | Warns on rate or payment claims |
| M22 | Call recording disclosure | Needs owner — only needed once Twilio voice records calls | Wording is in the 10DLC packet |
| M22 | Approval workflow + audit log | Built — `/admin/marketing/ads/approvals` · `lib/marketing/content/approvals-service.ts` · `messages` log | Payload-hash approvals with requester/decider/time; sends logged with recipient |
| M22 | Role permissions | Built — `requireRole('admin')` on all marketing + RLS `admin_write` | Employees (`/shop`) capture job photos; only admin sends/spends |
| M22 | Record retention | Built — append-only `contact_consent_events`, `messages` (FK set null) | Nothing purges logs; no explicit retention job |
| M22 | Data sharing hygiene | Built — no contact-data sharing code; CSV export admin-only | No audience/conversion uploads exist yet, so no hashing path |
| M22 | Legal review checkpoints | Needs owner | Counsel reviews SMS terms, `app/(site)/privacy` (marked DRAFT), tuning copy |

## M23. Marketing operations & admin

| Module | Feature | Status | Notes |
|---|---|---|---|
| M23 | Marketing home dashboard | Built — `/admin/marketing` · `core-ui/overview-data.ts loadOverview` | Leads, approvals, reviews to answer, spend, compliance pulse; no "replies owed" |
| M23 | Approval queue | Built — `/admin/marketing/ads/approvals` · `listApprovalQueue` | Mobile-friendly; owner email only when planner drafts; no >4h nudge |
| M23 | Unified marketing calendar | Built — `/admin/marketing/calendar` | One month view across channels |
| M23 | Asset library | Gap — photos live in Gallery and creative assets in the studio; no tagged library with license fields | Both are browsable today |
| M23 | Template library | Built — `/admin/marketing/content/templates` (`marketing_templates`) with policy lint on save | Text, email, social, replies, ads |
| M23 | Campaign builder wizard | Built — `/admin/marketing/campaigns/new` · `CampaignWizard.tsx` | Type → audience → message → schedule; single channel per campaign |
| M23 | Automation builder (visual) | Built — lifecycle/drip campaigns in `CampaignWizard` + `StepsComposer` | Trigger → waits → steps with exit rules; no branching conditions |
| M23 | Automation recipe library | Built — `/admin/marketing/campaigns/automations`, `/campaigns/seasonal` | Toggle catalog flows; one-tap seasonal drafts |
| M23 | Budget planner | Built — Reports › Budget plan (`marketing_budgets`) vs actual with pace | Per channel, per month |
| M23 | Integration health page | Built — Settings › Integration health + `runIntegrationHealth` in the cron | Token expiry, cron freshness, DNS |
| M23 | Channel settings | Built — `/admin/marketing/settings#sending` · `saveSendingRulesAction` | Sender names, reply-to, postal, quiet hours, caps; numbers via env |
| M23 | Demo/test mode (extends built) | Built — `MESSAGING_SMS_MODE`, `DEMO_EMAIL_TO`, per-platform demo in connections, `DemoBanner` | Per channel; test-send in campaigns |
| M23 | Owner mobile quick actions | Built — responsive admin: approve (`/ads/approvals`), pause (`/ads/campaigns`), post (`/social/new`) | No dedicated quick-action screen; no inbox reply |
| M23 | Checklists | Built — Settings › Checklists (launch, weekly, monthly) with persisted ticks | From `checklists.ts` |
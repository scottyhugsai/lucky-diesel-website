# Marketing Automation + AI Ads: Technical Research

Researched 2026-09-17 for `lucky-diesel` (Next.js 16.3.4, Supabase, Vercel project `lucky-diesel`). This file is research only. It contains no production code.

Confidence labels: **[verified]** means we tested it or read the primary doc or package; **[secondary]** means it comes from reputable third-party write-ups and should be rechecked in the vendor console before we depend on it.

---

## 0. Executive summary

- **AI Gateway auth works, but billing does not yet.** The `VERCEL_OIDC_TOKEN` from `vercel env pull` was **accepted** by AI Gateway (claims: project `lucky-diesel`, environment `development`, about 1 h lifetime). The request was then **rejected with `customer_verification_required`**: *"AI Gateway requires a valid credit card on file to service requests … add a card and unlock your free credits."* No text or image was generated and nothing was spent. **Owner action:** add a card on the Vercel team (`scottyhugsai-4208s-projects`), then go to AI → add card. That unlocks the free monthly credit ($5, per Vercel's own UI copy). After that, the same code path works locally and on Vercel with no API key.
- The public model list returned **374 models**, including 30+ image models and Claude, GPT-5.x and Gemini 3.x text models (see §1). Expected unit costs: ad copy is about $0.001–0.01 per request; images are $0.01–0.15 each.
- **Paid ads are an approvals project, not a coding project.** Meta takes about 1–3 weeks (Business Verification, then app review for `ads_management`). Google Ads can take days to weeks (new Explorer tier; access now tied to the Cloud project since the developer-token sunset on 2026-09-09). TikTok takes weeks. Local Services Ads is read-only by API and is being folded into Performance Max. **Build for draft → owner approval → publish, and run demo mode until the connections land.**
- **Compliance hotspot for a diesel performance shop:** emissions tampering (DPF/EGR/DEF delete, "delete tunes") is illegal under the Clean Air Act and is actively enforced by EPA/DOJ. Every ad platform bans illegal products. AI-generated copy must be filtered for delete/tamper language before an ad or post can be approved (see §2.6).
- **Email:** keep one-to-one lifecycle mail in our engine. Use Resend Broadcasts (Segments + Topics, auto unsubscribe) for bulk marketing, or send per recipient ourselves with RFC 8058 one-click unsubscribe. **SMS marketing** needs a 10DLC campaign whose use case covers marketing (Mixed/Marketing, or Low-Volume Mixed at under 2,000 T-Mobile segments per day) plus written consent. The existing `customers.sms_consent*` columns are a good base.

---

## 1. AI copy + image generation (server-side)

### 1.1 Live test (2026-09-17)

| Item | Result |
|---|---|
| Package | `ai@7.0.105` with `@ai-sdk/gateway@4.0.85`, installed in the scratchpad only (not the project) |
| Auth | `VERCEL_OIDC_TOKEN` loaded via `node --env-file`. The gateway accepted the OIDC identity. |
| Call | `generateText({ model: 'openai/gpt-5-mini', prompt: <12-word ad headline>, maxOutputTokens: 400 })` |
| Outcome | **HTTP error, `type: customer_verification_required`**, `isRetryable: false`. Requires a credit card on the Vercel team. |
| Image test | **Not attempted.** It would fail the same way, and the brief said to generate an image only if text succeeded. |
| Cost | $0 |

**Re-test after the card is added:** repeat the same one-liner. For images, use `generateImage({ model: 'bfl/flux-2-klein-4b' | 'meta/muse-image-1.0', prompt, aspectRatio: '1:1' })` (about $0.01–0.04).

Notes:
- The OIDC token from `vercel env pull` **expires after about 12 h** (ours had about 28 min left). For local work, re-run `vercel env pull`, or use `AI_GATEWAY_API_KEY`. On Vercel deployments the token is injected and refreshed automatically. [verified: token claims; Vercel OIDC docs]
- There is **no `ANTHROPIC_API_KEY`**, OpenAI key, Replicate key or fal key in `.env.local` (names checked, values not read). The env names present are Supabase, Postgres, Resend, the demo flags and `VERCEL_OIDC_TOKEN`.

### 1.2 AI SDK API surface (as installed, v7)

The current major version on npm is **v7**, not v5/v6. Exports confirmed from `node_modules/ai/dist/index.d.ts`:
- `generateText`, `streamText`, and `Output` (structured output through `generateText({ output: Output.object({ schema }) })`).
- `generateObject` and `streamObject` are still exported, but the `Output` path is the forward-looking one.
- `generateImage({ model, prompt, n, maxImagesPerCall, size: '{w}x{h}', aspectRatio, seed, providerOptions })` is now **stable**, with no `experimental_` prefix. Errors come back as `NoImageGeneratedError`.
- `experimental_generateVideo`, `generateSpeech`, and `gateway` / `createGateway`.
- The model can be a plain string such as `'anthropic/claude-sonnet-4.6'`, which routes through the gateway by default.

Suggested use:
- **Copy variants:** `generateText` + `Output.object` with a Zod schema, e.g. `{ headline ≤40, primaryText ≤125, description ≤30, cta enum }` per platform. Validate the lengths again server-side.
- **Images:** `generateImage` → upload bytes to Supabase Storage bucket `marketing-creatives` → store the path on `ad_creative_variants`.

### 1.3 Models and pricing (live from `https://ai-gateway.vercel.sh/v1/models`, 2026-09-17)

Text models (USD per 1M tokens, input/output):

| Model id | In | Out | Use |
|---|---|---|---|
| `anthropic/claude-sonnet-4.6` | 3.00 | 15.00 | Best-quality ad copy and compliance review |
| `anthropic/claude-haiku-4.5` | 1.00 | 5.00 | Bulk variants and social captions |
| `openai/gpt-5-mini` | 0.25 | 2.00 | Cheap variants |
| `google/gemini-3-flash` | 0.50 | 3.00 | Cheap variants |

Also available: `anthropic/claude-sonnet-5`, `anthropic/claude-opus-5`, `openai/gpt-5.5`, `google/gemini-3.8-flash`, and others. A 5-variant ad copy request (about 1.5k tokens in, 800 out) costs about **$0.017 on Sonnet 4.6** and about $0.002 on GPT-5-mini.

Image models (per image unless noted):

| Model id | Price | Notes |
|---|---|---|
| `meta/muse-image-1.0` | $0.01 | Cheapest listed |
| `spacexai/grok-imagine-image` | $0.02 | |
| `recraft/recraft-v4.1` | $0.035 (vector $0.08) | Good for text/graphic layouts and logos |
| `bytedance/seedream-5.0-lite` / `-pro` | $0.035 | |
| `google/gemini-3.1-flash-lite-image` | $0.034 | Language model with image output; supports editing via prompt + image |
| `google/gemini-2.5-flash-image` | $0.039 | |
| `bfl/flux-pro-1.1` / `flux-kontext-pro` | $0.04 | Kontext does reference-image editing (e.g. put our truck photo in a new scene) |
| `google/gemini-3.1-flash-image` | $0.045 (512) to $0.151 (4K) | |
| `bfl/flux-2-pro`, `flux-2-max`, `flux-2-klein-*` | Price not listed in feed | Check the dashboard |
| `openai/gpt-image-2`, `gpt-image-1.5`, `gpt-image-1-mini` | Token-priced (e.g. gpt-image-2 $5 in / $30 out per 1M) | Roughly $0.02–0.20 per image depending on quality |
| `google/gemini-3-pro-image` | $0.134 (1–2K), $0.24 (4K) | Highest quality; readable text in images |

- No Imagen ids (`google/imagen-*`) appear in the gateway list today. Google image generation goes through the Gemini image models.
- Video models are also listed, e.g. `google/veo-3.0-*`, `bytedance/seedance-2.x`, `alibaba/wan-*` (about $0.05–0.28 per second).
- **Recommended defaults:** copy on `anthropic/claude-haiku-4.5` (upgrade to Sonnet for the final pass). Images on `google/gemini-3.1-flash-image` for ad creative with our own photos as references, and `bfl/flux-kontext-pro` for edits.
- **Free tier:** a monthly included credit on a subset of models, unlocked by card verification (Vercel docs/FAQ). Set a **gateway budget** in the Vercel dashboard and enforce a per-month spend cap in our own `ai_generation_jobs` table too.

### 1.4 Alternatives if the gateway is unavailable

- **Anthropic API direct** (`@ai-sdk/anthropic` or `@anthropic-ai/sdk`): needs an `ANTHROPIC_API_KEY`, which we don't have. Copy only; no images.
- **fal.ai** (`@ai-sdk/fal`) and **Replicate** (`@ai-sdk/replicate`): both have AI SDK providers and host FLUX, Recraft and Seedream. Each needs its own key and billing.
- **Design implication:** keep the model id and provider in `shop_settings` or an env var. The AI SDK interface is identical across providers, so switching is a config change.

---

## 2. Paid ad platforms

### 2.1 Meta (Facebook/Instagram) Marketing API

Prerequisites: Business Manager (Business Portfolio), an ad account with a payment method, a Page (and an IG professional account), and a Meta developer app with the Marketing API product.

- **Permissions:** `ads_management` and `ads_read` (plus `business_management` and `pages_read_engagement` / `pages_manage_ads` for page-backed creatives).
  - For **your own business's assets**, a system user token in your own Business Manager can work at Standard/Limited access without full App Review.
  - Managing **other businesses'** accounts needs Advanced Access, which requires App Review **and** Business Verification. [secondary: admanage.ai, singhamandeep.com]
- **Marketing API Access Tier** (renamed from Ads Management Standard Access, May 2026) [verified: developers.meta.com blog]:
  - *Limited Access* requires a verified Business Manager and a live app, and has stricter rate limits.
  - *Full Access* requires 500+ Marketing API calls in 15 days at under 15% errors.
- **Versions:** v25.0 is current (released 2026-02-18); v24.0 is the oldest supported. Meta's "automation unification" means legacy Advantage+ Shopping/App campaign objects **can't be created via API as of 2026-05-19**. Use standard campaigns with Advantage+ settings. [secondary]
- **Advantage+ creative:** controlled per creative through `degrees_of_freedom_spec.creative_features_spec` (enhancements such as text variations, image animation, video uncrop; per-feature `OPT_IN` / `OPT_OUT`). **Opt out by default** so AI rewrites don't bypass owner approval. [verified: Meta dev docs pages listed]
- **Object graph for our publish step:**
  1. Upload the image with `POST /act_{id}/adimages` → hash.
  2. Create the creative with `POST /act_{id}/adcreatives` (`object_story_spec`: page_id, link_data {image_hash, link with UTMs, message, name, call_to_action}).
  3. Create the campaign: objective `OUTCOME_LEADS` or `OUTCOME_TRAFFIC`, `special_ad_categories: []`, **status PAUSED**.
  4. Create the ad set: `daily_budget` in cents, `targeting` with a geo radius around the shop, `promoted_object`.
  5. Create the ad: status PAUSED.
  6. Owner clicks Activate, which PATCHes the status to ACTIVE.
  7. Read results with `GET /{ad_id}/insights` (`spend, impressions, clicks, actions, cost_per_action_type`).
- **Special Ad Categories:** required only for credit, employment, housing, and social issues/elections/politics [verified: transparency.meta.com ad standards]. Diesel repair and parts ads are **not** a special category. Financing offers ("0% APR on a turbo build") could fall under credit/financial products, so avoid them or flag them.
- **Automotive emissions:** Meta's Ad Standards have no clause naming "defeat devices" [verified: fetched page]. However, ads for **illegal products or services are prohibited**, and EPA treats tuners, DPF delete pipes, DEF disables and EGR block-offs sold for on-road use as illegal defeat devices [verified: EPA enforcement alert]. eBay bans them explicitly. Expect ad rejection or account restriction, and legal exposure, for delete/tuning language.
- **Timeline:** Business Verification 2 days to 2 weeks; app review (if needed) 1–2 weeks; ad review per ad usually under 24 h.

### 2.2 Google Ads API

- **Access** [verified: developers.google.com access-levels; secondary: ppc.land]:
  - *Test Account* access.
  - *Explorer* (new Feb 2026): production accounts, limited ops, no formal application.
  - *Basic*: 15,000 ops/day.
  - *Standard*: unlimited ops.
  - **The developer token was sunset on 2026-09-09.** Access levels now follow the **Google Cloud project** used for OAuth. Google acknowledged an application backlog, and a brand-verification pilot (July 2026) can cut review to hours.
  - For one shop, Explorer or Basic is enough.
- **Accounts:** a Manager (MCC) account is recommended. The owner's Ads account must be linked, and OAuth with the `adwords` scope is required.
- **Performance Max** via the API [verified: developers.google.com PMax asset groups/requirements]:
  - The asset group and its assets must be created in **one bulk `GoogleAdsService.Mutate`** (non-retail).
  - Minimums: 3 headlines (≤30 chars), 1 long headline (≤90), descriptions (≤90; the API doc requires at least 2, with one ≤60 chars), 1 business name (≤25), 1 logo, at least 1 landscape (1.91:1) and 1 square image.
  - Up to 15 headlines, 5 descriptions, 20 images, 5 videos.
  - The campaign budget is a separate `CampaignBudget` resource; create everything with `status: PAUSED`.
- **Search campaigns** (probably better for "diesel repair near me"): responsive search ads with 3–15 headlines and 2–4 descriptions.
- **Reporting:** GAQL `SELECT metrics.cost_micros, metrics.conversions … FROM campaign`.
- **Policy:** "Dangerous products or services" and illegal-product rules apply. Google's pages don't name emissions defeat devices, but the Clean Air Act makes them illegal (same risk as §2.1).
- **Timeline:** OAuth app verification for a sensitive scope can take days to weeks (it can stay "testing" with up to 100 users if only the owner connects). Access-level review takes days to weeks.

### 2.3 Local Services Ads (LSA)

- The API is **read-only reporting** [verified: developers.google.com]:
  - `local_services_lead` and `local_services_lead_conversation` resources.
  - `LocalServicesLeadService.AppendLeadConversation` and `ProvideLeadFeedback`.
  - You **cannot create LSA ads or profiles by API**. Onboarding, Google Guaranteed/Screened checks, insurance and license verification are all manual in the LSA UI, and background checks take 2–6 weeks.
- **2026 change:** Google is moving LSA into Google Ads as **Performance Max pay-per-lead** campaigns. US changes begin August 2026. [secondary: SEJ, PinMeTo]
- Also confirm that "diesel repair / auto repair" is an LSA-eligible category in the shop's market before investing. Auto repair categories exist, but availability varies by metro.
- **Recommendation:** ingest LSA leads into `leads` (source `lsa`) through a daily GAQL pull, and don't build LSA creation.

### 2.4 TikTok Marketing API (Business API)

- Needs a TikTok for Business developer app, approval for **Marketing API** access (typically 1–3 weeks), a TikTok Ads Manager advertiser account, and OAuth to that advertiser.
- Endpoints: `/campaign/create/`, `/adgroup/create/`, `/ad/create/`, and `/file/image/ad/upload/` / `/file/video/ad/upload/`. Reporting through `/report/integrated/get/`.
- Video-first: a static AI image performs poorly, so plan short video (AI video models or shop footage).
- TikTok automotive audiences skew younger; lowest priority for a local diesel shop. [secondary]

### 2.5 Safe publishing design (all platforms)

```
generate (AI) → draft (variants) → compliance lint (regex + LLM classifier)
   → owner review UI (edit/approve/reject, see preview + budget)
   → publish job: create all objects PAUSED on platform, store external ids
   → owner "Go live" (second explicit click) → ACTIVE
   → daily sync: insights → ad_metrics_daily; auto-pause rules
```

Guardrails:
- **Hard caps in our DB**, checked before every create or activate:
  - `max_daily_budget_cents` per platform
  - `max_monthly_spend_cents` shop-wide
  - `max_campaign_duration_days`
- **Platform-side caps** as a backstop:
  - Meta: `spend_cap` on the account and campaign, `lifetime_budget` with an `end_time`.
  - Google: campaign `end_date`, and an account budget if invoiced.
- **Auto-pause** when spend exceeds the cap or cost-per-lead exceeds a threshold over N days.
- **Nothing is ever created ACTIVE.** Each approval row records the approver, a hash of the exact payload, and a timestamp. Editing the payload after approval invalidates the approval.
- **Idempotency:** store `external_id` + `publish_attempt_key` so cron retries don't duplicate campaigns.

### 2.6 Compliance lint for this shop (important)

The app has `tune_records`, `dyno_runs` and `build_items`, and the owner sells parts on Shopify.
- **Blocklist (hard-fail):** delete, deleted, DPF delete, EGR delete, DEF delete, "emissions off", "race only" for street-registered use, "off-road only" combined with tuning, defeat, "straight pipe", "turn off regen".
- **Warn (owner must confirm):** tune, tuner, "gains", "+hp", Shopify products with a CARB/EPA exemption question.
- **Positive framing that is allowed:** EPA-compliant or CARB EO-numbered tunes, repair, maintenance, diagnostics, stock-emissions-compliant performance.
- Tell the LLM prompt to never produce the blocked language, **and** enforce it with a regex check (don't rely on the prompt alone).
- EPA/DOJ enforce actively (e.g. the COBB Tuning Clean Air Act settlement). Organic posts are subject to the same federal law.

---

## 3. Organic posting

### 3.1 Instagram (Graph API content publishing)

- **Account:** an IG **Business or Creator** (professional) account.
  - Path A: "Instagram API with Facebook Login" (IG linked to a Facebook Page).
  - Path B: "Instagram API with Instagram Login" (no Page needed; scopes `instagram_business_basic`, `instagram_business_content_publish`).
  - Publishing for your own account works in dev mode with a role on the app. Advanced Access (app review) is needed only for accounts without an app role.
- **Flow:**
  1. `POST /{ig-user-id}/media` (`image_url` must be a **public** URL, e.g. a Supabase Storage public or signed URL; also `caption`, `media_type` = `REELS` / `CAROUSEL` / `STORIES`).
  2. Poll `status_code` until `FINISHED`.
  3. `POST /{ig-user-id}/media_publish`.
- **Limits:** the docs cite both 100 and 50 API-published posts per rolling 24 h (docs are inconsistent). **Query `GET /{ig-user-id}/content_publishing_limit`** instead of hardcoding. Carousels count as 1; Reels and Stories count. [secondary: multiple 2026 guides]
- **Media:**
  - JPEG only for images; aspect ratio 4:5 to 1.91:1; up to 8 MB.
  - Carousel up to 10 items.
  - Reels: MP4/MOV, H.264, up to 15 min (≤90 s recommended), 9:16.
  - Caption ≤2,200 chars, ≤30 hashtags, ≤20 @mentions.
- **No native scheduling in the API.** Our cron publishes at `scheduled_for`. The Vercel daily cron is too coarse, so see §6.4.

### 3.2 Facebook Page posts

- `POST /{page-id}/feed` (message, link), `/{page-id}/photos` (url, caption), `/{page-id}/videos`.
- Uses a Page access token with `pages_manage_posts` + `pages_read_engagement`. Business Verification plus app review applies if the app serves pages without app roles.
- **Native scheduling:** `published=false` + `scheduled_publish_time` (10 min to 30 days out). This lets Facebook hold the schedule even if our cron slips.
- Page insights metrics were reduced in 2025–26 (Meta retired about 85 legacy organic reach/impressions metrics on 2026-06-15). Sync only the metrics that are still supported. [secondary]

### 3.3 Google Business Profile APIs

- **Access:** request GBP API access via Google's form (approval about 1–2 weeks, sometimes longer). OAuth scope `business.manage`.
- **Local posts:** `accounts.locations.localPosts` (v4) create/list/patch/delete. Types: `STANDARD`, `EVENT`, `OFFER` (coupon code, redeem URL, terms). CTA buttons such as `CALL`, `BOOK`, `LEARN_MORE`. One photo per post via `media[].sourceUrl`. **Active.** [verified: developers.google.com reference]
- **Reviews:** `accounts.locations.reviews` list/get/`updateReply`/`deleteReply` are **active in 2026**. The resource exposes `reviewReplyUrl` and reply `PolicyViolation` state. [verified]
  - Good fit for AI-drafted, owner-approved replies.
  - Note: FTC rules on fake reviews (2024) prohibit review gating or incentivized fake reviews, so referral or review campaigns must ask **all** customers, not only happy ones.
- **Q&A:** **the API was discontinued on 2025-11-03**, and the public Q&A feature has been removed from profiles (rolled out from Dec 2025). Do not build it. [verified: Google changelog; ppc.land]
- **Performance:** Business Profile Performance API (`fetchMultiDailyMetricsTimeSeries`) for calls, website clicks and direction requests.
- **Rate limits:** default QPM quotas, with edits about 10/min per location.

### 3.4 TikTok Content Posting API

- **Scopes:** `video.publish` (Direct Post) or `video.upload` (send to the creator's inbox as a draft).
- **Unaudited apps:** posts are forced to **`SELF_ONLY` (private)**, at most 5 users per 24 h, and the posting account must be private. Passing the audit later does **not** make earlier posts public. [verified: developers.tiktok.com]
- **Audit:** takes weeks and requires a UX that follows the content sharing guidelines (creator info query, privacy selector, music usage consent, etc.).
- **Practical path:** use `video.upload` (inbox draft) → the owner finishes the post in the TikTok app. No audit is needed for that, and it keeps a human in the loop.
- Rate: about 6 requests/min per user token for init; the creator's daily post cap is returned by `creator_info/query`.

### 3.5 Summary

| Channel | Needs | Approval | API scheduling | Our approach |
|---|---|---|---|---|
| Instagram | Pro account (+ Page for FB-login path) | None for own account (app role); App Review otherwise | No | Our scheduler |
| Facebook Page | Page admin | Same app as Meta | Yes (`scheduled_publish_time`) | Native schedule |
| GBP | Verified profile | GBP API access form (1–2+ wks) | No | Our scheduler |
| TikTok | TikTok account | Audit for public posts (weeks) | No | Inbox draft |

---

## 4. Email and SMS campaign infrastructure

### 4.1 Resend: Broadcasts vs per-recipient sends

- **Resend Audiences** now means one account-level contact store with **Contacts, Properties, Segments, Topics and Broadcasts** [verified: resend.com docs/blog].
  - Topics are per-subject opt-ins with an opt-in or opt-out default.
  - The global `unsubscribed` flag blocks all Broadcasts.
  - Since 2026-02-12, a Broadcast can be created **and** sent in one API call.
  - The `{{{RESEND_UNSUBSCRIBE_URL}}}` placeholder gives hosted unsubscribe handling automatically.
- **Option A (Broadcasts):**
  - Sync `contacts` → Resend Contacts (+ properties such as platform and last_service_at), mirror our segments as Resend Segments, send marketing as Broadcasts.
  - Pros: unsubscribe/preferences are handled, bulk-optimized, deliverability tooling.
  - Cons: two sources of truth for consent. Needs webhooks (`contact.updated`) to sync unsubscribes back, and per-recipient personalization is limited to contact properties.
- **Option B (engine sends per recipient via `emails.send` / batch send of up to 100):**
  - Pros: full personalization (vehicle, last work order), single consent store, reuses `automation_runs`.
  - Cons: we must implement List-Unsubscribe, the preference page, suppression and throttling.
- **Recommendation:**
  - Transactional and lifecycle mail (service-due, review ask, drip steps tied to a work order) → **Option B** in our engine.
  - One-off newsletter or promo blasts to a segment → **Option B as well at this shop's scale** (hundreds to low thousands of contacts). Use `resend.batch.send` in chunks of 100.
  - Keep Broadcasts as a later optimization if the list grows past about 10k.

### 4.2 Unsubscribe requirements

- **CAN-SPAM** (US law): clear sender identity, physical postal address, a working opt-out honored within **10 business days**, no misleading subject lines.
- **Gmail/Yahoo bulk sender rules** (in force since 2024, enforced harder since late 2025):
  - SPF + DKIM + DMARC (`p=none` minimum) on the sending domain.
  - Spam rate under 0.3%.
  - For marketing mail: `List-Unsubscribe: <https://…/u/{token}>, <mailto:unsub@…>` **plus** `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (RFC 8058), honored within 2 days.
- Resend accepts custom `headers` on `emails.send`, so set both headers there. Put the `token` (HMAC-signed contact id + topic) on a public route handler that accepts **POST** (one-click) and GET (a landing page).
- Send marketing from a subdomain (e.g. `news.luckydiesel…`) to protect transactional reputation.

### 4.3 Twilio for marketing SMS

- **10DLC campaign use case** [verified: Twilio help]:
  - "Mixed/Marketing" (standard) allows promotional content.
  - "Low-Volume Mixed" is under 2,000 segments/day to T-Mobile, with a lower fee.
  - A "Customer Care" or "Account Notification" campaign **may not** carry promos.
  - Either register one Mixed campaign covering notifications + marketing, or keep a separate Marketing campaign in its own **Messaging Service** so marketing throughput and opt-outs don't affect service texts.
  - Message samples must show the promotional content and opt-out language.
- **Throughput:** MPS scales with Brand Trust Score (e.g. score 75+ → up to 40 MPS per carrier for MMS since 2026-03-18). T-Mobile applies a **daily cap** by brand tier. Sole Proprietor / low-volume brands get about 1 MPS and 1,000 segments/day at T-Mobile. For a shop, a Low-Volume Standard brand plus a Low-Volume Mixed campaign is usually enough.
- **Timeline:** brand registration minutes to days; campaign vetting typically 1–3 weeks (longer if rejected for CTA or opt-in proof). Publish the SMS terms and privacy policy on the site with explicit "marketing messages" language, because vetting reviewers check it.
- **Messaging Service features:** sender pool, Advanced Opt-Out (STOP/START/HELP managed by Twilio, custom keywords), a `StatusCallback` URL for delivery receipts, and **scheduled messages** (`ScheduleType=fixed`, 15 min to 35 days out). Scheduled messages can smooth throughput and quiet hours.

### 4.4 Consent and frequency

- **TCPA marketing texts need *prior express written consent*.** The 2023 FCC one-to-one consent rule was vacated by the 11th Circuit and the FCC reinstated the prior standard on 2025-08-29.
  - Record: checkbox not pre-checked, disclosure text/version, timestamp, IP, page URL, and the phone number.
  - The `customers.sms_consent_*` columns and `leads.consent_ip` exist. Add `consent_source_url` and split **transactional vs marketing** consent.
- **Revocation** (in force since 2025-04-11): honor opt-outs by any reasonable means (STOP, "unsubscribe", "cancel", a reply in plain words) **within 10 business days**. One confirmation text is allowed.
  - The **"revoke-all"** part (an opt-out from one message type revokes all channels and purposes) is **delayed to 2027-01-31**. Design for it now: a marketing opt-out should be modeled per channel **and** per purpose.
- **Quiet hours:** federal TCPA prohibits telephone solicitations before 8am and after 9pm recipient local time. Several states are stricter (FL, OK, MD: 8am–8pm and ≤3 per 24 h on the same subject). **South Carolina** has no mini-TCPA frequency cap as of this writing (verify with counsel). The engine's `applyQuietHours` should apply to all marketing sends.
- **Frequency caps** (our policy, not law): at most 1 marketing SMS per 3 days and at most 4 per month per contact; at most 2 marketing emails per week. Enforce these in the dispatcher with a `contact_message_log` count query.
- **CTIA:** first message identifies the brand and gives STOP/HELP. No SHAFT content. Use a branded link shortener (public shorteners get filtered).

---

## 5. Tracking and attribution

### 5.1 Capture

- **On landing** (in `proxy.ts` middleware or a small client script): read `utm_source/medium/campaign/term/content`, `gclid`, `gbraid`, `wbraid`, `fbclid`, `ttclid`, `msclkid`, and the referrer.
  - Store a first-party cookie `ld_ft` (first touch, set once, 90 days) and `ld_lt` (last touch, overwritten on each UTM-bearing visit).
  - Also set the `_fbc` cookie format `fb.1.{ts}.{fbclid}` if the Meta Pixel isn't installed. Meta requires `fbc` to be built from `fbclid` without altering its case.
- **On form submit** (lead, booking, quote): copy both touches plus `anonymous_id`, `user_agent` and `client_ip` into `attribution_touches` linked to the lead/customer.
- **Offline outcome:** work order invoiced or paid → emit `conversion` with value → queue the platform uploads.
- **Tag every outbound link** we generate (email, SMS, social, ads) with UTMs + `ld_cid` (campaign id) automatically.

### 5.2 Meta Conversions API (CAPI)

- `POST https://graph.facebook.com/v25.0/{pixel_id}/events?access_token=…` with `data: [{ event_name: 'Lead' | 'Purchase', event_time, action_source: 'website' | 'system_generated' | 'physical_store', event_id (dedupe with pixel), event_source_url, user_data: { em: sha256(lower(trim(email))), ph: sha256(E.164 digits), fn, ln, ct, st, zp, external_id, client_ip_address, client_user_agent, fbc, fbp }, custom_data: { value, currency: 'USD' } }]`.
- Needs a system user token with pixel access (no app review for own pixel).
- Events should arrive within 7 days (`physical_store` / offline allows up to 62 days).
- Invoice-paid → `Purchase` with value is the high-value signal for Meta optimization.

### 5.3 Google offline conversions

- **Major 2026 change** [verified: Google Ads Help; secondary: ppcnewsfeed, almcorp]:
  - From **2026-06-15**, offline conversion import and enhanced conversions for leads uploads moved to the **Data Manager API**.
  - `UploadClickConversions` in the Google Ads API is blocked for tokens that weren't already using it (Jan–Jun 2026). **We are new, so build on the Data Manager API** (`datamanager.googleapis.com`, `ingestEvents`).
- **Payload:** conversion action destination, `gclid` / `gbraid` / `wbraid` when available **plus** hashed email/phone (enhanced conversions for leads), `conversionDateTime`, `value`, `currency`, `transaction_id` (order id, for dedupe).
- Enable "enhanced conversions for leads" in the Ads account, and capture hashed email on the website lead form via Google tag or Data Manager.
- Upload within 90 days of the click (recommended: a daily batch from our cron).

### 5.4 GA4 Measurement Protocol

- `POST https://www.google-analytics.com/mp/collect?measurement_id=G-XXX&api_secret=…` with `{ client_id (from _ga cookie), user_id?, events: [{ name: 'generate_lead' | 'purchase', params: { value, currency, transaction_id, session_id, engagement_time_msec } }] }`.
- Use `/debug/mp/collect` to validate.
- MP **supplements** gtag; it doesn't create sessions or attribution by itself. Store `_ga` client_id and `session_id` at lead time, or offline purchases show up as "(not set)" source.
- Limits: 25 events/request, event must be within 72 h to be attributed to a session.

### 5.5 Cookie consent (US / South Carolina)

- **South Carolina has no comprehensive consumer privacy law** [verified: MoFo privacy library, Securiti]. SC's Age-Appropriate Design Code Act (signed 2026-02-05) applies only above thresholds ($25M revenue / 50k consumers / 50% data revenue), so it doesn't apply here.
- None of the US state privacy laws require **prior opt-in** for non-essential cookies (as of Aug 2026). Laws in states with thresholds (CA, VA, CO, TX, etc.) require **opt-out** of "sale/sharing/targeted advertising" and honoring **Global Privacy Control** once a business crosses their thresholds, which a single SC shop almost certainly doesn't.
- **Practical minimum:**
  - A privacy policy disclosing pixels, CAPI, the data shared with Meta/Google, and SMS/email use.
  - A "Your privacy choices" opt-out link that respects the GPC signal (cheap to build, future-proof).
  - **No blocking consent banner is required.**
- Other exposures:
  - **VPPA/wiretap class actions** over pixels (CIPA-style suits mostly target CA visitors). Avoid session-replay tools.
  - Never send vehicle VINs or health-like data to pixels.
  - Hash PII before any platform upload.

---

## 6. Architecture recommendation for lucky-diesel

### 6.1 Principles

- Supabase stays the system of record. Platforms are sinks, and external ids are mirrored back.
- Everything outbound goes through **jobs** (rows) processed by the existing dispatcher pattern: idempotent, retryable, auditable.
- Every AI output is a **draft** until an owner approval row exists. The approval hashes the payload.
- A **connection-aware adapter layer** (`lib/marketing/channels/{meta,google,gbp,instagram,tiktok,resend,twilio}.ts`), each with a `demo` implementation (§6.5).
- RLS: owner/staff roles only. Tokens are readable only by `service_role`.

### 6.2 Tables (proposed)

**Audience**

| Table | Key columns |
|---|---|
| `contacts` (or extend `customers`) | Reuse `customers` as the contact. Add `email_marketing_status` (subscribed / unsubscribed / bounced / complained), `sms_marketing_consent_at`, `sms_marketing_consent_text_version`, `sms_marketing_opted_out_at`, `consent_source_url`, `tags text[]`, `last_marketing_sent_at`, `timezone` |
| `contact_consent_events` | contact_id, channel (email/sms), purpose (transactional/marketing), action (granted/revoked), method (form/STOP/link/owner), evidence jsonb (ip, ua, url, text), created_at. Append-only; this is the audit trail for TCPA. |
| `segments` | id, name, kind (`dynamic` / `static`), `definition jsonb` (a small whitelisted filter DSL, e.g. `{platform in [...], last_service_before: '180d', has_vehicle: true, tag: 'fleet'}`), `estimated_count`, `refreshed_at` |
| `segment_members` | segment_id, customer_id, added_at. Used for static segments, or as a snapshot when a campaign sends. |
| `suppressions` | channel, value (email/phone), reason, created_at. Global do-not-contact, checked last before any send. |

**Campaigns (broadcast + drip)**

| Table | Key columns |
|---|---|
| `campaigns` | id, name, type (`broadcast` / `drip` / `ad` / `social`), status (draft / pending_approval / approved / scheduled / running / paused / completed / archived), goal, offer_id, landing_page_id, utm_campaign, budget caps (`max_daily_budget_cents`, `max_total_budget_cents`), starts_at, ends_at, created_by |
| `campaign_steps` | campaign_id, step_order, channel (email/sms), `delay_minutes` **or** `send_at`, `anchor` (enrolled_at / previous_step / fixed), subject/body templates, `exit_condition jsonb` (e.g. booked appointment, unsubscribed), `ai_generation_id` |
| `campaign_audiences` | campaign_id, segment_id, include/exclude |
| `campaign_enrollments` | campaign_id, customer_id, status (active / completed / exited / suppressed), enrolled_at, current_step, exited_reason. Unique (campaign_id, customer_id). |
| `campaign_sends` | Could reuse `messages`: campaign_id, step_id, customer_id, channel, provider_message_id, status, opened_at, clicked_at, sent_at. Also feeds frequency caps. |

**Ads + creatives**

| Table | Key columns |
|---|---|
| `ad_creatives` | id, campaign_id, platform (meta/google_pmax/google_search/tiktok), objective, status, landing_url (with UTMs), notes |
| `ad_creative_variants` | creative_id, variant_label, headline(s) jsonb, primary_text, description, cta, `image_asset_ids uuid[]`, `compliance_status` (pass/warn/fail), `compliance_findings jsonb`, `ai_generation_id` |
| `creative_assets` | id, storage_path, mime, width, height, aspect, source (upload / ai / shopify / gallery), `ai_generation_id`, alt_text, sha256 |
| `approvals` (existing table is for work orders, so create **`marketing_approvals`**) | subject_type (ad_variant / campaign / social_post / review_reply), subject_id, `payload_hash`, decision (approved/rejected), approved_by, note, decided_at |
| `ad_publications` | variant_id, connection_id, external campaign/adset/ad ids jsonb, status_on_platform, last_synced_at, publish_attempt_key unique, error |
| `ad_metrics_daily` | publication_id, date, impressions, clicks, spend_cents, leads, conversions, conversion_value_cents. Unique (publication_id, date). |
| `budget_guards` | platform, max_daily_cents, max_monthly_cents, auto_pause_cpl_cents. Or put these in `shop_settings`. |

**Organic social**

| Table | Key columns |
|---|---|
| `social_posts` | id, campaign_id?, status (draft/pending_approval/approved/scheduled/published/failed), caption, link_url, asset_ids, `scheduled_for`, ai_generation_id |
| `social_post_targets` | post_id, connection_id, platform (instagram/facebook/gbp/tiktok), platform_options jsonb (GBP offer fields, IG media_type), external_id, permalink, published_at, error, attempts |
| `review_replies` | gbp_review_id, rating, review_text, draft_reply, status, posted_at |

The content calendar is a view over `social_posts` + `campaign_steps` + ads, filtered by `scheduled_for`.

**Connections**

| Table | Key columns |
|---|---|
| `channel_connections` | id, provider (meta/google_ads/gbp/instagram/tiktok_ads/tiktok_content/resend/twilio), external_account_id, display_name, scopes text[], **`access_token_encrypted`**, **`refresh_token_encrypted`**, token_expires_at, status (connected/expired/revoked/error), mode (`live` / `demo`), last_error, connected_by |

Token encryption:
- Use **Supabase Vault** (`vault.create_secret`, reading via `vault.decrypted_secrets` from service_role only) and store the secret id, **or** encrypt in app with AES-256-GCM using a key in a Vercel env var (`MARKETING_TOKEN_KEY`, rotated via a key id column).
- Never expose the table through PostgREST to authenticated users; RLS deny-all plus service-role access only.
- Refresh Google tokens on use. Meta long-lived user tokens last 60 days, so prefer system user tokens, which don't expire.

**Offers, referrals, landing pages**

| Table | Key columns |
|---|---|
| `offers` | id, code, kind (percent/amount/free_service), value, terms, starts_at, ends_at, max_redemptions, per_customer_limit, shopify_discount_id (if mirrored to Shopify via Admin API; the public products.json is read-only, so discount sync needs an Admin API token), channel_restrictions |
| `offer_redemptions` | offer_id, customer_id, work_order_id / invoice_id / shopify_order_id, redeemed_at, amount_cents |
| `referral_codes` | customer_id, code unique, reward_offer_id, referee_offer_id, uses |
| `referrals` | referral_code_id, referred_customer_id, lead_id, status (pending/qualified/rewarded), qualified_at |
| `landing_pages` | slug, title, campaign_id, offer_id, blocks jsonb (hero/offer/form/gallery refs), status, published_at, form_config. Served by `app/(marketing)/l/[slug]`. |

**Tracking and attribution**

| Table | Key columns |
|---|---|
| `tracking_visitors` | anonymous_id, first_seen_at, ga_client_id, fbp, fbc |
| `attribution_touches` | anonymous_id, customer_id?, lead_id?, touch_type (first/last/click), utm_* columns, gclid, gbraid, wbraid, fbclid, ttclid, referrer, landing_path, occurred_at |
| `conversion_events` | id, kind (lead / appointment_booked / invoice_paid / shopify_order), customer_id, lead_id, value_cents, occurred_at, first_touch_id, last_touch_id, campaign_id (resolved) |
| `conversion_uploads` | conversion_event_id, destination (meta_capi / google_data_manager / ga4_mp), status, attempts, response, sent_at. Unique (conversion_event_id, destination). |
| `short_links` | slug, target_url, campaign_id, step_id, clicks. Branded SMS links for click tracking. |

**AI jobs**

| Table | Key columns |
|---|---|
| `ai_generation_jobs` | id, kind (ad_copy / image / social_caption / email / review_reply / landing_copy), status (queued/running/succeeded/failed), model_id, prompt_version, input jsonb (brief, product refs, platform constraints), output jsonb, asset_ids, input_tokens, output_tokens, `cost_usd numeric`, gateway_generation_id, error, requested_by, created_at |
| `ai_prompt_templates` | key, version, system_prompt, output_schema_name, active |
| `brand_profile` (or `shop_settings` jsonb) | Voice, banned phrases (the §2.6 list), service area, offers, and approved claims. Always passed to the model. |

A monthly AI spend cap is a sum over `ai_generation_jobs.cost_usd`.

### 6.3 Extending the existing engine

Today, `emit()` inserts `automation_runs` per automation with a dedupe key, and `dispatchDue()` sends due runs (limit 50) by `subject_type` + audience + channels. Extend it with the same shape rather than a second engine:

1. **Add a job kind to `automation_runs`**, or add a sibling `marketing_runs` table with identical dispatch semantics: `run_kind` = automation / campaign_step / social_publish / ad_sync / conversion_upload / ai_job. Keep `dedupe_key` unique and the `scheduled_for` index.
2. **Campaign broadcast:** when approved and scheduled, a *materializer* expands the campaign audience at `send_at − 15 min` into `campaign_enrollments` (snapshotting membership). It then writes one run per enrollment with `dedupe_key = campaign:{id}:step:{n}:customer:{cid}`, applying suppressions, consent, frequency caps and per-recipient quiet hours when scheduling. Chunk the inserts (e.g. 500).
3. **Drip:** enrollment triggers come from existing events (`emit('lead.created')`, `work_order.status:ready`, `invoice.paid`) through a new `campaign_triggers` mapping (trigger_event → campaign_id). Enrolling schedules step 1. When a step executes, it schedules step n+1 (`delay` from the previous step). Before each send, re-check `exit_condition` against live data, plus consent.
4. **Dispatcher:** `dispatchDue` routes by `run_kind` to a handler. The final gate in the send handler checks: `suppressions`, per-channel marketing consent, the frequency-cap count in `messages`, quiet hours, and the connection being live (demo mode logs a simulated send). Use `select … for update skip locked` (via an RPC) so overlapping invocations don't double-send.
5. **Cron cadence:** `vercel.json` has one **daily** cron (`0 11 * * *`). Scheduled sends and social publishing need at least **every 5–15 minutes**. Hobby plan crons are limited to once per day; Pro allows per-minute schedules. Options:
   - Upgrade to Pro and add `*/5 * * * *` for `/api/cron/marketing`.
   - **Vercel Workflow / Queues** for durable per-enrollment timers.
   - **Supabase `pg_cron` + `pg_net`** calling the dispatch route with a secret, which is free and independent of the Vercel plan.
   - Twilio scheduled messages and Facebook `scheduled_publish_time` can offload exact timing for those two channels.
6. **Webhooks in:**
   - Twilio `StatusCallback` + inbound STOP → `contact_consent_events` + `suppressions`.
   - Resend webhooks (`email.bounced`, `email.complained`, `email.clicked`) → contact status and `campaign_sends`.
   - Meta/Google lead forms, optional.
7. **Daily sync jobs** (the existing daily cron is fine for these): ad insights → `ad_metrics_daily`, GBP reviews pull, LSA leads pull, conversion uploads retry, segment `estimated_count` refresh, budget guard auto-pause.

### 6.4 AI generation flow

Route `POST /api/marketing/generate` (owner-only):
1. Insert an `ai_generation_jobs` row (queued).
2. Run the job in the request (text takes a few seconds), or via `after()` / Workflow for images.
3. Call `generateText` + `Output.object` (copy), or `generateImage` → Storage.
4. Run the compliance lint → write variants with `compliance_status`.
5. Record usage and cost: token usage × the price table, or the gateway generation id to look up cost.

Gate on a monthly AI cost cap. Use Fluid Compute default timeouts; image generation can take 10–40 s.

### 6.5 Demo-mode strategy

The app already has `DEMO_MODE` and `MESSAGING_SMS_MODE` (simulated SMS). Extend the pattern:

- **Per-connection mode:** `channel_connections.mode = 'demo'` is seeded for every provider. The adapter interface (`publishAd`, `publishPost`, `fetchInsights`, `uploadConversion`, `sendEmail`, `sendSms`) has a `DemoAdapter` that:
  - returns fake external ids (`demo_meta_ad_…`)
  - writes `status_on_platform = 'SIMULATED_ACTIVE'`
  - produces **deterministic synthetic metrics** (seeded by variant id, e.g. CTR 0.8–2.5%, CPL $18–45), so dashboards and auto-pause rules can be exercised
  - logs the exact payload it *would* have sent, viewable in the UI as a "Request preview"
- **AI in demo:** if the gateway fails with `customer_verification_required` or no auth, fall back to **canned fixtures** (pre-written diesel-shop copy and a few stock/gallery images from `gallery_items`) with `model_id = 'demo/fixture'`. The UI badges these as sample output.
- **Visible banner** on each channel card: "Demo — not connected. Connect Meta to publish for real." Publishing controls stay enabled but label the result "Simulated".
- **Promotion to live:** OAuth connect → store encrypted tokens → run a read-only health check (list ad accounts / pages) → the owner flips the mode to `live`. Existing simulated publications are never auto-published live.
- **Safety:** in `VERCEL_ENV !== 'production'`, force every adapter to demo regardless of the DB setting, unless `MARKETING_ALLOW_LIVE_IN_PREVIEW=true`.

### 6.6 Owner action checklist and realistic timelines

| Item | Owner must provide | Typical time |
|---|---|---|
| Vercel AI Gateway | Credit card on the Vercel team; set a budget | Minutes |
| Meta | Business Portfolio + **Business Verification** (EIN docs, domain verification), ad account + payment, Page + IG professional account linked, developer app; App Review only if needed | 1–3 weeks |
| Google Ads | Ads account + billing, MCC, Google Cloud project OAuth consent screen, API access application (Explorer/Basic; brand verification pilot) | Days to 3 weeks |
| Google Data Manager API + enhanced conversions for leads | Enable in Ads account, create conversion actions | 1–3 days |
| GBP API | Verified profile, GBP API access request form | 1–3 weeks |
| LSA | LSA profile, licenses/insurance, background checks (manual UI, not API) | 2–6 weeks |
| TikTok | Business API app approval (ads); Content Posting audit only for public direct posts | 1–4+ weeks |
| Twilio 10DLC marketing | Brand (EIN) + Mixed/Low-Volume Mixed campaign, website SMS terms | 1–3 weeks |
| Resend | Verified sending subdomain for marketing, DMARC record | About 1 day |
| GA4 | Property + MP API secret | Minutes |
| Shopify discounts (optional) | Admin API custom app token | Minutes |

### 6.7 Suggested phasing

1. **Phase 1 (no external approvals needed):**
   - AI generation jobs, creatives + variants + approvals, compliance lint, demo adapters.
   - Contacts/segments, consent events, email campaigns via Resend (live).
   - UTM/click-id capture, conversion events, landing pages, offers and referral codes.
2. **Phase 2:** SMS marketing once the 10DLC campaign is approved; GA4 MP; Facebook Page + Instagram organic; GBP posts and review replies.
3. **Phase 3:** Meta ads publish + CAPI; Google Search/PMax publish + Data Manager uploads; LSA lead ingest.
4. **Phase 4:** TikTok (inbox drafts, then ads).

---

## 7. Gaps and uncertainties

- Instagram publishing limit: Meta docs are internally inconsistent (50 vs 100 per 24 h). Read `content_publishing_limit` at runtime.
- Price not listed in the gateway feed for FLUX.2 models; gpt-image-* are token-priced, so per-image cost varies by quality and size.
- The Meta "Marketing API Access Tier" rename (May 2026) and Google's developer-token sunset (Sept 2026) are recent. Re-verify the exact onboarding screens when applying.
- PMax description minimums differ slightly between third-party guides and the API asset-requirements page. Follow the API page.
- LSA-to-PMax migration details for the shop's category and metro are unknown.
- State SMS "mini-TCPA" laws change often. Have counsel confirm SC and the states of any out-of-state customers (parts buyers).
- Legal review is recommended for any tuning/performance product marketing (Clean Air Act).

---

## 8. References (accessed 2026-09-17)

Primary/official sources unless marked (3P) for third-party.

**AI**
- Vercel AI Gateway docs — https://vercel.com/docs/ai-gateway
- AI Gateway Pricing — https://vercel.com/docs/ai-gateway/pricing
- AI Gateway FAQ — https://vercel.com/docs/ai-gateway/faq
- AI Gateway OIDC auth — https://vercel.com/docs/ai-gateway/authentication-and-byok/oidc
- AI Gateway model list (live JSON) — https://ai-gateway.vercel.sh/v1/models
- AI SDK AI Gateway provider — https://ai-sdk.dev/providers/ai-sdk-providers/ai-gateway
- `ai@7.0.105` type definitions (installed locally in scratchpad)

**Meta**
- Update to Ads Management Standard Access (Marketing API Access Tier) — https://developers.meta.com/blog/updates-to-ads-management-standard-access-feature/
- Advantage+ Creative — https://developers.facebook.com/docs/marketing-api/creative/advantage-creative/
- Ad Creative Degrees of Freedom Spec — https://developers.facebook.com/docs/marketing-api/reference/ad-creative-degrees-of-freedom-spec/
- Marketing API 2026 Out-of-Cycle Changes — https://developers.facebook.com/documentation/ads-commerce/marketing-api/out-of-cycle-changes/occ-2026
- Meta Ad Standards — https://transparency.meta.com/policies/ad-standards/
- (3P) Meta Ads API setup and limits 2026 — https://admanage.ai/blog/meta-ads-api
- (3P) Meta Marketing API Q2 2026 update — https://www.kitchn.io/blog/meta-marketing-api-q2-2026-update

**Google**
- Google Ads API access levels — https://developers.google.com/google-ads/api/docs/api-policy/access-levels
- Developer token — https://developers.google.com/google-ads/api/docs/api-policy/developer-token
- (3P) Developer token sunset — https://ppc.land/google-drops-developer-tokens-from-ads-api-access-decisions/
- PMax asset groups — https://developers.google.com/google-ads/api/performance-max/asset-groups
- PMax asset requirements — https://developers.google.com/google-ads/api/performance-max/asset-requirements
- Local Services campaigns — https://developers.google.com/google-ads/api/docs/campaigns/local-service-campaigns
- LocalServicesLeadService — https://developers.google.com/google-ads/api/reference/rpc/v25/LocalServicesLeadService
- (3P) LSA moving into Google Ads — https://www.searchenginejournal.com/google-is-bringing-local-services-ads-into-google-ads/582816/
- Manage offline conversions — https://developers.google.com/google-ads/api/docs/conversions/upload-offline
- Upgrade to enhanced conversions for leads — https://support.google.com/google-ads/answer/14274408
- (3P) Offline conversion import changes / Data Manager API — https://ppcnewsfeed.com/ppc-news/2026-05/upcoming-changes-offline-conversion-import-google-ads-api/
- Dangerous products or services policy — https://support.google.com/adspolicy/answer/6014299
- GBP localPosts — https://developers.google.com/my-business/reference/rest/v4/accounts.locations.localPosts
- GBP reviews — https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews
- GBP Q&A API changelog (discontinued) — https://developers.google.com/my-business/content/qanda/change-log
- (3P) Q&A API discontinued 2025-11-03 — https://ppc.land/google-discontinues-business-profile-q-a-api-effective-november-3/
- GBP latest updates — https://developers.google.com/my-business/content/latest-updates

**Instagram / TikTok**
- (3P) Instagram publishing limits 2026 — https://zernio.com/blog/instagram-graph-api
- (3P) Instagram 25/50/100-post limit — https://www.ayrshare.com/solutions/instagram-graph-api-error-9-the-25-post-daily-limit-how-to-fix-it/
- TikTok Direct Post — https://developers.tiktok.com/docs/en/content-posting-api-reference-direct-post
- TikTok Content Sharing Guidelines — https://developers.tiktok.com/docs/en/content-sharing-guidelines

**Email / SMS**
- Resend Audiences — https://resend.com/docs/dashboard/audiences/introduction
- Resend Unsubscribe Topics — https://resend.com/blog/unsubscribe-topics
- Resend create and send Broadcasts via API — https://resend.com/changelog/create-and-send-broadcasts-via-api
- Twilio MPS and Trust Scores for 10DLC — https://help.twilio.com/articles/1260803225669-Message-throughput-MPS-and-Trust-Scores-for-A2P-10DLC-in-the-US
- Twilio 10DLC campaign use case types — https://support.twilio.com/hc/en-us/articles/1260801844470-List-of-campaign-use-case-types-for-A2P-10DLC-registration
- Twilio MMS rate limits changelog (2026-03-18) — https://www.twilio.com/en-us/changelog/increased-mms-rate-limits-for-a2p-10dlc-phone-numbers-in-the-u-s0
- Twilio 10DLC fees — https://help.twilio.com/articles/1260803965530-What-pricing-and-fees-are-associated-with-the-A2P-10DLC-service-
- FCC DA 26-12 (revocation waiver extension) — https://docs.fcc.gov/public/attachments/DA-26-12A1.pdf
- (law firm) Wiley: TCPA revocation waiver extended — https://www.wiley.law/alert-FCC-Extends-Limited-Waiver-for-Part-of-the-TCPA-Consent-Revocation-Rule
- (3P) One-to-one consent vacated — https://activeprospect.com/blog/fcc-one-to-one-consent/
- RFC 8058 (one-click unsubscribe) — https://www.rfc-editor.org/rfc/rfc8058

**Emissions law**
- EPA tampering and defeat devices enforcement alert — https://www.epa.gov/sites/default/files/2020-12/documents/tamperinganddefeatdevices-enfalert.pdf
- EPA COBB Tuning Clean Air Act settlement — https://www.epa.gov/enforcement/cobb-tuning-products-llc-clean-air-act-settlement
- eBay emissions defeat device policy — https://www.ebay.com/help/policies/prohibited-restricted-items/emissions-control-defeat-devices-policy?id=5383

**Privacy**
- (law firm) MoFo South Carolina privacy — https://www.mofo.com/privacy-library/south-carolina
- (law firm) Troutman: SC Age-Appropriate Design Code — https://www.troutmanprivacy.com/2026/02/south-carolina-enacts-age-appropriate-design-code-act/
- (3P) Cookie consent under US state laws 2026 — https://privacylawmap.com/blog/cookie-consent-requirements-us-state-privacy-laws

Stated from established vendor documentation but not re-fetched this session (re-check before implementing): Meta CAPI payload fields, GA4 Measurement Protocol limits, the Gmail/Yahoo bulk sender rules, Facebook `scheduled_publish_time` window, Twilio scheduled message window, and Instagram media specs.

# Lucky Diesel — Discovery & Build Plan

Research completed 2026-09-16 (four parallel tracks: local presence & competitors,
shop-software benchmark, stack & compliance, SEO audit). Unverified items are marked.

## 1. What we learned

### The business
- Instagram bio: **Charleston SC**. Possible shop on N US Hwy 17, Awendaw SC 29429 (Nextdoor — *unconfirmed*).
- Owner display name on Instagram: "Lucas Tyler" (*confirm*).
- **New business**: domain registered May 2025, TikTok Dec 2025. IG 188 followers, TikTok 294 / 7.5K likes, FB 42.
- **No Google Business Profile, no reviews found anywhere.**
- Name clash: "Lucky Diesel Performance & Repair", Oklahoma City (since 2015) → always pair name with "Charleston".
- Shopify store sells DDP turbos ($2.2–3.5K), injector sets ($3.1–4.6K), CP3s, EZ-Lynk ASAP/AMDP tunes ($444–1,351).
- **Risk:** tuning collection has no emissions disclaimer. EPA civil enforcement still applies (DOJ dropped
  *criminal* defeat-device cases Jan 2026). Raise privately with owner; have counsel review wording.

### Local competition (Charleston / coastal SC)
Palmetto Diesel & Performance (N. Charleston), T&R Truck & Auto (Myrtle Beach), Performance Diesel (Mt Pleasant, FB-only),
Charleston Performance Solutions (gas only). **None** offer: online scheduling, SMS, job-status tracking,
dyno/build pages, financing, or a compliance page. That is the opening.

### Shop software he'd otherwise pay for
Tekmetric / Shopmonkey / AutoLeap / Shop-Ware: **$180–$500/mo per location → $2.1–6K/yr**, core features gated to mid tiers.
The 20% of features small shops actually use: photo/video inspections, text estimate approval + e-sign,
two-way texting, text-to-pay, job board, service history, time clock.
**Nobody** tracks diesel-performance data: tune revisions, tuner serials, dyno before/after, build sheets, emissions acknowledgements.

### Stack decision
| Layer | Choice | Why |
|---|---|---|
| Auth + DB + files | **Supabase** (Postgres + RLS + Storage) | roles via RLS, magic link + phone OTP, photo/video storage |
| Automations | **Vercel Workflow** + Vercel Cron | durable sleeps (reminders, follow-ups), same repo, cents/mo |
| Email | Resend + React Email | already used in other projects |
| SMS | Twilio **after A2P 10DLC registration** (1–2 wks, needs LLC EIN) | unregistered traffic is carrier-blocked |
| Payments | Stripe Checkout (test mode for demo) | job-linked links, webhooks |
| Reviews | Direct Google review link, sent to **every** customer | review-gating violates Google + FTC rules |

Run cost at ~200 customers / 500 SMS: **≈ $55–85/mo** (Vercel Pro $20, Supabase Pro $25, Twilio ~$10–18, Resend $0–20).

### SEO audit — fixes
- Preview domain indexable, no canonical/robots/sitemap → add `robots.ts`, `sitemap.ts`, canonical, noindex on `*.vercel.app`.
- `NEXT_PUBLIC_SITE_URL` unset → OG image points at Shopify domain (broken share preview).
- No NAP / city anywhere → blocks local ranking. Add "Charleston, SC" now; address/hours when confirmed.
- 7 preloaded font files → trim.
- H1 has no keyword → add keyword subhead.
- Keep Shopify for parts (100+ indexed URLs); don't migrate the store domain without a 301 map.

### Compliance guardrails baked into the build
- SMS consent checkbox (unchecked, optional) with CTIA language; store consent timestamp/IP/text version; STOP/HELP.
- Estimates: written + digital approval with signer identity, timestamp, IP, snapshot hash (ESIGN/UETA). No enacted SC
  estimate statute found (Bill 860 died) — still best practice; attorney to confirm.
- Emissions acknowledgement signed per work order; no "delete" language anywhere.
- Review requests: every completed job, one reminder max, no incentives, no gating.

## 2. What we're building (demo-ready)

### Public site upgrades
- Charleston local SEO: city in titles/schema, robots/sitemap/canonical, OG fixes, font trim.
- **Builds / dyno showcase** pages (`/builds/[slug]`) with before/after numbers.
- **Platform pages** (`/duramax`, `/powerstroke`, `/cummins`) linking to matching Shopify collections.
- "Starting at" price ranges on services; **emissions compliance page** + tuning disclaimer.
- **Online booking**: pick service + date/time slot; photo upload on quote form; SMS consent.
- Reviews section (ready for Google profile), financing placeholder badge.

### Client portal (`/portal`)
Magic-link login → My Garage (trucks) → truck profile (build sheet, tune history, dyno chart, service history) →
live job status timeline → inspection report with photos inline, approve/decline per line + e-sign →
estimates & invoices → pay online (Stripe test) → emissions acknowledgement → message the shop → book service.

### Employee portal (`/shop`)
Mobile-first. My jobs board → work order detail → status changes → inspection capture (checklist, camera, R/Y/G) →
clock in/out per job → tune log + dyno entry → notes & parts requests.

### Admin (`/admin`)
KPI dashboard (car count, avg repair order, approval rate, billed vs clocked hours, revenue by service, lead funnel) →
leads inbox → customers & trucks (VIN decode via NHTSA vPIC) → estimate → work order → invoice pipeline →
calendar / bay board → staff management & invites → templates (inspections, canned jobs, waivers, messages) →
**Automations center** (toggle each, edit copy, see run log) → **Message log / demo phone** → settings.

### Automations
| Trigger | Action |
|---|---|
| New lead / booking | notify owner (email + SMS) · auto-reply customer · follow-up day 1 & day 3 if not converted |
| Appointment booked | confirmation · reminder 24h before · reminder 2h before |
| Work order status change | text customer the new status + portal link |
| Inspection/estimate ready | text/email approval link · nudge after 4h if unanswered |
| Estimate approved/declined | notify assigned tech + owner |
| Job complete | invoice + pay link · review request next day (all customers) · one reminder |
| Paid | receipt · add to service-reminder schedule |
| Service due (miles/months), re-tune check | reminder campaign |
| Daily 7am | owner summary email (today's jobs, leads, unpaid invoices) |
| Declined work | follow-up after 30 days |

**Demo mode:** email really sends (to the presenter's inbox); SMS lands in an on-screen *Demo Phone* +
message log until 10DLC is approved; Stripe in test mode. One env flag flips each channel live.

## 3. Pitch assets
1. Live site + three portals with seeded, realistic data (trucks, jobs, dyno pulls, invoices).
2. Demo logins (owner, tech, customer) + click-by-click demo script.
3. Proposal page: findings, what's built, cost vs Tekmetric/Shopmonkey, rollout timeline, owner setup checklist.

## 4. Owner inputs needed (before go-live, not before demo)
Address & hours · confirm owner name · Google Business Profile (claim/verify, Place ID) · LLC EIN + legal name
(10DLC, Stripe) · DNS access for luckydiesel.com (email auth) · labor rate & price ranges · dyno? mobile service? ·
which tunes are emissions-compliant · attorney review of waiver/SMS terms/privacy policy.

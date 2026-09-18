# Engagement & conversion research — Lucky Diesel

Written 2026-09-18. Scope: how a stranger with a $2,000–$15,000 truck decision gets
from the homepage to a phone call or a booking, and what makes them stop. Covers the
decision path, the no-reviews cold start, fitment UX, quote/booking flows, retention
loops, mobile reality and measurement.

**Out of scope, owned by other documents:** SEO (`seo-2026.md`) and visual art
direction (`visual-direction-2026.md`). Feature inventory: `marketing-coverage.md`
already lists 392 features and where each one lives. This document does not repeat
that list — §11 says what the matrix cannot tell you and where it is wrong.

**Hard line, restated because most of the findings below brush against it:** nothing
here proposes fabricating a review, rating, testimonial, years in business, dyno
number, completed build or customer photo. Where a tactic would normally lean on
social proof, the substitute is a fact the shop can actually assert. §8 names two
already-built features that violate this in spirit and one that violates it in a
way that will bite during the pitch.

---

## 0. The three highest-leverage changes

Ranked on evidence strength × effort × how badly the current build leaks.

### 1. Carry the picked truck into `/book` and `/#quote` — and let the picker accept a VIN or "not sure"

`/fitment` asks four questions, resolves a real truck, sets a cookie, and says *"We
remember it while you shop."* True for the store, false everywhere else.
`readSavedTruck` (`lib/fitment/truck-server.ts`) is read by exactly three files — the
three under `app/(site)/store/`. Neither `components/booking/BookingForm.tsx` nor
`components/quote/QuoteForm.tsx` touches it. Both re-ask for the truck, in a *different
vocabulary* (platform radio + generation select) from the one the visitor just used
(year → make → model → engine).

So the site's single best idea dead-ends at the two pages where money is made. The
visitor answers the same question twice, gets different choices the second time, and has
to re-derive "2016 Ram 2500 · 6.7L Cummins" into "Cummins / 2013–2018 6.7L" — re-entering
information the server already holds, at the exact moment they are deciding whether this
shop is organised enough to trust with $9,000.

Second half of the same fix: the picker has no escape hatch. Four `<select>`s, no VIN
field, no "I'm not sure which engine". The "don't know my engine or trim" problem is a
documented gap in YMME selectors industry-wide and VIN decode is the standard answer —
and this repo *already has it*: `/api/marketing/vin` wraps the free NHTSA vPIC decoder
and `QuoteForm` uses it. The hero picker does not.

**Do:** (a) read the truck cookie in `BookingForm` and `QuoteForm` and render it as a
confirmed line ("Your truck: 2016 Ram 2500 · 6.7L Cummins — change") with the
platform/generation fields pre-filled and collapsed; (b) add a VIN field to
`FitmentPicker` that posts to the same `/fitment/truck` endpoint; (c) auto-select the
engine step when a generation has exactly one engine (several do — e.g. `gmmd-2019`
has only the L5D) so the four taps become three.

### 2. Publish a labour rate, a diagnostic fee and a real "how we quote" page

The best-evidenced single tactic in the brief, and the site does not do it.

The site publishes *"Parts from $444 · labour quoted"* (`lib/site.ts SERVICES.partsFrom`,
rendered at `app/(site)/[platform]/page.tsx:115` and `components/sections/Services.tsx:41`).
For someone choosing between a $2k tow tune and a $15k boost build, that is not a price
signal — it is the absence of one.

Mohan, Buell & John, *Lifting the Veil: The Benefits of Cost Transparency* (Marketing
Science 39(6), 2020) — a field experiment plus six lab experiments — found voluntary cost
disclosure raised purchase likelihood **21.1%** via trust, and **only when voluntary
rather than mandated**. Nobody is forcing a Charleston diesel shop to publish its hourly
rate, which is precisely the condition under which the effect holds.

It also aims at the right target: AAA (Dec 2016) found two-thirds of US drivers distrust
repair shops, with the top two named reasons **unnecessary services (76%)** and
**overcharging (73%)** — both price-opacity fears. NN/g's credibility testing has a
participant abandoning a service site in 35 seconds because no rate was shown ("they
don't state the rate here… I feel they are not open enough").

**Do:** a `/how-we-quote` route stating the hourly labour rate, the diagnostic fee and
whether it's credited against the job, that estimates are written before work starts, and
per-tier all-in ranges for the three `USE_CASES`. Add `hourlyRateCents` /
`diagnosticFeeCents` to `shop_settings` so it is owner-editable, never hardcoded. The
tier cards in `components/v4/UseCaseTiers.tsx` already have the right shape — they just
have nowhere to put a total.

**Blocked on owner** for the numbers. **Buildable now:** the page, the fields, the
admin form, and the empty state that hides the section until the owner fills it in
(same discipline `ReviewStrip` already uses).

### 3. Instrument the phone tap, the fitment funnel and the "not one of ours" answer

`components/marketing-public/analytics.ts` defines seven events. `trackEvent()` is called
from exactly one file: `components/marketing-public/ChatPanel.tsx`. So `call_click` and
`text_click` fire **only** from inside the chat bubble. The primary phone CTA in
`components/layout/MobileActionBar.tsx`, the phone link in `components/v4/home/HeroV4.tsx`
and the Call/Text pair on every product page fire nothing.

For a trade business where phone dominates — YouGov's US panel puts phone first at 35%
for service contact against 5% for website forms, rising to 39% for Gen X and 52% for
Boomers — the site is blind to its most important conversion. Server-side
`conversion_events` covers form submissions (`lib/marketing/core/attribution.ts`), so the
funnel is instrumented only where it is *least* used.

Nothing measures the hero either: no event for starting the picker, completing it,
hitting an unsupported engine, saving a truck or choosing a goal. The one thing the whole
design bets on is the one thing with no telemetry.

**Do:** call `trackEvent('call_click' | 'text_click')` from every `tel:`/`sms:` anchor
(there are five call sites); add `fitment_start`, `fitment_resolved`,
`fitment_unsupported`, `truck_saved`, `goal_selected` to `SiteEvent` and `EVENT_MAP`;
record `fitment_unsupported` server-side with the engine id, because "how many people
arrive with a truck we can't help" is a business question, not an analytics one.

---

## 1. How to read the citations

Research in this space is unusually polluted. Three structural problems recur, and
they are worth stating so nobody re-litigates a number later:

1. **Ancient studies cited as current.** The canonical form/lead/call numbers date to
   2007–2016 and are recirculated in 2026 content with the date stripped.
2. **Invented citations.** Content farms produce precise-sounding attributions
   ("Forrester 2024", "MarketingSherpa 2024") that trace to no published report. Every
   number below that could not be traced is marked.
3. **Vendor-validated vendors.** Almost every current number comes from a company
   selling the product being validated (form builders, SMS platforms, call tracking,
   shop-management software).

Tags used below: **[R]** real/primary/peer-reviewed · **[S]** credible survey with
disclosed methodology · **[V]** vendor-published, directional only · **[F]** folklore,
do not cite · **[I]** inference by this document, not a finding.

---

## 2. The decision path for a $2k–$15k truck job

There is no published study of this exact path. The closest real anchors are the
Cox Automotive Service Industry Study (independent, though Cox owns Xtime — flag the
overlap) and the Moneypenny/Contracting Business trades survey.

**What the evidence supports:**

- **Independent shops now beat dealerships on preference.** Dealer share of service
  visits has fallen to 29%, down 12pp since 2018; independents are the #1 preferred
  provider. 48% of customers leaving a dealer cite *convenience*. [R, via secondary
  reporting of the Cox study — primary PDF not read]
- **The things people say they want are exactly what a portal does:** 72% want to
  review and approve estimates online, 71% want to schedule digitally, 64% want repair
  history online. [R, same caveat] The `/portal` work in this repo is aimed correctly.
- **Awareness, not preference, is the barrier to online booking.** 45% of people who
  didn't book online didn't know it was an option; 23% book outside business hours.
  [R] Implication: the booking CTA needs to be visible from the first screen, not one
  level down. `MobileActionBar` does this on phones; the v4 hero puts "or book online"
  as a quiet secondary link under the phone number.
- **Mobile booking converts ~40% worse than desktop.** Xtime's own data: 24% desktop vs
  14% mobile from "appointment started" to "appointment booked". [V — Xtime sells the
  software, but it is damning against their own product, which raises confidence] The
  report doesn't diagnose the cause. See §6.
- **Consumers overstate nothing; contractors overstate urgency.** 83% of consumers say
  they choose whoever responds first, but only 17% expect a reply "within seconds" —
  against 34% of contractors who think that's expected. 41% say "within minutes" would
  satisfy them; ~46% expect a response inside four hours. [S — Moneypenny, 500 trade
  companies + 2,000 consumers, 29 May 2026] This is the most useful calibration in the
  brief: the shop needs a *fast, human* reply, not an instant robot.
- **Channel mismatch is real.** 91% of contractors believe phone drives conversion; only
  69% of consumers say the phone experience met expectations. [S, same survey]

**Speed-to-lead, corrected.** The famous numbers are two different studies that got
merged and both attributed to Harvard:

- Oldroyd, McElheran, Elkington, *The Short Life of Online Sales Leads*, HBR 89(3),
  March 2011 — audited 2,241 US companies; contact within one hour ≈7× more likely to
  qualify a lead, ≈60× vs waiting 24h+. Typical first response: **42 hours** (the
  widely-quoted "47 hours" is a transcription error). [R]
- The "5 minutes vs 30 minutes" multipliers (100× contact odds, 21× qualification odds)
  come from Oldroyd's earlier 2007 MIT/InsideSales Lead Response Management study.
  **That study did not measure close rates at all** — any claim tying the 5-minute
  number to *sales* is an extrapolation.
- "78% buy from whoever responds first" and "35–50% of sales go to the first responder"
  are **[F]** — no traceable primary source.
- No independent academic replication 2023–2026 exists. The field is vendor content
  repeating 19-year-old numbers.
- **No auto-repair-specific speed-to-lead data exists.** What circulates is car-dealer
  *sales* data (a different business) misapplied.

The repo already has the right machinery: `lib/marketing/core/crm-sweep.ts slaAlerts`
with owner-then-backup escalation, and a Speed-to-lead report. What it lacks is a
stated public promise. Given the Moneypenny expectation data, a visible "we reply
within the hour, 8–6 Mon–Fri" is both achievable and better calibrated than an
implied-instant AI receptionist. **[I]**

---

## 3. The no-reviews cold start

This is the central constraint and the place where the site is furthest from what the
evidence supports.

### 3.1 What has actually changed about reviews

BrightLocal's Local Consumer Review Survey 2025 (n=1,026 US adults) reports a collapse
worth building around: **only 42% now trust online reviews as much as a personal
recommendation, down from 79% in 2020**. Consumers are also measurably more willing to
use a business with few reviews than they were in 2024. And what makes a review
credible has shifted from positivity (64%, down 16pp YoY) toward **detail, length and
photos**. [S]

Read together: specificity beats volume, and the gap a new shop has to close is
smaller than it was five years ago. The counter-fact is still real — roughly half of
consumers won't use a business under ~20 reviews (secondary, not re-verified against
BrightLocal's tables) — but the mechanism to close it is not "get reviews faster", it
is "be specific about things nobody else is specific about".

### 3.2 Trust substitutes, ranked by evidence

| # | Signal | Evidence | In this repo |
|---|---|---|---|
| 1 | **Published price ranges / labour rate** | **[R]** Mohan/Buell/John 2020, +21.1% purchase likelihood, voluntary-only. Targets AAA's #1 and #2 distrust drivers. | Absent. Only `partsFrom`. See §0.2 |
| 2 | **Real process photos + named, photographed technicians** | **[R]** NN/g/Stanford credibility testing: for service businesses users asked specifically for *process* photos and photos of the actual team, not finished-job shots. Design quality is judged in seconds and outweighs on-site testimonials. | Absent. No `/about`, no team page. `docs/IMAGERY.md` correctly forbids passing generated art off as documentary — so this needs 7 real photos used honestly, not more art |
| 3 | **Verifiable third-party credentials — ASE, CARB EO numbers** | **[S]** ASE-commissioned survey (~1,500 owners, 2022): 41% said ASE factored into shop choice; of those unaware, 77% said knowing would influence future choice. CARB EOs are independently checkable by anyone. | `sku_compliance` table exists (CARB EO / SEMA / not verified). Nothing public displays an EO number on a product page |
| 4 | **Written estimate before work + "we'll tell you no"** | **[I]** No dedicated study. But it directly counters the two largest measured distrust drivers, so the mechanism is well-evidenced even though the tactic isn't independently tested | Partly: `/fitment` genuinely says no for unsupported engines — the best trust artifact on the site. Estimates live in `/portal`, invisible to a stranger |
| 5 | **A true, minor, honestly-placed limitation** | **[R]** Ein-Gar, Shiv & Tormala, *When Blemishing Leads to Blossoming*, JCR 38(5), 2012. Conditional: works when the negative is processed **effortlessly** and **follows** the positive, not precedes it | The "no off-road tier" position and the emissions notes are exactly this, correctly placed |
| 6 | BBB / licensing / insurance badges; response-time promise; video | **[I]** plausible, cheap, zero-risk, no measured lift found | Absent |
| 7 | FAQ / process documentation | **[I]** weakest evidence of anything researched; consistent with the general transparency literature but no study isolates its effect | `/faq` exists and currently renders *"Answers are being written now."* |

Two things fall out of this table. First, the three best-evidenced substitutes —
price, real people, verifiable credentials — are all **absent from the public site**,
while the weakest (FAQ) is built and empty. Second, `/fitment`'s "Not one of ours"
answer is, by the Ein-Gar/Shiv/Tormala mechanism, a genuine asset, and it is currently
buried on a `noindex` page behind four dropdowns.

### 3.3 The legal floor

Already correct in `marketing-features.md` C6, restated with the exact figures:

- **16 CFR Part 465** (Consumer Reviews and Testimonials Rule), announced 14 Aug 2024,
  **effective 21 Oct 2024**. Bans fake/AI-generated reviews, insider reviews without
  disclosure, company-run "independent" review sites, review suppression and gating,
  and bought engagement. Penalty up to **$51,744/violation**, inflation-adjusted to
  **$53,088** effective 17 Jan 2025.
- **FTC Endorsement Guides**, revised 29 Jun 2023 — disclosures must be unavoidable and
  format-matched. These are interpretive guidance; Part 465 is the rule with the
  dollar penalty.
- **Google** bans review gating (selective solicitation by expected sentiment) and any
  incentive for a review.
- The Endorsement Guides also reach **referral programmes**: a material incentive paid
  for a referral must be clearly and conspicuously disclosed — including to the person
  being referred. `/refer/[code]` currently shows "New customers only. One per
  customer." but does not say the referrer is being paid. **Fix that.**

### 3.4 What NOT to do

**Do not build a "review gap filler."** Not a "coming soon — 5 stars from our Instagram
followers" strip, not an aggregate of DM screenshots, not an "as trusted by" logo wall
of parts brands the shop merely resells. Each of these is a fabricated-authority
signal and at least the first two are squarely inside Part 465. `ReviewStrip` already
handles this correctly — it renders `null` when there are no real reviews. Keep that
behaviour and copy it everywhere.

---

## 4. Parts fitment UX

### 4.1 The Baymard finding — verified, and the framing needs correcting

The prior research summary said Baymard "found no automotive parts site scores 'good'
at helping users choose between parts that fit." **The study is real; the framing is
subtly wrong, and the correction changes what to build.**

Baymard Institute, *Automotive Parts & Specialty UX Benchmark 2026*,
https://baymard.com/blog/automotive-parts-ux-benchmark-2026, **published 6 January
2026**. Ten sites (Advance Auto Parts, CarParts.com, J&P Cycles, RevZilla, Tire Rack,
ECS Tuning, AUTODOC, Inter Cars, Pep Boys, Demon Tweeks), rated against 390–500+
guidelines, 5,000+ weighted scores. Verified quote: **"No sites delivered a 'good' or
better overall user experience"** — 6 "decent", 4 "mediocre".

But their actual diagnosis is narrower and more useful:

> "the industry successfully enabled users to find compatible products but struggled
> to fully support confident, project-driven decision-making once compatibility was
> established"

and

> "product lists and detail pages frequently fell short in helping users confidently
> evaluate differences between alternatives through clear specs, physical context, and
> comparative cues."

Baymard explicitly rates **vehicle-based product finders as a strength** across the
industry. So:

**The gap is not "will it fit". The gap is "which of these three that fit should I
buy".**

That matters here because the v4 design's headline bet — the picker as hero — is a bet
on the half the industry already does adequately. The half that is genuinely open is
the one `lib/store/specs.ts` and `/store/compare` were built for, and those are
currently the least prominent things on the site.

To be fair to the current design: `lib/fitment/use-cases.ts` (Stock & Sorted / Tow
Tuned / Built for Boost) *is* a decision layer, and its comment says so explicitly.
It is the right instinct. It operates at the service tier, not at the part level, which
is where Baymard's gap actually sits.

### 4.2 Supporting research

- **Compatibility filters roughly double success.** Baymard, *6 Use Cases for
  Compatibility Databases* (6 Oct 2015): sites with them showed "almost twice as high"
  success rates. Test subject: *"When they say 'Recommended for you,' I assume they
  will fit."* **[R]**
- **Users re-verify compulsively**, even when confident, before adding to cart;
  incomplete compatibility info drives off-site research or abandonment. **[R]**
- **False negatives are real.** Baymard found users discarding products they wrongly
  believed incompatible *even when the page said they were compatible*. A labelling
  failure, not a data failure. **[R]**
- **Returns:** auto parts return at **19.4%**, highest in retail — **NRF's** figure via
  MOTOR Magazine (Nov 2023). Don't attribute it to the Auto Care Association Factbook.
  The circulating "~65% of returns are wrong-fit" is one consultancy blog with no
  sources — **[V]**, don't repeat it as industry data.
- **No automotive cart-abandonment-due-to-fit statistic exists publicly.** What
  circulates is apparel fit-uncertainty data by analogy. Don't launder it.
- **No named-site teardowns exist** for RockAuto, Summit, AutoZone or Amazon — only
  forum and complaint anecdote. The one recurring pattern worth noting is coarse-grained
  matching: YMM matches but engine variant, trim, production date or connector doesn't,
  and the site shows a green "fits" with no caveat. **[I]** That false positive is the
  failure mode `fitsTruck` most needs to avoid.
- **NN/g on incompatible states:** prevent the wrong selection rather than allowing it
  then scolding — suppress incompatible options rather than flagging "won't fit" after.

### 4.3 What this repo gets right

- Year → make → model → engine as four `<form method="get">` steps, each a real URL,
  working with JS off (`components/v4/FitmentPicker.tsx`). This is better than the
  named industry sites.
- Cascading state hygiene: changing the year drops model and engine
  (`Step`'s `keep`/`carried` logic) so a stale link degrades to the nearest valid
  state rather than erroring (`parseFitment`).
- Deliberately carrying gas engines and half-tons in `lib/vehicles/*` so the picker
  can genuinely say no.
- `noindex` on `/fitment` with `canonical` to the platform page — avoids thousands of
  near-duplicate parameterised pages while keeping every combination shareable.
- Fit verdict rendered **server-side from the cookie** (`components/store/FitBadge.tsx`,
  `FitmentCheck.tsx`), so it is correct before hydration and correct without JS.
- Listing defaults to only-what-fits with an explicit "Show all parts" escape
  (`components/store/listing.ts listingTruckFilter`, `TruckBar`).
- `lib/store/specs.ts` gives every comparison row a `meaning` in plain language, and
  refuses to present a manufacturer's power figure as the shop's own. This is exactly
  the Baymard 2026 gap, correctly identified.

### 4.4 What to fix

**(a) The amber "Check fitment" state is a maybe with no way out.**
`lib/store/normalize.ts fitsTruck` returns `'platform'` — rendered as amber "Check
fitment — pick your generation or call us" — whenever the product carries no
generation collection for that platform. That is a data-coverage artefact, not a fact
about the part, and the only exit offered is a phone call. Every amber badge is a
conversion the catalogue's tagging lost.

**Do:** add a `fitment` pin per SKU in the admin so the owner can resolve amber to
green or red. `ProductOverride` (`lib/site-content/registry/products.ts:47`) *already
has* a `fitment: readonly string[]` field that `applyOverrides` merges into
`generationCollections` — the capability exists and is unused. Add an admin count of
"parts currently showing Check fitment" so the owner can work the list down.

**(b) Comparison specs are regex-scraped and will be sparse.**
`sizeOf()` matches `%over` / `mm` from the product *title*; `supportedPowerOf()`
matches "supports up to N hp" from the description. Where Shopify copy doesn't happen
to phrase it that way, the row is blank — and a comparison table of blanks is worse
than no table, because it reads as "we don't know."

**Do:** add `specs: Record<string, string>` to `ProductOverride` so the owner can type
the three-to-five decision specs per category (turbo: compressor inducer, supported hp,
drop-in vs kit, wastegate type; injectors: % over, supported hp, core required).
Fall back to the scraper. This is the highest-value fitment work available, and it maps
directly onto the verified Baymard 2026 gap.

**(c) The picker has no VIN and no "not sure".** See §0.1. Note the known limitation:
not all VINs uniquely encode trim, so VIN decode can still under-specify — the UI
should present a decode as a pre-fill to confirm, not a fact.

**(d) The unsupported answer wastes the best trust moment on the site.**
`app/(site)/fitment/page.tsx` handles `!result.supported` with "Not one of ours… we
would rather say so than take the booking" and two CTAs: "Text us anyway" and "Browse
the store". NN/g's zero-results guidance is that a dead end is the highest-abandonment
state there is. Every gas Silverado, every half-ton, every Ecodiesel path in
`lib/vehicles/*` lands here.

**Do:** (i) record the miss server-side with the engine id — "which trucks arrive that
we can't help" is a product question the owner will want answered; (ii) offer one
honest onward step. Not a fake capability. Either a named local shop that does do it,
or a single-field "tell me if you ever work on these" that is explicitly not a sales
list. This is the one place on the site where asking for an email with nothing to sell
is entirely honest.

**(e) Sorting has no fit-relevant dimension.** `components/store/listing.ts SORTS` is
featured / price-asc / price-desc. Once spec overrides exist, add "supported hp" as a
sort. Baymard's gap again.

---

## 5. Quote and booking flows

### 5.1 What the form-length research actually says

The famous numbers, traced:

- **"11 → 4 fields, +120%"** is a real case study — Imaginary Landscape (ImageScape),
  ~2010–11, on their own contact form: +160% submissions, +120% conversion rate.
  **n=1, self-reported, no significance test, 15 years old.** Not a law. **[V]**
- **"3 fields is optimal"** traces to Dan Zarrella's HubSpot analysis of 40,000+ landing
  pages. Its actual finding differs from the chart everyone reproduces: **field type
  matters more than field count** — multi-line textareas and dropdowns have "a powerful
  depressing effect"; single-line fields barely move conversion. **[V, real dataset]**
- **Zuko Analytics** (93M+ form sessions, 17 verticals, 2025) contradicts the folklore
  outright: **"number of form fields is not necessarily correlated with completion
  rate."** What predicts abandonment is *perceived* effort in the first ~60 seconds —
  long forms are abandoned around the 50-second mark, i.e. people size the form up and
  leave **before typing**. Desktop 55.5% vs mobile 47.5% completion. **[R]**
- **Baymard** (25 rounds, 4,400+ sessions, 344 sites): 70.19–70.22% average cart
  abandonment across ~50 studies / 14 years. Per-field data is paywalled — **any blog
  quoting "Baymard says field X causes Y% drop-off" without a Premium link is inventing
  it.** **[R]**
- **[F] — do not use:** "each extra field = −4.1% (HubSpot 2024)", "Forrester 2024: 3–5
  fields optimal", "MarketingSherpa 2024: >5 fields = −30%". No published report.
- **No credible source ranks "phone number" as a top abandonment field.** CRO-blogger
  inference, not a measurement.

**Multi-step vs single-step:** **no independent controlled study** shows multi-step
wins. Every specific percentage (Venture Harbour +743%/+300%, Formstack 13.9% vs 4.5%,
"HubSpot +86%") traces to a company selling multi-step form software, a single
uncontrolled client case, or nothing. Zuko's non-vendor position is the credible one:
**multi-step helps only when the form is long enough that splitting it reduces perceived
effort.** For a 4–8 field form, extra steps add friction without reducing complexity.

### 5.2 Against the current forms

**`components/quote/QuoteForm.tsx`** — 10 inputs: name, phone, email, platform (radio),
generation (select), mileage, service (select), VIN (+lookup button), heardAbout
(select), details (**required** textarea, 4 rows). Plus SMS consent.

Applying Zarrella and Zuko rather than the folklore: the count isn't the problem — the
*composition* is. Three selects and a required multi-line textarea are precisely the
three field types both real datasets flag as high-friction, and the visitor sizes the
form up before typing a character. The required `details` textarea is the single worst
field on the page: it demands the visitor articulate a diagnosis they came here
because they don't have.

**Do:**
- Make `details` **optional**. The service select plus the truck already carries enough
  for a callback. (`lib/lead.ts parseLead` will need the matching change.)
- Kill or defer `heardAbout`. It serves the shop, not the visitor, and it is a dropdown
  — the worst field type — placed before the free-text field. `attribution_touches`
  already captures UTMs and referrer server-side; the self-reported field is a nice-to-
  have that costs a decision at the worst moment. Move it to the confirmation screen.
- Pre-fill and collapse platform/generation from the truck cookie (§0.1).
- Keep the VIN field — it's optional and genuinely reduces work.

**`components/booking/BookingForm.tsx`** — four numbered fieldsets in one page:
1. Pick a day · 2. Pick a time · 3. Your truck & the work · 4. Your info.

Two structural problems:

**Order.** It asks for a *calendar slot* before it knows whether the job is a two-hour
diagnostic or a three-week turbo build. For the "Built for Boost" tier — the $15k
customer — a time slot is meaningless and asking for one first signals the shop hasn't
understood the job. **Do:** branch. Keep slot-first for `sorted`/`maintenance`/
`diagnostics`; for `tow`/`boost`, route to the quote flow and book after the estimate.
`lib/fitment/use-cases.ts` already knows which is which.

**JS dependency.** `BookingForm` is `'use client'`, uses `useActionState`, and fetches
slots from `/api/slots` in a `useEffect` with no `<noscript>` path. The picker was
built around GET forms specifically so it works with JS off; `/book` abandons that
principle at the most valuable page. On a bad signal in a shop yard, a client-side
slot fetch that never resolves shows *"Checking the schedule…"* forever. **Do:** at
minimum, render the first open day's slots server-side so the form is submittable
without the fetch, and degrade to "pick a day, we'll confirm the time" on failure.

### 5.3 Partial capture — built, tested, and wired to nothing

`app/api/lead/partial/route.ts` and `lib/marketing/engage/partial.ts` exist, validate a
step-1 payload, carry a dedicated consent version (`REMIND_CONSENT_VERSION =
'2026-09-17-quote-reminder'`) and a consent string, and feed `runPartialFollowUps` in
the marketing cron. **Nothing in `app/` or `components/` calls the endpoint.** A grep
for `api/lead/partial` across the whole app returns only the route file itself.
`marketing-coverage.md` lists this as "Built" — see §11.

**Do:** call it from `QuoteForm` on blur of the email field once name/phone/email are
valid, with a per-session `sessionKey`. Low effort, the hard part is done.

**Consent, carefully.** A follow-up *email* to someone who typed their email into a
form and ticked the reminder box is straightforward. A follow-up **SMS** is not: a bare
phone-number field is not prior express written consent under TCPA, and statutory
damages are $500–$1,500 per message. The existing unticked SMS-consent checkbox with
CTIA language is the right pattern. Keep abandonment follow-up **email-only** unless
the SMS box was ticked. Counsel should confirm the phrasing, as `marketing-features.md`
already flags.

### 5.4 Phone vs form vs text

- **Phone leads.** YouGov (rolling US panel, weighted): phone 35%, email 23%, live chat
  10%, in-person 8%, **website forms 5%**, chatbot 1%. Clean age gradient on phone
  preference: Boomers 52%, Gen X 39%, Millennials 30%, Gen Z 25%. **[R]** Leadferno
  (1,000 consumers, 2021) independently reproduces it: 25–34 splits phone 26.5% / text
  23.7% / web form 20.6%; 55+ is phone 58.5%. **[V, methodology disclosed]** The "auto
  centers specifically prefer phone" claim attributed to Leadferno **could not be
  verified** against their article — don't repeat it.
- BIA/Kelsey click-to-call data is **2014–2016** with no newer refresh; Think with
  Google's "88% of local mobile searches call or visit within 24 hours" and "900% growth
  in near-me searches" are genuine but ~8–10 years old and recirculated as current.
  Treat all as historical.
- **Texting:** Pew is the only fully independent anchor — ~72% of US adults text, ~97%
  weekly, **33% prefer text over all other channels**. EZ Texting (n=1,074, 2025,
  disclosed methodology): 79% opted into at least one business SMS list, **71% want the
  ability to text a business back (+18pp YoY)**. The ubiquitous "83% reply within 30
  minutes" is **Zipwhip 2020** — six years old, always quoted undated.

**Implication:** phone-first, form-second, text-third is supported by two independent
surveys, and `MobileActionBar` (Call / Text / Book) already reflects it. The gap is
measurement (§0.3), not placement.

### 5.5 Instant estimates

**No controlled study** compares an instant price-range tool against "we'll get back to
you" for this price band. The directional case is stitched from adjacent findings —
speed-to-lead decay, Cox's 72%-want-online-estimates, preference for certainty. Any
specific lift percentage claimed for quoting tools is vendor marketing.

The `priceRangeFor` hint in `QuoteForm` ("Most of these start around X. We confirm after
we see the truck") is the right shape — honest range, explicit "we confirm". It depends
on the owner filling `site_engagement.price_ranges`, so it renders nothing today. Same
blocker as §0.2; same fix unblocks both.

---

## 6. Mobile reality

Audience assumption: phone, often in a shop or yard, sometimes gloved or with dirty
hands, sometimes on poor signal, sometimes in direct Charleston sun.

### 6.1 Targets

- **WCAG 2.2 SC 2.5.8 Target Size (Minimum), AA: ≥24×24 CSS px.** SC 2.5.5 (Enhanced),
  **AAA: ≥44×44**. Apple HIG: 44×44 pt hit area. Material: 48×48 dp, ≥8 dp spacing.
- **For gloved or dirty hands, design to the AAA 44–48px number, not the AA floor, and
  avoid anything needing precision: no drag sliders, no tiny close icons, no multi-point
  gestures. [I]** Capacitive touch senses body-conductive current; insulating glove
  material blocks it and accuracy degrades with thickness. No controlled study quantifies
  the mis-tap rate — the mechanism is documented, the number is not.
- **Thumb reach:** Hoober's field observation of >1,300 people (UXmatters, Feb 2013) is
  still canonical: **49% one-handed, 36% cradled, 15% two-handed**. Bottom-centre easy,
  top corners hardest. The companion "~75% of touches are thumb touches" traces to no
  primary source — **[F]**.

**Current state is largely fine.** `inputClass` is `h-13` (52px); `.v4-field` and the
`MobileActionBar` items are 48px; slot buttons `h-11` (44px); picker selects `min-h-12`
(48px). Two exceptions: the `X` dismiss buttons on `ResumeCard` and `SocialProofToast`
are `size-7` (28px) — above the AA floor, below AAA — in the top-right corner of a card
pinned to the bottom of the screen, the hardest spot to reach one-handed. Worse, both
cards pin `left-3` at `bottom-[calc(5rem+safe-area)]`, directly above `MobileActionBar`,
competing with the primary CTA for the best real estate on the screen. See §8.

### 6.2 Forms on a phone

- `type` + `inputmode` + `autocomplete` are three different things and should always be
  set together — validation semantics, keyboard choice, autofill respectively.
  `QuoteForm` does this correctly on phone/email; `BookingForm`'s phone/email fields have
  `type` and `autoComplete` but no `inputMode` — a one-line fix.
- **Date pickers:** NN/g finds scrolling/wheel pickers slow, with small targets and
  inconsistent screen-reader support; for bounded near-term dates a short button list
  beats a calendar widget. **`BookingForm`'s horizontal strip of 12 day buttons is the
  correct pattern** — worth saying, because "improving" it into a calendar later would be
  a regression.
- **Contrast:** WCAG's 4.5:1 / 3:1 minimums are indoor numbers. Direct sunlight raises
  both black and white luminance and collapses *effective* contrast; the web-side lever
  is to design above AA (7:1 body, no thin weights, no low-contrast greys). The v4
  palette uses `text-steel` for a lot of body copy on `bg-carbon` — **measure it**.

### 6.3 Payload and signal

- Core Web Vitals, 75th percentile of real loads: **LCP ≤2.5s, INP ≤200ms, CLS ≤0.1**
  (web.dev/articles/vitals; INP replaced FID March 2024).
- **"53% of mobile visits abandoned above 3s"** is real — Think with Google /
  DoubleClick, *The Need for Mobile Speed*, >10,000 mobile domains. It is a 2016 study,
  so quote it with its date.
- **The best evidence tying speed to *lead* conversion:** Google + 55 + Deloitte,
  *Milliseconds Make Millions* (2020) — 37 brand sites, 30M+ sessions, hourly mobile
  monitoring over 30 days. Per **0.1s** LCP improvement: lead-gen sites saw **+21.6%
  form-submission rate** and +5.5% homepage→form-step-1 progression. Retail +8.4%
  conversion. (web.dev/case-studies/milliseconds-make-millions) **[R]** This is the
  number to cite for this site, not the retail ones.
- 3G ≈ 1.6 Mbps / 300 ms latency. A single unoptimised large image is the most common
  LCP failure.

**Two concrete payload issues in this repo:**

1. **v4 fonts are deliberately not preloaded.** `components/v4/fonts.ts` sets
   `preload: false` on both Saira families so visitors on the other three designs don't
   fetch them. That trade-off is correct *only while four designs coexist*. The v4 hero
   headline is stated to be the largest paint — so the LCP element depends on a font
   discovered late from CSS, with `display: swap` producing a FOUT and a reflow on
   exactly the element being measured. **At go-live there will be one design.** Delete
   `components/v2/**`, `components/v3/**`, the legacy `components/sections/**`, the
   `/design/[variant]` route and the `DesignToggle`, then preload the single display
   weight. Given the Deloitte per-0.1s figure, this is not cosmetic.
2. **CSS.** `app/globals.css` is 43.9 KB of source carrying four design systems. The
   user's own budget is <30 KB CSS gzipped for a landing page. There is no production
   build in the tree to measure against, so **measure the built, gzipped CSS before and
   after deleting v2/v3** rather than trusting either number.

---

## 7. Engagement and retention loops — keep, cut, defer

### 7.1 Worth building

**Job-status / build-progress updates — the best-evidenced loop here, by a distance.**
The anchor is not parcel tracking, it is Ryan Buell's operational-transparency research
at HBS: *The Labor Illusion* (Buell & Norton, Management Science 2011) shows customers
often prefer a visible-effort process *with a wait* over an instant opaque result;
*Creating Reciprocal Value Through Operational Transparency* (Buell, Kim & Tsay,
Management Science 2015) produced a **22.2% increase in customer-reported quality** and
**~19.2% reduction in throughput time** in field and lab experiments. **[R]**

**[I]** applied: a visible job-status timeline (quote → scheduled → parts ordered → in
progress → complete) should raise perceived quality *independently of actual speed*.
For a shop with no reviews this is the closest thing to manufacturing trust honestly —
a real record of real work, shown as it happens. `/portal/jobs` and the status-change
automation already exist. **This is the retention loop to invest in.**

The corollary is public. `ProcessV4` ("Pick your truck / Tell us the goal / Get it in
writing") is a *promise* of process; Buell says the value is in *visible* process. A
public, non-identifying version — what the first 48 hours looks like, with the actual
checklist — converts a promise into a transparency artifact for ~nothing. **[I]**

**Service reminders.** Honest data point: AAA (2024), **54% of drivers do not follow
their recommended maintenance schedule** — the need is real. Every number about reminder
*lift* (no-shows 20–25%→8–12%, 15–30% of repeat bookings recovered) is **[V]**,
self-reported by SMS vendors. Build it; don't forecast with those numbers.

**Referral.** The credible finding is the **intention–action gap**: ~83% of satisfied
customers say they'd refer, ~29% do (widely repeated; primary source not independently
verified — **[I/unverified]**). The gap is the *ask and mechanism*, not the incentive
size — so `/refer/[code]`'s one-tap claim link is the right design and the discount size
is not the lever. Keep it **single-tier** (never reward a referrer for their referral's
referrals — that reads as MLM) and disclose the incentive to the referred party (§3.3).

**Back-in-stock alerts.** Already built (`/api/marketing/stock-alert` + cron). Cheap,
consented, useful for $3k injector sets. Published conversion numbers (5.34% to 35%) are
**[V]** and measured inconsistently — the width of the range is the tell.

### 7.2 Worth cutting or deferring

- **Exit-intent popups and scroll/time popups** (`hooks.ts useExitIntent`,
  `OfferDialog`, `PopupDialog`). On a site whose credibility problem is "are these
  people serious", an interstitial that fires on scroll is a cost against the NN/g
  design-quality credibility factor, for an offer the shop currently doesn't have. Ship
  the demo with all popups off and let the owner turn them on later.
- **A/B testing** (`ab_tests`, `assignSlot`). The machinery is fine; using it at this
  traffic level is not. See §9.3 — a test at this volume needs six months to two years.
  Leave it built and dormant.
- **AI voice receptionist.** The Moneypenny data says only 17% of consumers expect a
  near-instant response and 41% are satisfied by "within minutes" — while 69% already
  say the phone experience under-delivers. An AI answering a $12k build enquiry is a
  bad first impression solving a problem the data says isn't the binding constraint.
  Missed-call-text-back (already built) covers the real failure case.

### 7.3 Email vs SMS discipline

SMS engagement is far higher than email (open rates 90–98% vs ~40%, reply ~45% vs ~6%
— all **[V]**, consistent across independent vendors) but has a much lower frequency
tolerance: "good" opt-out is 0–1.5% per send, and 61% of people who opt out cite
message volume. **[V]**

**Rule to adopt:** SMS for transactional and status messages (booking confirmations,
job status, estimate ready, missed-call text-back). Email for anything periodic
(seasonal offers, newsletters, digests). This matches CTIA's own carrier guidance and
protects the 10DLC campaign.

### 7.4 SMS compliance — the blocker, stated precisely

`marketing-features.md` C3/C4/C5 already cover this. Corrections and additions:

- **A2P 10DLC:** two-part registration through The Campaign Registry via Twilio — brand
  (legal name, **EIN**, address, vertical) then campaign (use case, sample messages,
  opt-in flow description). A brand may hold up to 5 campaigns.
  (twilio.com/docs/messaging/compliance/a2p-10dlc)
- **Timeline, current:** brand 1–3 business days; standard vetting 2–7; **campaign
  review currently 10–15 business days** per Twilio's own guidance, up from older
  estimates. **Plan 1–3 weeks end to end.** The "1–2 weeks" in `DISCOVERY.md` is
  optimistic at the low end.
- **One-to-one consent is dead.** The FCC's Dec-2023 rule was **vacated** by the 11th
  Circuit in *Insurance Marketing Coalition Ltd. v. FCC*, No. 24-10277, decided
  **24 Jan 2025**; the FCC formally reinstated the prior express written consent
  standard by final rule on **29 Aug 2025**. Do not design the consent flow assuming
  one-to-one is required. (`marketing-features.md` C4 has this right.)
- **Revocation:** in force since **11 Apr 2025** — opt-out by any reasonable means,
  honoured within **10 business days**, with a mandatory keyword list (stop, quit,
  revoke, opt out, cancel, unsubscribe, end). The FCC's one-year waiver covering
  *non-keyword* channels (voicemail, email, verbal to an agent) ran to **11 Apr 2026**
  and **has now lapsed**. So the consent ledger must accept a revocation arriving by
  phone, email or web form, not only by SMS keyword. Worth checking
  `lib/marketing/core/consent.ts` handles inbound-email and web-form revocation, not
  just `handleInboundSms`.
- **Quiet hours:** federal floor 8am–9pm recipient-local. SC's Telephone Privacy
  Protection Act covers texts to SC residents/area codes with the same window plus a
  business-name requirement and an in-house DNC list. **CTIA's Messaging Principles
  (May 2023) recommend a tighter ~8am–8pm** because carriers filter traffic that looks
  like it ignores quiet hours — carrier policy, stricter than the law. The shop default
  of 9am–8pm in `DISCOVERY.md` is correct.

---

## 8. Already built, and a bad idea

### 8.1 `BoardV4` — a dyno leaderboard for a shop with no dyno results

`components/v4/home/BoardV4.tsx` renders the top five builds by horsepower gain, with
the gain set as "the biggest thing on the row, because it is the only number a customer
actually cares about", animated counting up. Sample rows carry an "Example" chip.

`HeroV4` gets this right: it re-derives its proof stats from `stats.builds.filter(b =>
!b.isSample)` precisely because the aggregate stat had leaked sample data before. But
`BoardV4` does the opposite — it **ranks samples against each other** and animates
their numbers. A ranked leaderboard is a claim about competition and history. A small
"Example" chip next to a 5xl green "+240 hp" that counts up on scroll does not survive
contact with a scrolling reader, and it will not survive the owner showing this to a
friend. The whole section asserts a track record the business does not have yet.

**Do:** render `BoardV4` only when there is at least one non-sample build with a real
gain — the `ReviewStrip` pattern (`return fallback` when empty). Until then, that slot
should hold something true: the process, the pricing, or the platforms. Losing the
section is not a loss; a dyno board with three fake rows is worse than no dyno board.

### 8.2 `SocialProofToast` — a sample-data leak waiting to happen

`lib/marketing/engage/data.ts countSocialProof` counts `dyno_runs` and `work_orders`
completed in the last seven days and produces "7 trucks finished in our shop this
week". Twelve tables in `lib/db/database.types.ts` carry an `is_sample` column;
**`work_orders` and `dyno_runs` are not among them.** `scripts/seed-demo.mjs` writes
work orders with `completed_at` as recent as `now - 2 * HOUR`.

So the moment the owner ticks `social_proof` in admin on the seeded demo, a floating
toast on the public homepage asserts a week of shop volume that is entirely seed data.
The threshold guard only prevents the message when counts are *low* — seeding makes
them high. This is the same bug class as the headline-stat leak this project already
caught and fixed, in a component that has no equivalent guard.

**Do:** either add `is_sample` to `work_orders`/`dyno_runs` and filter, or gate
`countSocialProof` on `DEMO_MODE` being off. Second option is one line. Do it before
the pitch.

**Separately — is the toast a good idea at all?** It is a floating interstitial that
appears after 12 seconds, bottom-left, above the primary mobile CTA, and it competes
with `ResumeCard` for the same pixels. It borrows the visual grammar of the fake
"someone in Ohio just bought" widgets, which is precisely the grammar a shop
differentiating on honesty should avoid. **[I]** — recommend cutting it. The same
truth ("we finished seven trucks last week") is stronger stated in body copy where it
can be attributed, than floated over the page where it reads as a growth-hack.

### 8.3 `ResumeCard` and `SocialProofToast` occupy the thumb zone

Both pin to `bottom-[calc(5rem + safe-area)] left-3` on mobile — directly on top of the
`MobileActionBar`, in the easiest-to-reach region of the screen per Hoober. Two
dismissible cards fighting the Call/Text/Book bar for the best real estate is a net
loss. Keep at most one, and prefer the action bar.

### 8.4 `/faq` ships empty

`app/(site)/faq/page.tsx` renders *"Answers are being written now."* It is correctly
`noindex` when empty, so this is an honesty-preserving fallback rather than a bug — but
per §3.2 the FAQ is the *weakest*-evidenced trust signal and it is the one that is
built. Fill it or hide the nav entry; an empty page linked from the header reads as
abandonment.

### 8.5 `shop-card.jpg`

`app/(site)/page.tsx` uses `/images/shop-card.jpg` as the home OG image. It predates
`docs/IMAGERY.md` (16 Sep vs 18 Sep). If it is a generated texture, the filename
implies a photograph of the shop in every social share preview. Worth a rename or a
swap — cheap, and consistent with the discipline `IMAGERY.md` sets.

---

## 9. Measurement

### 9.1 Events to instrument

GA4's lead-gen recommended set — these names specifically, because GA4's built-in lead
reports only populate when the event name matches:
`generate_lead`, `qualify_lead`, `working_lead`, `disqualify_lead`,
`close_convert_lead`, `close_unconvert_lead`.
(support.google.com/analytics/answer/9267735)

Ecommerce set for the store side: `view_item`, `add_to_cart`, `begin_checkout`,
`purchase`. GA4 supports both families on one property.

**Against `components/marketing-public/analytics.ts`:**

| Event | Status |
|---|---|
| `generate_lead` (mapped from `lead`) | Mapped. Fires server-side via `conversion_events` |
| `schedule` (from `booking`) | Mapped |
| `contact_call` / `contact_text` | Mapped but **only fired from `ChatPanel`** — see §0.3 |
| `fitment_start` / `_resolved` / `_unsupported` | **Missing** — the hero is uninstrumented |
| `truck_saved` | **Missing** |
| `goal_selected` (which of the three tiers) | **Missing** — this is the shop's mix question |
| `compare_submitted` | **Missing** — the Baymard-gap feature has no telemetry |
| `view_item` / `add_to_cart` / `begin_checkout` | **Missing** despite a working cart |
| `qualify_lead` / `close_convert_lead` | **Missing** — admin already knows lead outcomes; feeding them back closes the loop |

Phone calls have no native GA4 detection. Until Twilio call tracking is live, the
`tel:` tap is the only available proxy — which makes §0.3 the whole measurement story
for the dominant channel.

**GA4 "Key Events"** (renamed from Conversions, March 2024): only Key Events feed Google
Ads bidding and reporting, and Google statistically *models* some of them. Attributed
counts can be revised for up to **12 days**. At this site's volume, treat the first two
weeks of any Key Event count as provisional.
(support.google.com/analytics/answer/10710245)

### 9.2 Benchmarks — with the methodology caveat attached

Every published benchmark comes from a vendor's self-selected customer base. Stated as
orientation, never as a target:

- **WordStream/LocaliQ 2025–26 Google Ads benchmarks:** "Automotive — Repair, Services
  & Parts" **14.67% conversion rate** vs 7.52% all-industry. **This is paid-search
  landing-page conversion**, where traffic is pre-qualified by keyword intent. It
  will badly overstate what an organic or direct visitor converts at. Home services
  CPC ~$7.85, CPL ~$90.92.
- **Ruler Analytics 2026:** all-source average **5.13%**; automotive above 7.5%. Sample
  is Ruler's own attribution customers — businesses sophisticated enough to buy
  attribution software.
- **HubSpot 2026 landing pages:** ~5.89% average; top quartile ≥10–11.45%. Most useful
  single number for this brief: **mobile 2.8% vs desktop 4.8%** — the mobile penalty is
  measurable and matches Xtime's booking gap (§2).

**Honest planning range: 2–6% overall visit-to-lead**, with paid-search landing pages
potentially reaching double digits *because the traffic is pre-qualified*. Any
single-number target stated without traffic-source composition is meaningless.

### 9.3 Small-sample reality

Standard power analysis (95% significance, 80% power, 5–10% MDE) needs roughly
10,000 visitors and ~1,000 conversions **per variant**. At under 1,000 sessions/month,
a test needing 28,000 visitors takes about half a year; one needing 106,000 takes
nearly two.

**So: do not run A/B tests on this site.** The `ab_tests` machinery should stay
dormant. Instead:

1. Trend over multi-month windows, never week to week.
2. Prefer qualitative signal — recordings (Clarity is already wired behind consent),
   what people actually say on the phone, what the owner gets asked twice.
3. Treat any conversion-rate claim under a few hundred total conversions as anecdote.
4. Use before/after sequential comparison, stating openly that it conflates the change
   with seasonality and traffic mix.

**The single most valuable measurement at this stage is not a rate.** It is the raw
count of `fitment_unsupported` by engine, and the count of amber "Check fitment" badges
served. Both are absolute numbers, both are actionable at n=20, and neither needs
statistics.

### 9.4 Owner-side

- **GBP Performance** (updated ~daily): search queries, views, website clicks,
  direction requests, **phone calls** (requires the number on the profile), messages,
  bookings; split by Direct / Discovery / Branded.
  (support.google.com/business/answer/9918094) GBP phone-call counts are the closest
  thing to free call tracking before Twilio. **Blocked on the owner claiming GBP.**
- **Search Console Page indexing** — lags a few days; URL Inspection can request
  crawling of individual pages, worth doing manually for the platform pages at launch.
  (support.google.com/webmasters/answer/10264824)

---

## 10. Buildable now / blocked on owner / later

### (a) Buildable now — no external account, no owner decision

1. Read the truck cookie in `BookingForm` and `QuoteForm`; pre-fill and collapse the
   truck fields. (§0.1)
2. Add VIN entry to `FitmentPicker`, posting to `/fitment/truck`; reuse
   `/api/marketing/vin`. Present decodes as a pre-fill to confirm. (§0.1, §4.4c)
3. Auto-select the engine step when a generation has one engine. (§0.1)
4. `trackEvent` on every `tel:`/`sms:` anchor; add the fitment/goal/compare/ecommerce
   events to `SiteEvent` + `EVENT_MAP`. (§0.3, §9.1)
5. Record `fitment_unsupported` server-side with the engine id. (§4.4d)
6. Gate `SocialProofToast` on demo mode — or cut it. **Before the pitch.** (§8.2)
7. Gate `BoardV4` on at least one non-sample build with a real gain. (§8.1)
8. Make `details` optional in `QuoteForm`; move `heardAbout` to the confirmation
   screen. (§5.2)
9. Wire `QuoteForm` to `/api/lead/partial` on email blur; **email-only** follow-up.
   (§5.3)
10. Add `inputMode` to `BookingForm`'s phone and email fields. (§6.2)
11. Render the first open day's slots server-side in `/book`; degrade gracefully when
    the slot fetch fails. (§5.2)
12. Add `specs: Record<string, string>` to `ProductOverride` + admin editor; fall back
    to the `lib/store/specs.ts` scrapers. (§4.4b)
13. Surface an admin count of parts currently showing "Check fitment". (§4.4a)
14. Disclose the referrer incentive on `/refer/[code]`. (§3.3)
15. Build `/how-we-quote` and `/about` (real photos, named techs) as routes with
    empty-state guards, ready for owner content. (§0.2, §3.2)
16. Check `lib/marketing/core/consent.ts` honours non-SMS revocation channels.
    (§7.4)
17. Ship the demo with popups off. (§7.2)

### (b) Blocked on the owner

| Blocker | Unlocks |
|---|---|
| **Hourly labour rate + diagnostic fee** | The highest-evidenced change on the site (§0.2). Also fills `priceRangeFor` and the tier totals |
| **Per-tier all-in ranges** for Stock & Sorted / Tow Tuned / Built for Boost | `UseCaseTiers` gains a real number instead of "labour quoted" |
| **7 real photos, used honestly + tech names and headshots + ASE numbers** | Trust substitute #2 and #3 (§3.2). No amount of code substitutes |
| **CARB EO numbers per SKU** | Populates `sku_compliance` visibly; the only hard, third-party-checkable claim available in this trade |
| **Address + hours** | GBP, LocalBusiness schema, "we're 12 minutes from you" |
| **Google Business Profile claim/verify** | Reviews, GBP Performance phone-call counts (§9.4) |
| **LLC EIN + legal name** | A2P 10DLC brand → every SMS loop. **Plan 1–3 weeks, not 1–2** (§7.4) |
| **Shopify Admin API token** | True order data; and the fitment pins are worth more once catalogue tagging is visible |
| **Stripe** | Text-to-pay, membership |
| **FAQ answers** | `/faq` stops saying "answers are being written now" (§8.4) |
| **Counsel** | SMS terms, privacy page (still draft), emissions wording, referral disclosure |

### (c) Later

- Public build-progress page per job (Buell's operational transparency, public form) —
  after there are real jobs. (§7.1)
- "Supported hp" sort in the store, after spec overrides are populated. (§4.4e)
- Delete `components/v2/**`, `components/v3/**`, `components/sections/**`,
  `/design/[variant]`, `DesignToggle`; preload the single v4 display weight; then
  measure gzipped CSS. **Go-live task, not a demo task** — the toggle is a pitch
  asset. (§6.3)
- Twilio call tracking / dynamic number insertion, post-10DLC.
- A/B testing: not at this traffic level, possibly never. (§9.3)

---

## 11. What `marketing-coverage.md` is missing

The matrix is a genuinely useful artifact and this document does not duplicate it. But
it answers one question — *is it built?* — and the pitch turns on three others.

1. **"Built" conflates "the code exists" with "a user can reach it."**
   `/api/lead/partial` is listed as **Built**. The endpoint, the parser, the consent
   version and the cron follow-up all exist and are tested. **Nothing in the app calls
   it.** A grep for `api/lead/partial` across `app/` and `components/` returns only the
   route file. The matrix is accurate about the module and wrong about the user. The
   status column needs a fourth value between *Built* and *Gap*: **"Built, not reachable
   from any surface."** At minimum, partial capture and the M16 A/B row should carry it.

2. **Nothing is ranked by evidence.** The "Ten highest-impact items" list in
   `marketing-features.md` is sensible but unsourced. Three of the highest-leverage
   moves available — publishing a labour rate, naming and photographing technicians,
   and instrumenting the phone tap — are not features at all, so they cannot appear in
   a feature matrix, and two of them have better research behind them than most of
   what's in it.

3. **No feature is ever marked "built and should be removed."** 392 rows, 14 gaps, zero
   recommendations to delete. `SocialProofToast`, `BoardV4`'s sample rows and the
   popup stack are all listed as Built with neutral notes — including the row that
   literally reads *"Truthful social-proof toasts … Hidden below a real threshold"*,
   which is true of the threshold and false of the seed data (§8.2). A matrix that
   cannot say "this one is a liability" will keep liabilities.

4. **The three fitment surfaces aren't described as one thing.** M1 lists "Fitment
   checker" (`FitmentCheck` on the product page) as a single row. In practice there are
   four truck pickers with three different taxonomies — the YMME picker, the
   platform+generation store select, the platform radio on both forms, and the planner's
   own state — bridged by a cookie only two of them read. The matrix cannot see a seam
   that spans rows, and that seam is the site's biggest conversion leak (§0.1).

5. **No measurement of whether any of it works.** M20 lists an impressive analytics
   suite, but §9.3 says the traffic will not support the inference those reports imply,
   and §9.1 says the dominant channel is uninstrumented. The matrix counts reports; it
   doesn't ask whether they can be read.

---

## 12. References

Credibility: **P** primary/peer-reviewed · **R** reputable research/press · **V**
vendor-published, directional · **F** folklore, do not cite.

**Fitment and product UX**
- P: Baymard Institute, *Automotive Parts & Specialty UX Benchmark 2026*, 6 Jan 2026 — https://baymard.com/blog/automotive-parts-ux-benchmark-2026
- P: Baymard, automotive parts research hub — https://baymard.com/research/automotive-parts
- P: Baymard, *6 Use Cases for Compatibility Databases on E-Commerce Sites*, 6 Oct 2015 — https://baymard.com/blog/ecommerce-compatibility-databases
- P: Baymard, checkout usability research (70.19% average cart abandonment across ~50 studies) — https://baymard.com/research/checkout-usability
- P: Baymard, touch keyboard types cheat sheet — https://baymard.com/labs/touch-keyboard-types
- P: NN/g, *3 Guidelines for Search Engine "No Results" Pages* — https://www.nngroup.com/articles/search-no-results-serp/
- P: NN/g, error message guidelines (prevent incompatible states rather than scolding) — https://www.nngroup.com/articles/error-message-guidelines/
- R: MOTOR Magazine on auto parts return rates (19.4%, attributed to NRF), Nov 2023 — https://www.motor.com/2023/11/auto-parts-return-rates-rank-as-the-highest-in-retail-how-e-commerce-options-aim-to-drop-that-number/
- P: NHTSA vPIC VIN decoding API (free, no registration) — https://vpic.nhtsa.dot.gov/api/

**Trust, transparency and the cold start**
- P: Mohan, Buell & John, *Lifting the Veil: The Benefits of Cost Transparency*, Marketing Science 39(6), 2020 (working paper HBS 15-017 / SSRN 2498174) — +21.1% purchase likelihood, voluntary disclosure only
- P: Ein-Gar, Shiv & Tormala, *When Blemishing Leads to Blossoming: The Positive Effect of Negative Information*, Journal of Consumer Research 38(5), 2012, pp. 846–859 — https://academic.oup.com/jcr/article-abstract/38/5/846/1796852 (note: "Blossoming", not "Blooming")
- P: Buell & Norton, *The Labor Illusion*, Management Science, 2011 — https://pubsonline.informs.org/doi/10.1287/mnsc.1110.1376
- P: Buell, Kim & Tsay, *Creating Reciprocal Value Through Operational Transparency*, Management Science, 2015 — https://pubsonline.informs.org/doi/10.1287/mnsc.2015.2411
- R: Buell, *Operational Transparency*, HBR, Mar–Apr 2019 — https://hbr.org/2019/03/operational-transparency
- P: NN/g, *Trustworthy Design: 4 Credibility Factors* — https://www.nngroup.com/articles/trustworthy-design/
- P: Stanford Web Credibility Project (B.J. Fogg, Stanford Persuasive Tech Lab)
- R: BrightLocal, *Local Consumer Review Survey 2025* (n=1,026 US adults) — https://www.brightlocal.com/research/local-consumer-review-survey-2025/
- R: AAA auto repair survey, Dec 2016 — two-thirds of US drivers distrust repair shops; unnecessary services 76%, overcharging 73%, bad past experience 63% — newsroom.aaa.com
- R: ASE-commissioned owner survey (~1,500 respondents, 2022) — 41% factor ASE certification into shop choice; 77% of the unaware would
- **F — do not cite:** "77% of drivers distrust auto repair shops (AAA 2023)". Traced only to a syndicated marketing press release across spam PR-distribution domains. Not an AAA study. Use the verified 2016 two-thirds figure instead, with its date.

**Legal**
- P: FTC final rule banning fake reviews and testimonials (16 CFR Part 465), announced 14 Aug 2024, effective 21 Oct 2024 — https://www.ftc.gov/news-events/news/press-releases/2024/08/federal-trade-commission-announces-final-rule-banning-fake-reviews-testimonials
- P: Federal Register, 16 CFR 465 — https://www.federalregister.gov/documents/2024/08/22/2024-18519 (penalty $51,744/violation; $53,088 from 17 Jan 2025)
- P: FTC Endorsement Guides, revised 29 Jun 2023 — https://www.ftc.gov/business-guidance/advertising-marketing/endorsements-influencers-reviews
- P: *Insurance Marketing Coalition Ltd. v. FCC*, No. 24-10277 (11th Cir., 24 Jan 2025) — vacated the one-to-one consent rule — https://law.justia.com/cases/federal/appellate-courts/ca11/24-10277/24-10277-2025-01-24.html
- R: FCC final rule formally eliminating one-to-one consent, 29 Aug 2025 (Goodwin summary) — https://www.goodwinlaw.com/en/insights/blogs/2025/09/the-fcc-issues-final-rule-formally-eliminating-the-one-to-one-consent-requirement
- P: FCC consent-revocation waiver order, 7 Apr 2025 (non-keyword channels extended to 11 Apr 2026 — now lapsed) — https://docs.fcc.gov/public/attachments/DA-25-312A1.pdf
- P: CTIA Messaging Principles and Best Practices, May 2023 — https://api.ctia.org/wp-content/uploads/2023/05/230523-CTIA-Messaging-Principles-and-Best-Practices-FINAL.pdf
- P: Twilio A2P 10DLC documentation — https://www.twilio.com/docs/messaging/compliance/a2p-10dlc
- R: Twilio, current 10DLC registration requirements and review times — https://www.twilio.com/en-us/blog/new-requirements-for-a2p-10dlc-registrations

**Forms, leads and booking**
- P: Oldroyd, McElheran & Elkington, *The Short Life of Online Sales Leads*, Harvard Business Review 89(3), March 2011 — https://hbr.org/2011/03/the-short-life-of-online-sales-leads (2,241 companies; 42-hour typical first response)
- R: Oldroyd, MIT/InsideSales *Lead Response Management Study*, 2007 — source of the 5-vs-30-minute odds multipliers. Measured contact and qualification odds only, **not** close rates
- R: Zuko Analytics form benchmarking, 2025 (93M+ sessions, 17 verticals) — https://www.zuko.io/benchmarking/industry-benchmarking
- R: Zuko, single-page vs multi-step forms — https://www.zuko.io/blog/single-page-or-multi-step-form
- V: Zarrella (HubSpot), *Which Types of Form Fields Lower Landing Page Conversions?* (40,000+ landing pages) — https://blog.hubspot.com/blog/tabid/6307/bid/6746/which-types-of-form-fields-lower-landing-page-conversions.aspx
- V: Imaginary Landscape/ImageScape form case study (11→4 fields, +120%) — https://www.imagescape.com/media/filer_public/06/94/0694c7f4-8914-4598-8871-b857fbc12737/form_case_study.pdf
- R: YouGov, US customer-service channel preference — https://yougov.com/en-us/articles/51802
- S: Moneypenny / Contracting Business trades survey, 29 May 2026 (500 trade companies + 2,000 consumers)
- R: Cox Automotive Service Industry Study (dealer share 29%; 72% want online estimate approval; 45% unaware online booking existed) — accessed via secondary reporting, primary PDF not read
- V: Xtime booking conversion, desktop 24% vs mobile 14%
- R: Pew Research on US adult texting behaviour (~72% text; 33% prefer text over all channels)
- V: EZ Texting *Consumer Texting Behavior Report* 2025 (n=1,074, disclosed methodology)
- **F — do not cite:** "78% buy from whoever responds first"; "35–50% of sales go to the first responder"; "each extra field = −4.1% (HubSpot 2024)"; "Forrester 2024: 3–5 fields optimal"; "MarketingSherpa 2024: >5 fields = −30%"; "HubSpot: multi-step converts 86% better". None trace to a published report.

**Mobile and performance**
- P: W3C, WCAG 2.2 SC 2.5.8 Target Size (Minimum), AA, 24×24 — https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- P: W3C, WCAG 2.2 SC 2.5.5 Target Size (Enhanced), AAA, 44×44 — https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html
- P: Apple Human Interface Guidelines, layout (44×44 pt) — https://developer.apple.com/design/human-interface-guidelines/layout
- P: Material Design 3, structure (48×48 dp, ≥8 dp spacing) — https://m3.material.io/foundations/designing/structure
- R: Hoober, *How Do Users Really Hold Mobile Devices?*, UXmatters, Feb 2013 (n>1,300: 49% one-handed / 36% cradled / 15% two-handed) — https://www.uxmatters.com/mt/archives/2013/02/how-do-users-really-hold-mobile-devices.php
- P: NN/g, *Date-Input Form Fields: UX Design Guidelines* — https://www.nngroup.com/articles/date-input/
- P: MDN, `inputmode` — https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inputmode
- P: web.dev, Core Web Vitals thresholds — https://web.dev/articles/vitals
- P: Google / 55 / Deloitte, *Milliseconds Make Millions*, 2020 (37 sites, 30M+ sessions; +21.6% form submissions per 0.1s LCP on lead-gen) — https://web.dev/case-studies/milliseconds-make-millions
- R: Think with Google / DoubleClick, *The Need for Mobile Speed*, 2016 (53% abandon above 3s) — https://www.thinkwithgoogle.com/_qs/documents/2340/bc22e_The_Need_for_Mobile_Speed_-_FINAL_1.pdf

**Measurement**
- P: GA4 recommended events (lead-gen set) — https://support.google.com/analytics/answer/9267735
- P: GA4 Key Events and conversion modelling — https://support.google.com/analytics/answer/10710245
- P: Google Business Profile Performance metrics — https://support.google.com/business/answer/9918094
- P: Search Console Page indexing report — https://support.google.com/webmasters/answer/10264824
- V: WordStream/LocaliQ 2025 Google Ads benchmarks (auto repair 14.67% — **paid search only**) — https://www.wordstream.com/blog/2025-google-ads-benchmarks
- V: Ruler Analytics conversion rate by industry, 2026 (5.13% average, own customer base) — https://www.ruleranalytics.com/blog/insight/conversion-rate-by-industry/
- V: HubSpot landing page statistics (mobile 2.8% vs desktop 4.8%) — https://blog.hubspot.com/marketing/landing-page-stats

**Unverified / gaps in the public literature**
- No automotive-specific cart-abandonment-due-to-fit-uncertainty statistic exists. Apparel analogues circulate in its place — do not launder them.
- No rigorous published usability teardown of RockAuto, Summit Racing, AutoZone or Amazon Automotive fitment flows exists. Only forum and complaint-site anecdote.
- No auto-repair-specific speed-to-lead data exists. Circulating figures are car-dealer *sales* data misapplied.
- No study diagnoses **why** auto-repair online booking abandons. Xtime's mobile gap is consistent with form friction but the report doesn't name a cause.
- No controlled study compares an instant price-range tool against "we'll get back to you" for this price band.
- No independent academic replication of the speed-to-lead odds multipliers exists in 2023–2026.
- Baymard's per-field abandonment data and per-site automotive case studies are paywalled and were not read.
- Referral "83% would / 29% do" intention–action gap: widely repeated, primary source not independently verified.

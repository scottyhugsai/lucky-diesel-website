# v3 "Telemetry" — design spec (research 2026-09-17)

Condensed from the design-research pass. Evidence links are in the session transcript; key sources:
NN/g mobile navigation (hidden nav used 57% vs 86% visible), Baymard 2025 navigation benchmark, Hoober thumb zone,
Octane AI / RevenueHunt quiz & configurator conversion data (18.3% vs 7.6%), click-to-call sticky CTA case studies,
Think with Google "Milliseconds Make Millions", schedulingkit booking stats, Affirm BNPL, Flint/Wisepops exit-intent stats,
Smolik Performance dyno leaderboard (diesel precedent).

## Direction
Dark, data-forward, **asset-light**: real dyno numbers are the imagery. The Build Planner is the primary above-the-fold
conversion path. Delivered in an **app-like mobile shell**. Rejected: video/UGC-first (too little content yet —
IG 188, TikTok 294, no auto-pull), editorial/story-scroll (copy/photo heavy).

## Navigation
- Phones: **bottom tab bar, 5 items: Home · Book · Store · Plan · More**. No hamburger.
  "More" sheet holds Builds, Gallery, Services, Trucks, Reviews, Policies, Log in.
- Floating **Call / Text pill above the tab bar** (thumb zone), not a 6th tab.
- Desktop: slim top bar with the same 5 destinations + More menu, cart, Book button.
- Platform choice (Duramax/Powerstroke/Cummins) is a segmented control inside pages, not a nav item.
- No search in primary nav yet.

## Tokens
- Type: **Space Grotesk** (display/UI) + **JetBrains Mono** (every number: dyno, prices, times, specs). Google Fonts.
- Colour: carbon #0a0c0b base; chalk #eef2ef text; clover #1fbf3f numerals/primary CTA/data (≈8:1 on black);
  violet #6b2cf5 **once per screen** (Build Planner CTA) and never for small text (≈3.1:1 → large text/borders/icons only).
- Radius: 6–8px cards/buttons; **0px data readouts** (dyno chips, spec tables) so they read as instruments.
- Spacing: 4/8 scale; section padding clamp(2.5rem, 8vw, 5rem).
- Motion: transform/opacity only; numbers count up on view via rAF; instant under prefers-reduced-motion.

## Home section order (one job each)
1. Hero — who we are + pick platform in one tap; the engine-bay photo darkened, one real dyno number overlaid.
2. Platform segmented control → /duramax /powerstroke /cummins.
3. Live proof strip — 2–3 count-up stats from real `builds` data (avg HP gained, trucks, top torque).
4. Build Planner band — one sentence, one violet button (the one violet element).
5. Services — icon grid, ≤5 words each.
6. Featured builds — dyno leaderboard cards → /builds.
7. Featured parts — one real bundle / top parts → /store.
8. Reviews strip — honest placeholder until Google Business Profile exists (never fabricate).
9. Quote / contact — existing QuoteSection.
10. Footer — NAP, policies, socials.

## Engagement features
[core] sticky call/text; ≤5-tab bar; planner as first CTA; **live "next open slot"** on home & CTAs; price ranges;
LocalBusiness/FAQ schema; CWV budget; accessibility; short copy.
[strong] sticky add-to-cart on product pages; financing messaging on $2k+ parts ("as low as $X/mo" only when a
provider is connected — otherwise "Financing available — ask us" is not allowed without a provider, so show
"Ask about payment options"); dyno leaderboard/build score; exit-intent "text me my build plan" (no fake discounts);
bundles from planner output; single text-us widget; save-my-truck; recently viewed; honest capacity urgency
("2 slots open this week" from real availability).
[nice] referral prompt, SMS opt-in beyond transactional, video/UGC feed later, micro-interactions, desktop bento.

## Copy rules
Headlines ≤6 words · intro ≤20 words · body ≤40 words · buttons 1–3 words verb-first · nav labels 1 word.

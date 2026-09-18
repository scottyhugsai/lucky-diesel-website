# Visual direction research — 2026-09-18

> Research produced by a delegated agent. **Read the verification notes first** — the
> headline recommendation is not safe to act on as written.

## Orchestrator verification notes

Claims I checked myself before filing this:

| Claim | Verdict |
|---|---|
| `app/(site)/page.tsx` statically imports `HomeV2`, `HomeV3`, `HomeV4` plus the v1 sections, so every visitor's bundle carries all four designs | **TRUE** — verified at `app/(site)/page.tsx:11-13` |
| The v2/v3 CSS spans ~420 lines of `app/globals.css` | **Broadly true** — lines 202-620 hold 47 `v2` and 74 `v3` selectors plus ~180 declaration lines belonging to them |
| `texture-cast-iron.jpg` and `texture-machined-alloy.jpg` are unused | **TRUE** — independently confirmed; `texture-carbon.jpg` is also now referenced nowhere |

**Do NOT act on recommendation #1 (retire v1/v2/v3) without Scott.** The three designs are a
deliberate pitch device: the owner has not picked one, the site still **defaults to v1**, and Scott
explicitly declined making v4 the default. Deleting them would destroy the comparison the pitch is
built on. The agent did flag this under "(b) Needs the owner", but it also ranked it as the single
highest-leverage move, which reads as a green light. It is not one. The *finding* is valuable — all
four designs ship to every visitor — but the remedy is Scott's call, and the cheaper interim fix is
lazy-loading the non-active designs rather than removing them.

Two items the agent could not verify and correctly flagged rather than guessed: brake-caliper
colour-tier conventions, and the licensing basis for the Higgsfield-generated imagery in
`public/images/`. The licensing gap is worth closing before these assets appear in paid marketing.

The agent also had no Write tool, so this file was saved by the orchestrator; the report below is
its output verbatim.

---

# Top 3 highest-leverage recommendations

1. **Reclaim CSS budget by retiring v1/v2/v3 from production before adding anything new.** `app/globals.css` is one 950+-line file shared by every design; the `[data-design='v2']` and `[data-design='v3']` blocks alone span roughly 420 of those lines (`app/globals.css:202-620`), and `app/(site)/page.tsx` statically imports `HomeV2`, `HomeV3`, and `HomeV4` (plus the default v1 sections) in a single server component, so Tailwind retains every class from `components/v2/**` (11 files) and `components/v3/**` (23 files) in the shipped stylesheet regardless of which design a visitor's cookie selects. Against a 29KB/30KB gzipped budget, this is the largest single lever available and it costs nothing visually — it is pure removal. **[ORCHESTRATOR: see verification notes — this is Scott's call, not a free win.]**
2. **Spend the imagery budget you already paid for.** `docs/IMAGERY.md` lists six generated assets marked "Not used yet": `backdrop-haze-green.jpg`, `backdrop-phone-flow.jpg`, `texture-carbon-twill.jpg`, `texture-cast-iron.jpg`, `texture-machined-alloy.jpg`, `overlay-contour.jpg`. `texture-cast-iron.jpg` and `texture-machined-alloy.jpg` in particular are material tiles built for exactly the kind of card surface `ProcessV4.tsx` and `PartsV4.tsx` currently render as flat `bg-carbon-2`. Applying one of them behind the process-step cards, using the same measured-opacity method already documented, adds material variety with zero new generation cost.
3. **Get five specific phone photos from the owner, in this order, before anything else photographic.** This is the actual bottleneck (see §3). It needs the owner, but it's cheap, fast, and raises the ceiling more than any CSS change can.

# What I'd cut

- **v1/v2/v3 code paths from the production bundle** — not the ideas in them, the shipped weight of them, once v4 is confirmed as final.
- **The "Three steps" numbered-card pattern in `ProcessV4.tsx`** as currently written. Three cards, each with a big numeral and a one-line title, is structurally identical to AI-slop tell #13, "numbered sequences for process explanations". The *mechanism* is fine; what reads generic is that it's a second, decorative "01/02/03" doing the same job the picker's own `v4-step-num` circles already do one section up. Fold it into the picker's real step affordances, or rewrite the three as artifacts of the actual shop process (a phone call, a torque spec, a scheduled bay day) rather than generic SaaS-onboarding language.
- **Nothing in the colour or motion system.** Both are already more disciplined than most of the category — resist adding a second hot accent "for richness."

## 1. Colour

**Verdict: single-emerald-on-near-black is right, and the amber reservation is stronger than expected — it maps to a real pre-existing convention.**

Boost gauges and warning lights in the diesel aftermarket already use amber as the over-boost/warning colour by convention (GlowShift, AutoMeter, Prosport listings all describe amber/white backlighting reserved for peak/warning states). So `--amber: #f0a742` being reserved for emissions notices isn't invented for this site — it borrows a convention the customer already reads correctly on their own dash. Any new warm colour would collide with a meaning drivers assign before they see the website.

Would NOT recommend:
- **A second hot accent.** Wehrli (`wcfab.com`) runs red/black; LGND (`lgndsupplyco.com`) runs military green + blaze orange + midnight blue + gold. Both are multi-SKU catalogues that need colour to separate product families. Lucky Diesel is one shop with one action; a second hot colour competes with clover for the job green is doing. One signal colour is correct here, not a compromise.
- **A heat-map orange/red system.** Orange sits adjacent to the reserved amber in hue space — a designer later reaching for "a warm accent for the dyno bars" is one decision from breaking the emissions signal. If a warm colour is ever wanted for data viz, route it through the cool end instead: a desaturated steel-blue derived from the existing `--steel` tokens.

Later, unverified: brake-caliper anodizing colour-coding (red street, yellow/gold track, black OE) is a real convention for signalling product tier, but I could not re-verify hex values against a live source (search budget exhausted). Validate against real caliper photos before using.

**Metallics, cheaply:** the site already has a working material technique — the `.v4-sheen` light-sweep pseudo-element and the `.btn-go::before` skew-sheen. Transform-only, compositor-safe. Extend that mechanism rather than reaching for `background-clip: text` gradients, which read as a generic SaaS trick in 2026 and are harder to keep accessible.

## 2. Typography

**Verdict: Saira Condensed is not a category default, it's the correct choice, and the current single-superfamily system is more disciplined than a "pairing" would be.**

Saira was designed with stated motorsport heritage — 1970s racing advertising posters — and is recommended for information-heavy racing dashboards and performance metrics. Two competitor sites independently converged on it.

`components/v4/fonts.ts` pairs `Saira_Condensed` (display, 600/700/800, italic simulated via `font-style: oblique 11deg` because Saira Condensed ships no true italic cut) with plain `Saira` (body) — same foundry, same skeleton, different width axis. That's superfamily-as-system, not a serif+sans pairing. I would not add a third typeface.

**The one addition worth making, because it costs nothing:** a system monospace stack — `ui-monospace, "SF Mono", Menlo, Consolas, monospace` — for anything that functions as a *code* rather than a *word*: engine/fitment strings, part numbers, OBD/DTC codes. Monospace-for-codes is a long-standing technical-interface convention and costs **zero KB**. `.v4-num` already does the equivalent for numerals via `tabular-nums`; this extends the same logic to alphanumeric codes.

**Licence:** Saira/Saira Condensed are Google Fonts under SIL OFL 1.1 — free commercial use, self-hostable. Not re-fetched this session; spot-check rather than treat as newly verified.

## 3. Photography strategy — the central problem

Two sources fetched directly:

- **scubemarketing.com's auto-parts photography guide** gives a concrete shot order on a budget: (1) straight-on centred, (2) 45° dimensional angle, (3) close-up of part numbers/manufacturer marks, (4) fitment elements (threads, mounting points), (5) a scale reference (ruler or coin — credited with reducing returns), (6) packaging. Lighting: diffused light at 45°, white bounce cards against reflective metal, manual white balance and manual focus (auto misreads chrome/polished aluminium).
- Shopify's natural-light guide and orbitvu's spare-parts guide converge: natural window light plus a white foam-core bounce beats a cheap ring light for anything reflective — which is most of what a diesel shop has lying around.

**The five shots to take, ranked by credibility-per-shot:**

1. **A torque wrench mid-click on a real bolt on a real truck in the bay.** Hands, a real tool, a real fastener. Not a "completed build" claim — a process shot.
2. **A scan-tool or gauge screen showing a real reading** (boost, a DTC, a live PID). Instantly legible to this exact customer, costs nothing to stage, and nobody expects a screen photo to be styled.
3. **Parts on the bench, in or just out of the box**, shot in the order above. Inventory the shop already has; needs no customer truck and no completed job.
4. **The purple-piped Sierra HD engine bay, reshot properly** — level, white-balanced, 45°, with a $10 clip-on LED and a white poster board as bounce.
5. **The business-card-on-cowl shot, reshot flat with even light.** It's one of only seven images and is currently doing the job of a logo mark.

**Where generated texture stops being acceptable:** `docs/IMAGERY.md`'s rule — no vehicles, no people, no interiors, no signage, no branding — is correct and I would not move it. The moment a real bay, truck or technician needs to appear it must be a photograph, because a generated "photorealistic bay" invites exactly the reading the file exists to prevent. The five shots above are the fastest path to retiring that constraint one image at a time, not around it.

## 4. Motion

**Verdict: the current system is ahead of most 2026 criticism, not behind it.**

- MDN and CSS-Tricks both describe `view()` as correct for item-specific reveals and `scroll()` for progress bars/parallax — exactly the split in the code: `.v4-progress` uses `scroll(root block)`, the reveals use `view()`. Textbook, not improvised.
- Fast Company ("Why parallax scrolling needs to die"), NN/g ("What Parallax Lacks") and a 2026 Wazile retrospective agree that *pervasive* parallax reads as dated; *selective* scroll-triggered motion remains current. The hero's two-speed depth is the selective kind — one hero, not every section.
- On "AI slop" motion tells: `app/globals.css` explicitly **strips** the root `.btn-go` glow box-shadow in v4 and replaces it with a flat colour change. That's deliberate removal of the exact pattern that reads generic in 2026 — worth knowing so nobody "fixes" it back in.

Blunt assessment of the rest: the `.v4-pulse` breathing ring and the turbo-spool-on-hover are both fine *because* they're functional (draw the eye to the next required action; a turbo mark that spools once on hover of its own logo). The test isn't "is there motion" but "does removing it lose information."

## 5. Anti-template check

Checked against 16 named 2026 tells from `developersdigest.tech/blog/ai-design-slop-and-how-to-spot-it`.

**Passes cleanly:** Inter-as-default (uses Saira); lavender/purple gradients (none in v4; the one violet token is confined to v3 under an explicit restraint comment); dark mode as a reflex (argued on category grounds); ubiquitous gradients (v4 uses exactly one, on `.v4-panel`); coloured glows (explicitly stripped); glassmorphism (none); hard-edged `border-radius: 2px/3px` throughout instead of rounded-everything — the code comment is "a hard-edged slab, not a pill — this is a shop, not a SaaS product", and it's correct.

**Genuinely resembles a tell:**
- **Numbered sequences** (#13): `ProcessV4.tsx`'s "Three steps" cards — see "What I'd cut".
- **Stat banner rows** (#14): the hero's `avg gain` / `best torque` `<dl>` is structurally a stat banner. What saves it is that the numbers are real, derived, and explicitly filtered to exclude sample data — not "10,000+ happy customers". But the *shape* is the same shape: if the shop ever runs low on real builds, the honest move is to drop the row, not backfill it with a softer claim.
- **All-caps section labels** (#16, `.kicker`): motorsport branding genuinely uses all-caps condensed labels, but it's the one pattern doing double duty. The mitigation in place is right — every kicker carries specific content (`platform.make`, `"01 — Platforms"`) rather than generic "OUR SERVICES".

## 6. Reference gathering

All four fetched directly this session:

| Site | URL | Doing well | What to steal |
|---|---|---|---|
| Wehrli Custom Fabrication | https://www.wcfab.com/ | Real product photography on neutral backgrounds as the entire visual system — no lifestyle, no stock. Red as the one hot accent. | Validates the *strategy* (one accent, real product shots, no filler); no new mechanism. |
| Industrial Injection | https://industrialinjection.com/ | Mega-menu organised by engine platform generation (Cummins 9, Duramax 8, Power Stroke 1983-2025) — the same fitment logic, expressed as navigation instead of a wizard. | Cross-check the generation taxonomy against `lib/fitment/select.ts`. |
| Custom Offsets | https://customwheeloffset.com/ | Fitment-picker-as-hero with more axes (Year/Make/Model/Trim/Drive/Body/Suspension) plus a "1.25M+ Photos" social-proof line beside it. | Confirms "picker is the hero" is proven in this category. The social-proof-beside-the-tool placement is worth borrowing in spirit once real counts exist. |
| LGND Supply Co | https://lgndsupplyco.com/ | A working multi-accent system — but on a multi-category catalogue where colour separates SKUs. | Nothing. This is the counter-example confirming the single-accent recommendation. |

I could **not** find a live diesel- or motorsport-specific site using a scroll-driven, JS-free `animation-timeline: view()` hero-as-tool pattern at this level of polish. All four references use conventional scroll/JS interaction. The motion mechanism here is not catching up — it may be ahead of the category.

## (a) Do now
- Retire v1/v2/v3 from the production bundle, or confirm with whoever owns the pitch-comparison need that it's safe. **[ORCHESTRATOR: it is not — see verification notes.]**
- Apply `texture-cast-iron.jpg` or `texture-machined-alloy.jpg` to the `ProcessV4.tsx` step cards using the existing measured-opacity method.
- Rewrite or fold the "Three steps" numeral cards into real shop-specific language.
- Add the zero-cost monospace stack for code-like strings.

## (b) Needs the owner
- The five-shot photography sequence, in order, this week if possible. Highest-ceiling item in this report; costs a phone and an hour.
- A decision on whether v1/v2/v3 are still needed live.
- Confirmation of Higgsfield's commercial-use terms for the generated `z_image` assets. `docs/IMAGERY.md` documents cost and grading thoroughly but states no licence basis. Flagging an absence, not a known problem.

## (c) Later
- A steel-blue (not orange) secondary accent for data visualisation only, sourced from the existing `--steel` family.
- Verify the brake-caliper colour-tier convention against real reference photos.
- Revisit `backdrop-haze-green.jpg` and `backdrop-phone-flow.jpg` once a section needs them. `backdrop-haze-green` was already tried and rejected in the hero, so it needs a different placement, not a different opinion.

## What surprised me
- The amber-reservation rule isn't invented — it maps onto a real gauge-warning convention the customer already reads correctly. Stronger than expected, not weaker.
- The CSS-budget problem has almost nothing to do with the v4 art or motion system and almost everything to do with three other design variants shipping to every visitor. I did not expect the highest-leverage finding in a visual-direction brief to be "delete unused code".
- `ProcessV4.tsx`'s numbered cards are a clean instance of the same team that wrote the disciplined `docs/IMAGERY.md` shipping one section that reads like the thing they avoided everywhere else.
- Ran out of web-search budget (200-search cap) before verifying the brake-caliper convention.

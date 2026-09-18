# Imagery

## What these files are — read before using any of them

Every asset listed here is a **generated abstract texture**. None of them is a photograph of
Lucky Diesel, its shop, its equipment, its staff or any customer vehicle.

Lucky Diesel is a new business. It has no completed customer builds to photograph, no shop
photography and no reviews. These assets exist so the site can have depth, material and
atmosphere **without making any factual claim about the business**.

**Rules for using these files:**

- No image here may be presented as a real build, a real shop, a real bay, a real dyno run,
  a real part the shop has fitted, or a customer vehicle.
- Do not caption them as if they were documentary photography ("our shop", "a recent build",
  "our workspace"). They are backgrounds, surfaces and overlays — not evidence.
- Do not pair them with a claim they appear to prove. A material tile behind a service card
  is fine; the same tile captioned "our machining" is not.
- They contain no vehicles, no people, no interiors, no signage and no branding, and nothing
  here should be edited to imply any of those.

When the shop has real photography, real build shots should replace the decorative use of
these assets wherever the surrounding copy makes a claim about work performed.

## Art direction

Built to the "Fitment" direction and toned against the existing `texture-carbon.jpg`:

- Near-black base (`#0b0d0c`); every asset is predominantly black so white type stays legible.
- One hot clover green (`#1fbf3f`) as a restrained rake or glow — never a colour wash.
- Amber (`#f0a742`) does not appear in any of these; it is reserved for emissions notices.
- Every asset is graded with an **edge falloff to black**, so it can be dropped into a dark
  section full-bleed without a visible seam at any edge.

## Generation and budget

- Model: Higgsfield `z_image` (0.15 credits per image).
- 13 images generated, **1.95 credits spent** (balance 9.70 → 7.75).
- 12 kept, 1 discarded (see below).
- All assets post-graded locally: black-point pull, hue correction toward `#1fbf3f`,
  desaturation where green read as a wash, and a smoothstep edge feather.
- Encoded with `sips` to JPEG, quality tuned per file to stay under ~110KB.

## Assets

### Section backdrops (16:9)

| File | Dimensions | Size | Depicts | Suggested use |
|---|---|---|---|---|
| `backdrop-haze-green.jpg` | 1600x900 | 31 KB | Volumetric haze with a green light rake from the upper left, falling to black | Hero or section backdrop where type sits right-of-centre over black |
| `backdrop-flowfield.jpg` | 1500x844 | 102 KB | Filament flow-field curving left to right, green catching the crest | Backdrop for a performance/airflow section; strong enough to carry a section on its own |
| `backdrop-vane-vortex.jpg` | 1600x900 | 54 KB | Abstract radial sculpture of dark vanes, green rim light at the core | Divider or feature backdrop; the only asset with a focal point, so keep type clear of centre |

### Material tiles (square / 4:3)

| File | Dimensions | Size | Depicts | Suggested use |
|---|---|---|---|---|
| `texture-carbon-twill.jpg` | 1200x1200 | 90 KB | Carbon fibre twill weave, deep green-black, shallow focus | Card background or category art; pairs with the existing `texture-carbon.jpg` |
| `texture-cast-iron.jpg` | 1100x825 | 107 KB | Rough cast iron grain, near-black, one restrained green highlight patch | Card background where a spot of green accent is wanted |
| `texture-knurl-steel.jpg` | 1100x1100 | 88 KB | Diamond knurling on dark steel, sharp repeating pyramid grid | Category art or small tile; the most graphic of the four, good behind short labels |
| `texture-machined-alloy.jpg` | 1000x1000 | 102 KB | Machined aluminium, concentric lathe arcs, near-black and neutral | The quietest tile; best where type must stay fully legible over it |

### Phone / vertical (9:16)

| File | Dimensions | Size | Depicts | Suggested use |
|---|---|---|---|---|
| `backdrop-phone-shaft.jpg` | 900x1600 | 30 KB | Vertical green light shaft through haze, lower two thirds black | Mobile hero backdrop; copy sits in the black lower area |
| `backdrop-phone-flow.jpg` | 900x1600 | 92 KB | Vertical filament streams with a green core | Mobile section backdrop with more energy than the shaft |

### Graphic overlays (16:9)

Intended to sit **over** a dark surface at low opacity, not as standalone backgrounds.

| File | Dimensions | Size | Depicts | Suggested use |
|---|---|---|---|---|
| `overlay-grid.jpg` | 1600x900 | 55 KB | Fine engineering grid, dim green hairlines, fading at all edges | Blueprint texture over a dark section; try `opacity` 0.3–0.6 with `mix-blend-mode: screen` |
| `overlay-contour.jpg` | 1600x900 | 44 KB | Topographic contour lines, extremely low contrast | Very subtle surface interest behind long-form copy |
| `overlay-scanline.jpg` | 1600x900 | 66 KB | Scanlines and grain with a green interference band low in the frame | Atmosphere at a section boundary; the band reads as a horizon line |

## Where these are used (v4 "Fitment", as of 2026-09-18)

Placed as CSS backgrounds in the `v4 art` block of `app/globals.css`, each behind an
`aria-hidden` div. All are painted in `mix-blend-mode: screen` over the section's own
carbon, which drops the black each asset is graded to at its edges — so a layer can be any
size and stop anywhere without a seam.

| Asset | Where | Notes |
|---|---|---|
| `backdrop-phone-shaft.jpg` | Hero, below 1024px | opacity 0.26; raised to 0.6 from 640px |
| `backdrop-vane-vortex.jpg` | Hero, 1024px and up | cropped to the vane field — see the warning below |
| `backdrop-flowfield.jpg` | "What's it for?", 1024px and up | masked out under the copy; not declared below 1024px, so a phone never fetches it |
| `texture-knurl-steel.jpg` | Platform tile corners | radial mask keeps it off the type; a different crop per tile |
| `overlay-grid.jpg` | Parts section | opacity 0.3, runs under everything |
| `overlay-scanline.jpg` | Process section | the interference band set as a horizon below the steps, never under copy |

Not used yet: `backdrop-haze-green.jpg`, `backdrop-phone-flow.jpg`, `texture-carbon-twill.jpg`,
`texture-cast-iron.jpg`, `texture-machined-alloy.jpg`, `overlay-contour.jpg`. `backdrop-haze-green`
was tried in the hero and rejected — over near-black it flattens to a faint tint with no material
in it. The original `texture-carbon.jpg` is now referenced nowhere.

### Warning: the lit core of `backdrop-vane-vortex.jpg`

The vanes read as a turbo. **Its green-lit core does not.** Shown on its own against near-black —
which is what happens when the dark vanes around it fall away — the four lit blades read as
leaves, and on a brand whose mark is a four-leaf clover that is the worst available reading. It
was on the page that way and had to be recropped.

If you use this asset, keep the focal point (45% across, 33% down its frame) **outside** the
visible crop and show the radiating vanes instead. The hero does this with
`background-size: 260% auto; background-position: 88% 20%`.

This is the same clover artifact noted under Discarded, surviving in a kept asset rather than a
thrown-away one. Check any crop of these assets on screen before trusting it.

### Contrast — how to set an opacity here

Every opacity in the v4 art block is a measured ceiling, not a taste call. The method:

1. Take the text's **ink**, via `Range.getClientRects()` — not its element box. A left-aligned
   kicker's box spans the whole container while its text stops far short of the art; measuring the
   box fails layers that are actually fine.
2. Sample every pixel of the asset under that ink and composite it the way the browser does:
   `filter` first, then the mask's alpha, then the layer opacity, then `screen` over `#0b0d0c`.
3. Take the brightest result and compare it to the text colour. Steel `#8b9490` is L 0.2866;
   at 18px it needs 4.5:1, so the ground must stay under about L 0.062.

Current measurements: 320px 5.25 · 390px 4.75 · 768px 6.11 · 1024px 4.90 · 1280px 6.25.

**Two hard ceilings, both found by measuring:**

- **The phone hero cannot exceed ~0.34.** Below 640px the copy column is nearly the full width and
  crosses 64-68% of that layer, straight through the shaft's bright core at 42-58%. Masking buys
  nothing: a mask wide enough to clear the subhead erases the core with it (measured 2.79:1 when
  tried at 0.9 with a 0->42% mask). It ships at 0.32.
- **The knurl is capped by the tile's arrow, not by the texture.** `ArrowUpRight` sits at
  `right-4 top-4`, inside the mask's brightest zone, and is 16px steel — a non-text affordance
  needing 3:1. At opacity 1.0 with a contrast lift it measured **1.02:1, invisible**. It ships at
  0.80 / 3.06:1; 0.85 already fails.

If you raise any of these, re-measure. Do not raise one because it "looks fine".

## Discarded

- **Machined-alloy tile, first attempt** — the prompt word "clover" (used for the green) made
  the model render a literal shamrock leaf as a centrepiece. Regenerated with "emerald green
  / RGB 31 191 63" instead. Two further images picked up tiny shamrock artifacts from the same
  wording and were salvaged by cropping around them.
- Note for future generation: **do not use the word "clover" in a prompt for this brand.**
  Specify the accent as `#1fbf3f` / "emerald green, RGB 31 191 63" and add "no leaves, no
  plants, no clover" to the negative list.

## Still missing

No asset here can stand in for real photography of the business. The site will still need,
once they exist: shop exterior and signage, a real bay, real completed builds, and the team.
Those must be photographed, not generated.

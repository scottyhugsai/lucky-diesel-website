# Visual audit harness

Committed because it kept getting rebuilt from scratch every session in a
scratchpad that does not survive, and because two of its details are traps
worth writing down once.

```bash
npm run dev                                          # port 3000

node scripts/audit/sweep.mjs                         # status / overflow / h1 / console
DESIGN=v1 WIDTHS=320,375,768,1024,1440,1920 node scripts/audit/sweep.mjs
ONLY=store node scripts/audit/sweep.mjs              # narrow to matching routes

OUT=$PWD/.audit/before node scripts/audit/layout-run.mjs
# ...make the change...
OUT=$PWD/.audit/after  node scripts/audit/layout-run.mjs
node scripts/audit/layout-diff.mjs .audit/before .audit/after
```

`sweep.mjs` exits non-zero on any failing cell, so it can gate a change.

## Two things that will bite

**Always capture with reduced motion.** Sections reveal with
`animation-timeline: view()`. `fullPage: true` resizes the viewport to the
document height, which resolves every such element to its pre-entry state at
opacity 0 — a home-page capture once measured 2.26% ink against 12.06% with
motion off, whole sections missing, and nothing in the output said so.
`context()` in `playwright.mjs` sets `reducedMotion: 'reduce'` for this reason.

**Playwright is not a dependency of this repo**, on purpose: it would put a
browser download in every install and CI run for tooling only used by hand. It
is loaded from the npx cache. If that is gone, `npx --yes playwright@latest
install chromium` and set `PLAYWRIGHT_HOME` to the resulting cache directory.

## Measuring contrast

Do not sample a 1px border from a screenshot — subpixel positioning smears it
and reads low (a border measured at 1.23:1 that is really 4.24:1). Composite
the declared colour over the *painted* backdrop with a canvas `fillRect` in the
page and read the pixel back, walking up `parentElement` until
`backgroundColor !== rgba(0, 0, 0, 0)` to find what is actually behind. That
also handles `oklab(... / a)`, which Tailwind 4 emits for `border-chalk/45`.

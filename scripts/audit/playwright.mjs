import { createRequire } from 'node:module';

/**
 * Playwright is deliberately NOT a dependency of this repo — it would pull a
 * browser download into every install and CI run for tooling only ever used by
 * hand. It lives in the npx cache instead. If this throws, prime it with:
 *
 *   npx --yes playwright@latest install chromium
 *
 * and point PLAYWRIGHT_HOME at whatever cache directory that created.
 */
const HOME = process.env.PLAYWRIGHT_HOME ?? '/Users/scottyhugs/.npm/_npx/e41f203b7505f1fb';
const require = createRequire(`${HOME}/package.json`);

export const { chromium } = require('playwright');
export const BASE = process.env.BASE ?? 'http://localhost:3000';
export const DESIGN = process.env.DESIGN ?? 'v4';
export const WIDTHS = (process.env.WIDTHS ?? '1440,375').split(',').map(Number);

/** Every public route worth sweeping. ONLY=store narrows to matching paths. */
export const PUBLIC_ROUTES = [
  '/', '/duramax', '/powerstroke', '/cummins',
  '/duramax/2011-2016-lml', '/powerstroke/2023-present-6-7l', '/cummins/2019-present-6-7l',
  '/fitment', '/book', '/build-planner', '/store', '/store/products', '/store/compare', '/store/cart',
  '/builds', '/gallery', '/fleet', '/offers', '/events', '/faq', '/blog', '/links', '/review',
  '/service-areas', '/emissions-policy', '/privacy',
].filter((route) => !process.env.ONLY || route.includes(process.env.ONLY));

/**
 * A context with the design chosen and consent already answered.
 *
 * `reducedMotion: 'reduce'` is not optional. Sections on this site reveal with
 * `animation-timeline: view()`, and a capture that does not disable motion
 * records them at opacity 0 — a home-page shot once measured 2.26% ink against
 * 12.06% with motion off, with whole sections missing and nothing to show it.
 */
export async function context(browser) {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  await ctx.addCookies([
    { name: 'ld_design', value: DESIGN, url: BASE },
    { name: 'ld_consent', value: 'essential', url: BASE },
  ]);
  return ctx;
}

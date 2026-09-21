/**
 * Captures panel geometry and a screenshot per route/width into OUT.
 *
 *   OUT=$PWD/.audit/before node scripts/audit/layout-run.mjs
 *   # ...make the change...
 *   OUT=$PWD/.audit/after  node scripts/audit/layout-run.mjs
 *   node scripts/audit/layout-diff.mjs .audit/before .audit/after
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { BASE, PUBLIC_ROUTES, WIDTHS, chromium, context } from './playwright.mjs';

const OUT = process.env.OUT;
if (!OUT) { console.error('set OUT to a directory'); process.exit(1); }
mkdirSync(path.join(OUT, 'shots'), { recursive: true });
const LAYOUT = readFileSync(path.join(import.meta.dirname, 'layout.js'), 'utf8');

const browser = await chromium.launch();
const ctx = await context(browser);
const captured = {};

for (const route of PUBLIC_ROUTES) {
  for (const width of WIDTHS) {
    const page = await ctx.newPage();
    await page.setViewportSize({ width, height: 900 });
    try {
      await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 90_000 });
      await page.waitForTimeout(400);
      await page.addScriptTag({ content: LAYOUT });
      const key = `${route}@${width}`;
      captured[key] = await page.evaluate(() => globalThis.__layout());
      const name = (route === '/' ? 'home' : route.replace(/\//g, '_').replace(/^_/, '')) + `-${width}`;
      await page.screenshot({ path: path.join(OUT, 'shots', `${name}.png`), fullPage: true });
      console.log('%s %s panels', key.padEnd(40), captured[key].length);
    } catch (error) {
      // Explicit specifiers rather than a built-up string: a page title or an
      // error message can contain a %s and must not be read as a format.
      console.error('%s@%s skipped: %s', route, width, error.message.slice(0, 70));
    }
    await page.close();
  }
}

writeFileSync(path.join(OUT, 'layout.json'), JSON.stringify(captured, null, 1));
await browser.close();
console.log(`\nwrote ${OUT}/layout.json and ${OUT}/shots/`);

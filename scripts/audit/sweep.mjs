/**
 * Every public route at every breakpoint: HTTP status, horizontal overflow,
 * exactly one h1, and a clean console. The check that catches a layout blown
 * out at 320 or a route 500ing because a query changed shape.
 *
 * Run the dev server first, then:
 *   node scripts/audit/sweep.mjs
 *   DESIGN=v1 WIDTHS=320,375,768,1024,1440,1920 node scripts/audit/sweep.mjs
 *   ONLY=store node scripts/audit/sweep.mjs
 */
import { BASE, DESIGN, PUBLIC_ROUTES, WIDTHS, chromium, context } from './playwright.mjs';

const browser = await chromium.launch();
const ctx = await context(browser);
let failures = 0;

for (const route of PUBLIC_ROUTES) {
  const cells = [];
  for (const width of WIDTHS) {
    const page = await ctx.newPage();
    await page.setViewportSize({ width, height: 900 });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error).slice(0, 70)));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text().slice(0, 70)); });

    let status = 0;
    try {
      status = (await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 90_000 }))?.status() ?? 0;
      await page.waitForTimeout(250);
    } catch {
      errors.push('navigation failed');
    }
    const measured = await page.evaluate(() => {
      const root = document.documentElement;
      return { overflow: root.scrollWidth - root.clientWidth, h1: document.querySelectorAll('h1').length };
    }).catch(() => ({ overflow: -1, h1: -1 }));

    const ok = status === 200 && measured.overflow <= 0 && measured.h1 === 1 && errors.length === 0;
    if (!ok) {
      failures += 1;
      cells.push(`${width}:FAIL(${status} overflow=${measured.overflow} h1=${measured.h1}${errors[0] ? ` ${errors[0]}` : ''})`);
    } else {
      cells.push(`${width}:ok`);
    }
    await page.close();
  }
  console.log(route.padEnd(34), cells.join('  '));
}

await browser.close();
console.log(failures ? `\n${DESIGN}: ${failures} failing cells` : `\n${DESIGN}: clean at ${WIDTHS.join(', ')}`);
process.exit(failures ? 1 : 0);

/**
 * Audits every public page against the site's copy rules:
 * headlines <= 6 words, body <= 40 words, and a cap on sections per page.
 * Run the dev server first, then: node scripts/copy-audit.mjs [design...]
 */
import { chromium } from '/Users/scottyhugs/Desktop/projects/coastal-home-inspections/node_modules/playwright/index.mjs';

const BASE = process.env.AUDIT_BASE ?? 'http://localhost:3000';
const LIMITS = { headingWords: 6, bodyWords: 40, sections: 8 };

/** Legal pages say things precisely on purpose; brevity is not the goal there. */
const LEGAL = new Set(['/emissions-policy', '/privacy']);

const PATHS = [
  '/', '/duramax', '/powerstroke', '/cummins', '/book', '/store', '/store/products',
  '/build-planner', '/builds', '/gallery', '/fleet', '/offers', '/events', '/refer',
  '/links', '/review', '/faq', '/service-areas', '/emissions-policy', '/privacy', '/blog',
];

const words = (text) => text.trim().split(/\s+/).filter(Boolean).length;

async function auditPage(page, path) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(250);
  return page.evaluate((limits) => {
    const visible = (node) => {
      const style = getComputedStyle(node);
      return style.display !== 'none' && style.visibility !== 'hidden' && node.offsetParent !== null;
    };
    const clean = (text) => text.replace(/\s+/g, ' ').trim();
    const count = (text) => text.trim().split(/\s+/).filter(Boolean).length;
    // Chrome for the cookie bar and chat widget is not page copy.
    // Chrome, plus anything marked as data rather than copy (product names,
    // vehicle names, legal text quoted verbatim).
    const CHROME = ['[aria-label="Announcement"]', 'header', 'footer', '[role="dialog"]', '[aria-label*="ookie" i]', '[aria-label*="esign" i]', 'nav', '[data-copy="data"]'];
    const inChrome = (node) => CHROME.some((selector) => node.closest(selector));

    const headings = [...document.querySelectorAll('h1, h2, h3')]
      .filter((node) => visible(node) && !inChrome(node))
      .map((node) => ({ tag: node.tagName, text: clean(node.innerText) }))
      .filter((entry) => entry.text)
      .filter((entry) => count(entry.text) > limits.headingWords);

    const bodies = [...document.querySelectorAll('p, li')]
      .filter((node) => visible(node) && !inChrome(node) && !node.querySelector('p, li'))
      .map((node) => clean(node.innerText))
      .filter((text) => count(text) > limits.bodyWords);

    const sections = [...document.querySelectorAll('main section, main > div > section, section')]
      .filter((node) => visible(node) && !inChrome(node)).length;

    const bodyText = document.querySelector('main')?.innerText ?? document.body.innerText;
    return { headings, bodies, sections, totalWords: count(bodyText) };
  }, LIMITS);
}

const designs = process.argv.slice(2).length ? process.argv.slice(2) : ['v1', 'v2', 'v3'];
const browser = await chromium.launch();
let total = 0;

for (const design of designs) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies([{ name: 'ld_design', value: design, url: BASE }]);
  const page = await context.newPage();
  console.log(`\n══ ${design} ══`);
  for (const path of PATHS) {
    const { headings, bodies, sections, totalWords } = await auditPage(page, path);
    const issues = headings.length + (LEGAL.has(path) ? 0 : bodies.length) + (sections > LIMITS.sections ? 1 : 0);
    total += issues;
    console.log(`  ${path.padEnd(22)} ${String(sections).padStart(2)} sections  ${String(totalWords).padStart(5)} words${issues ? '  ⚠' : ''}`);
    for (const h of headings) console.log(`      ${h.tag} ${words(h.text)}w: ${h.text.slice(0, 90)}`);
    if (!LEGAL.has(path)) for (const b of bodies) console.log(`      body ${words(b)}w: ${b.slice(0, 110)}…`);
  }
  await context.close();
}

await browser.close();
console.log(`\n${total} copy-rule breaches.`);

import { money } from '@/lib/format';
import type { ComplianceMap } from './compliance';
import { complianceFor } from './compliance';
import { PLATFORMS } from '@/lib/site';
import { CATEGORIES, type StoreProduct } from './normalize';

/**
 * Side-by-side comparison for parts that fit the same truck.
 *
 * Knowing what fits is the easy half; the hard half is choosing between three
 * things that all fit, which is where this trade generally leaves people on
 * their own. So every row carries a `meaning` — what the spec actually does for
 * you — in plain language, not a spec dump.
 *
 * Numbers quoted by a manufacturer are labelled as theirs. The shop has no dyno
 * figures for your truck and must not imply otherwise.
 */

export const MAX_COMPARE = 4;

const HANDLE_RE = /^[a-z0-9][a-z0-9-]{0,118}$/;

export function parseCompare(value: string | string[] | undefined): string[] {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  const seen: string[] = [];
  for (const entry of raw) {
    const handle = entry.trim().toLowerCase();
    if (HANDLE_RE.test(handle) && !seen.includes(handle)) seen.push(handle);
    if (seen.length >= MAX_COMPARE) break;
  }
  return seen;
}

/** The headline number people actually shop on, per category. */
export function sizeOf(product: StoreProduct): string | null {
  const text = product.title;
  const over = text.match(/(\d{1,3})\s?%\s*over/i);
  if (over) return `${over[1]}% over stock`;
  // Guard against year ranges and part numbers reading as millimetres.
  const mm = text.match(/\b(\d{2,3})\s?mm\b/i);
  if (mm) return `${mm[1]} mm`;
  return null;
}

/** A power figure the part's maker quotes. Never presented as the shop's own. */
export function supportedPowerOf(product: StoreProduct): string | null {
  const haystack = [product.summary, ...product.intro, ...product.bullets.map((bullet) => bullet.text)].join(' ');
  const match = haystack.match(/(?:support(?:s|ing)?|capable of|good for)\s+(?:up to\s+)?([\d,]{3,4}(?:\s?[-–]\s?[\d,]{3,4})?)\s*(?:hp\b|horsepower)/i);
  if (!match?.[1]) return null;
  return `${match[1].replace(/\s/g, '')} hp`;
}

export interface SpecRow {
  key: string;
  label: string;
  /** What the spec means for the buyer, in plain words. */
  meaning: string;
  values: (string | null)[];
}

const categoryName = (product: StoreProduct) => CATEGORIES.find((entry) => entry.id === product.category)?.name ?? product.category;

function fitsOf(product: StoreProduct): string | null {
  if (product.fitmentLabels.length) return product.fitmentLabels.join(' · ');
  const names = product.platforms.map((id) => PLATFORMS.find((platform) => platform.id === id)?.name ?? id);
  return names.length ? names.join(' · ') : null;
}

function choicesOf(product: StoreProduct): string | null {
  const option = product.options[0];
  if (!option || option.values.length < 2) return null;
  return `${option.values.length} ${option.name.toLowerCase()} options`;
}

interface RowSpec {
  key: string;
  label: string;
  meaning: string;
  value: (product: StoreProduct, compliance: ComplianceMap) => string | null;
}

/**
 * An EO number is checkable against CARB's own database by anyone, which makes
 * it one of the few trust signals a shop with no trading history can actually
 * offer. Where the owner has not recorded one yet, say so plainly instead of
 * implying a status either way.
 */
function emissionsOf(product: StoreProduct, compliance: ComplianceMap): string | null {
  const record = compliance.get(product.handle);
  if (record?.eoNumber) return `CARB EO ${record.eoNumber}`;
  const status = complianceFor(product, compliance);
  if (status === 'not_applicable') return 'No emissions impact';
  if (status === 'carb_eo') return 'CARB EO on file';
  if (status === 'sema_verified') return 'SEMA verified';
  return 'Ask us — not documented yet';
}

const ROWS: readonly RowSpec[] = [
  {
    key: 'price',
    label: 'Price',
    meaning: 'The part only. Fitting it is quoted separately, per truck.',
    value: (product) => (product.purchasable ? money(product.priceMinCents) : 'Quote'),
  },
  {
    key: 'fits',
    label: 'Fits',
    meaning: 'If your truck is not on this list, it will not bolt on.',
    value: fitsOf,
  },
  {
    key: 'type',
    label: 'Type',
    meaning: 'What the part is, so you are not comparing a turbo against a tune.',
    value: categoryName,
  },
  {
    key: 'size',
    label: 'Size',
    meaning: 'On a turbo, the compressor: bigger moves more air but takes longer to spool. On injectors, how far over stock they flow.',
    value: sizeOf,
  },
  {
    key: 'supports',
    label: 'Maker’s figure',
    meaning: 'What the manufacturer says the part can support with the right fuel. It is their number, not a promise for your truck.',
    value: supportedPowerOf,
  },
  {
    key: 'brand',
    label: 'Brand',
    meaning: 'Who built it. Warranty and support come from them, through us.',
    value: (product) => product.vendor || null,
  },
  {
    key: 'choices',
    label: 'Choices',
    meaning: 'Variants to pick from before you add it to the cart.',
    value: choicesOf,
  },
  {
    key: 'emissions',
    label: 'Emissions',
    meaning: 'Parts that change fuelling or airflow need a CARB EO number to be street legal in some states. Where we hold one, it is here to check.',
    value: emissionsOf,
  },
  {
    key: 'stock',
    label: 'Availability',
    meaning: 'Sold out means we would have to order it, which adds lead time.',
    value: (product) => (product.purchasable ? (product.available ? 'In stock' : 'Sold out') : 'Not stocked'),
  },
];

/** One row per spec, dropping any row none of the chosen parts can answer. */
export function compareRows(products: readonly StoreProduct[], compliance: ComplianceMap = new Map()): SpecRow[] {
  return ROWS.map((row) => ({
    key: row.key,
    label: row.label,
    meaning: row.meaning,
    values: products.map((product) => row.value(product, compliance)),
  })).filter((row) => row.values.some((value) => value !== null));
}

import { PLATFORMS } from '@/lib/site';
import type { BlockDef } from '../fields';

/** Storage keys for per-product overrides are namespaced so they never collide
 *  with a content block key. */
export const PRODUCT_KEY_PREFIX = 'product:';

export const productKey = (handle: string) => `${PRODUCT_KEY_PREFIX}${handle}`;

export const PRODUCT_BADGES = [
  { value: 'featured', label: 'Featured' },
  { value: 'new-arrival', label: 'New arrival' },
  { value: 'special-order', label: 'Special order' },
  { value: 'install-available', label: 'Install available' },
] as const;

/** Fitment the owner can pin by hand when the store's own tags are wrong. */
export const FITMENT_OPTIONS = PLATFORMS.flatMap((platform) => [
  { value: platform.id as string, label: `${platform.name} — all` },
  ...platform.generationCollections.map((handle, index) => ({ value: handle, label: `${platform.name} ${platform.generations[index] ?? handle}` })),
]);

const FEATURED_SLOTS = Array.from({ length: 8 }, (_unused, index) => ({ value: String(index + 1), label: `Position ${index + 1}` }));

/** A product's override block. Generated per handle — the catalog is remote, so
 *  there is no fixed list of products to enumerate at build time. */
export function productBlockDef(handle: string): BlockDef {
  return {
    key: productKey(handle),
    group: 'pages',
    title: handle,
    fields: [
      { kind: 'boolean', name: 'hidden', label: 'Hide from the store' },
      { kind: 'text', name: 'title', label: 'Title', max: 140 },
      { kind: 'textarea', name: 'summary', label: 'Short description', max: 240, maxWords: 30 },
      { kind: 'list', name: 'badges', label: 'Badges', options: PRODUCT_BADGES, max: 2 },
      { kind: 'list', name: 'fitment', label: 'Fits', options: FITMENT_OPTIONS, max: 12 },
      { kind: 'image', name: 'image1', label: 'Photo 1' },
      { kind: 'image', name: 'image2', label: 'Photo 2' },
      { kind: 'image', name: 'image3', label: 'Photo 3' },
      { kind: 'select', name: 'featuredSort', label: 'Feature on the store page', options: FEATURED_SLOTS },
    ],
    defaults: { hidden: false, title: '', summary: '', badges: [], fitment: [], image1: '', image2: '', image3: '', featuredSort: '' },
  };
}

export interface ProductOverride {
  hidden: boolean;
  title: string | null;
  summary: string | null;
  badges: readonly string[];
  fitment: readonly string[];
  images: readonly string[];
  featuredSort: number | null;
}

export function toProductOverride(values: Record<string, unknown>): ProductOverride {
  const str = (name: string) => (typeof values[name] === 'string' ? (values[name] as string).trim() : '');
  const slot = Number(str('featuredSort'));
  return {
    hidden: values.hidden === true,
    title: str('title') || null,
    summary: str('summary') || null,
    badges: Array.isArray(values.badges) ? (values.badges as string[]) : [],
    fitment: Array.isArray(values.fitment) ? (values.fitment as string[]) : [],
    images: ['image1', 'image2', 'image3'].map(str).filter(Boolean),
    featuredSort: Number.isInteger(slot) && slot > 0 ? slot : null,
  };
}

import type { Platform } from '@/lib/site';

/** The subset of Shopify's public /products.json shape we rely on. */
export interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  body_html: string | null;
  vendor: string;
  product_type: string;
  tags: string[];
  options: { name: string; position: number; values: string[] }[];
  variants: {
    id: number;
    title: string;
    option1: string | null;
    option2: string | null;
    option3: string | null;
    available: boolean;
    price: string;
    compare_at_price: string | null;
    featured_image: { src: string } | null;
  }[];
  images: { src: string; width: number; height: number; alt?: string | null }[];
}

export const CATEGORIES = [
  { id: 'turbo', name: 'Turbochargers', short: 'Turbos' },
  { id: 'fuel', name: 'Fuel systems', short: 'Fuel' },
  { id: 'tuning', name: 'Tuning', short: 'Tuning' },
  { id: 'exhaust', name: 'Exhaust', short: 'Exhaust' },
  { id: 'accessories', name: 'Accessories', short: 'Accessories' },
  { id: 'merch', name: 'Merch', short: 'Merch' },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]['id'];
export type PlatformId = Platform['id'];

export interface StoreVariant {
  id: number;
  title: string | null;
  optionValues: string[];
  priceCents: number;
  compareAtCents: number | null;
  available: boolean;
  image: string | null;
}

export interface DescriptionBullet {
  label: string | null;
  text: string;
}

export interface StoreProduct {
  id: number;
  handle: string;
  title: string;
  vendor: string;
  category: CategoryId;
  platforms: PlatformId[];
  /** Shopify generation collection handles this product is listed in (e.g. duramax-2017-present-l5p). */
  generationCollections: string[];
  offRoadOnly: boolean;
  tags: string[];
  priceMinCents: number;
  priceMaxCents: number;
  available: boolean;
  options: { name: string; values: string[] }[];
  variants: StoreVariant[];
  images: { src: string; width: number; height: number; alt: string }[];
  summary: string;
  intro: string[];
  bullets: DescriptionBullet[];
}

const PLATFORM_WORDS: [PlatformId, RegExp][] = [
  ['duramax', /\b(duramax|lb7|lly|lbz|lmm|lml|l5p)\b/i],
  ['powerstroke', /\b(powerstroke|power stroke|psd|f-?250|f-?350|f-?450)\b/i],
  ['cummins', /\bcummins\b/i],
];

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', ndash: '–', mdash: '—' };

function decode(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_m, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name: string) => ENTITIES[name.toLowerCase()] ?? match);
}

function stripTags(html: string): string {
  return decode(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/** Shopify description HTML → plain text parts. Never returns markup, so it is safe to render as text. */
export function parseDescription(html: string | null | undefined): { summary: string; intro: string[]; bullets: DescriptionBullet[] } {
  if (!html) return { summary: '', intro: [], bullets: [] };
  const clean = html.replace(/<(script|style|iframe)[\s\S]*?<\/\1>/gi, '');

  const intro = [...clean.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => stripTags(m[1] ?? '')).filter(Boolean);
  const bullets = [...clean.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((m) => {
      const inner = m[1] ?? '';
      const labelled = inner.match(/^\s*<strong[^>]*>([\s\S]*?)<\/strong>([\s\S]*)$/i);
      if (labelled) {
        const label = stripTags(labelled[1] ?? '').replace(/:\s*$/, '');
        return { label: label || null, text: stripTags(labelled[2] ?? '').replace(/^:\s*/, '') };
      }
      return { label: null, text: stripTags(inner) };
    })
    .filter((b) => b.text);

  if (!intro.length && !bullets.length) {
    const text = stripTags(clean);
    if (text) intro.push(text);
  }
  const first = intro[0] ?? '';
  const sentence = first.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? first;
  const summary = sentence.length > 160 ? `${sentence.slice(0, 157).trimEnd()}…` : sentence;
  return { summary, intro, bullets };
}

function categorize(product: ShopifyProduct): CategoryId {
  const haystack = [product.product_type, ...product.tags, product.title].join(' | ').toLowerCase();
  if (/turbo/.test(haystack)) return 'turbo';
  if (/cp3|injector|fuel system|lift pump/.test(haystack)) return 'fuel';
  if (/tee\b|t-shirt|dtfilm|hoodie|\bhat\b|shirt|merch/.test(haystack)) return 'merch';
  if (/tuning|tune\b|ez[ -]?lynk|calibration/.test(haystack)) return 'tuning';
  if (/exhaust|downpipe/.test(haystack)) return 'exhaust';
  return 'accessories';
}

function platformsOf(product: ShopifyProduct): PlatformId[] {
  const tagged = new Set<PlatformId>();
  for (const tag of product.tags) {
    const lower = tag.toLowerCase();
    if (lower.startsWith('duramax')) tagged.add('duramax');
    if (lower.startsWith('powerstroke')) tagged.add('powerstroke');
    if (lower.startsWith('cummins') || /\bcummins$/.test(lower)) tagged.add('cummins');
  }
  if (tagged.size === 0) {
    for (const [platform, pattern] of PLATFORM_WORDS) if (pattern.test(product.title)) tagged.add(platform);
  }
  const order: PlatformId[] = ['duramax', 'powerstroke', 'cummins'];
  return order.filter((p) => tagged.has(p));
}

const toCents = (price: string | null | undefined): number | null => {
  if (price === null || price === undefined || price === '') return null;
  const value = Math.round(Number(price) * 100);
  return Number.isFinite(value) ? value : null;
};

export function normalizeProduct(product: ShopifyProduct, collectionsByHandle: Map<string, string[]>): StoreProduct {
  const variants: StoreVariant[] = product.variants.map((variant) => ({
    id: variant.id,
    title: variant.title === 'Default Title' ? null : variant.title,
    optionValues: [variant.option1, variant.option2, variant.option3].filter((v): v is string => Boolean(v) && v !== 'Default Title'),
    priceCents: toCents(variant.price) ?? 0,
    compareAtCents: toCents(variant.compare_at_price),
    available: variant.available,
    image: variant.featured_image?.src ?? null,
  }));
  const prices = variants.map((v) => v.priceCents);
  const description = parseDescription(product.body_html);

  return {
    id: product.id,
    handle: product.handle,
    title: product.title.replace(/\s{2,}/g, ' ').trim(),
    vendor: product.vendor,
    category: categorize(product),
    platforms: platformsOf(product),
    generationCollections: collectionsByHandle.get(product.handle) ?? [],
    offRoadOnly: product.tags.some((tag) => /off-?road use only|competition use only/i.test(tag)),
    tags: product.tags,
    priceMinCents: prices.length ? Math.min(...prices) : 0,
    priceMaxCents: prices.length ? Math.max(...prices) : 0,
    available: variants.some((v) => v.available),
    options: product.options
      .filter((o) => !(o.values.length === 1 && o.values[0] === 'Default Title'))
      .map((o) => ({ name: o.name, values: o.values })),
    variants,
    images: product.images.map((image) => ({ src: image.src, width: image.width, height: image.height, alt: image.alt || product.title })),
    ...description,
  };
}

export interface TruckSelection {
  platform: PlatformId;
  generationCollection: string | null;
}

/**
 * 'fits' = listed for that exact generation · 'platform' = right platform, generation unconfirmed ·
 * 'universal' = not platform-specific (merch, devices) · 'no' = listed for something else.
 */
export function fitsTruck(product: Pick<StoreProduct, 'platforms' | 'generationCollections'>, truck: TruckSelection): 'fits' | 'platform' | 'universal' | 'no' {
  if (product.platforms.length === 0) return 'universal';
  if (!product.platforms.includes(truck.platform)) return 'no';
  if (!truck.generationCollection) return 'platform';
  const forPlatform = product.generationCollections.filter((handle) => handle.startsWith(`${truck.platform}-`));
  if (forPlatform.length === 0) return 'platform';
  return forPlatform.includes(truck.generationCollection) ? 'fits' : 'no';
}

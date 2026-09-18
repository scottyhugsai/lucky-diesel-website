/** Pure helpers for store listings: params, sorting, price and fitment labels. */
import type { SavedTruck } from '@/lib/fitment/truck-cookie';
import { money } from '@/lib/format';
import { PLATFORMS } from '@/lib/site';
import { CATEGORIES, fitsTruck, type CategoryId, type PlatformId, type StoreProduct, type TruckSelection } from '@/lib/store/normalize';

export const SORTS = [
  { id: 'featured', label: 'Featured' },
  { id: 'price-asc', label: 'Price: low to high' },
  { id: 'price-desc', label: 'Price: high to low' },
] as const;
export type SortId = (typeof SORTS)[number]['id'];

export interface StoreParams {
  category: CategoryId | null;
  platform: PlatformId | null;
  gen: string | null;
  q: string;
  sort: SortId;
  /** Set aside the saved truck for this view, without forgetting it. */
  all: boolean;
  /** Hide the sample listings and show only parts the shop actually sells. */
  stocked: boolean;
  /** 1-based; the listing is far too long to hand over in one document. */
  page: number;
}

type RawParams = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? '';

/** Validates listing search params; anything unknown is dropped rather than trusted. */
export function parseStoreParams(raw: RawParams): StoreParams {
  const category = CATEGORIES.find((c) => c.id === first(raw.category))?.id ?? null;
  const platform = PLATFORMS.find((p) => p.id === first(raw.platform)) ?? null;
  const gen = first(raw.gen);
  const sort = SORTS.find((s) => s.id === first(raw.sort))?.id ?? 'featured';
  const page = Number.parseInt(first(raw.page), 10);
  return {
    category,
    platform: platform?.id ?? null,
    gen: platform?.generationCollections.includes(gen) ? gen : null,
    q: first(raw.q).trim().slice(0, 80),
    sort,
    all: first(raw.all) === '1',
    stocked: first(raw.stocked) === '1',
    page: Number.isFinite(page) && page > 1 ? page : 1,
  };
}

/** Builds a /store/products URL, omitting defaults so links stay short. */
export function productsHref(params: Partial<StoreParams>): string {
  const search = new URLSearchParams();
  if (params.category) search.set('category', params.category);
  if (params.platform) search.set('platform', params.platform);
  if (params.platform && params.gen) search.set('gen', params.gen);
  if (params.q) search.set('q', params.q);
  if (params.sort && params.sort !== 'featured') search.set('sort', params.sort);
  if (params.all && !params.platform) search.set('all', '1');
  if (params.stocked) search.set('stocked', '1');
  if (params.page && params.page > 1) search.set('page', String(params.page));
  const query = search.toString();
  return query ? `/store/products?${query}` : '/store/products';
}

/** Returns a new array. Featured keeps catalog order with in-stock items first. */
export function sortProducts<P extends Pick<StoreProduct, 'priceMinCents' | 'available' | 'purchasable'>>(products: readonly P[], sort: SortId): P[] {
  // Things you can actually buy come first in every ordering; sample listings
  // have no price, so they would otherwise win "cheapest first" outright.
  const rank = (a: P, b: P) => Number(b.purchasable) - Number(a.purchasable) || Number(b.available) - Number(a.available);
  if (sort === 'price-asc') return [...products].sort((a, b) => rank(a, b) || a.priceMinCents - b.priceMinCents);
  if (sort === 'price-desc') return [...products].sort((a, b) => rank(a, b) || b.priceMinCents - a.priceMinCents);
  return [...products].sort(rank);
}

/** How many parts one page of the listing holds. Divides by 2, 3 and 4, which are the grid's column counts. */
export const PAGE_SIZE = 24;

export interface PageSlice<T> {
  items: T[];
  /** Clamped into range, so a hand-typed ?page=900 still shows the last page. */
  page: number;
  pages: number;
  total: number;
  /** 1-based positions of the slice within the whole result, for "25–48 of 237". */
  from: number;
  to: number;
}

/** Cuts a result set into one page. 237 parts in a single document is not a page, it is a scroll. */
export function paginate<T>(items: readonly T[], page: number, size = PAGE_SIZE): PageSlice<T> {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, Math.trunc(page) || 1), pages);
  const start = (current - 1) * size;
  const slice = items.slice(start, start + size);
  return { items: slice, page: current, pages, total, from: slice.length ? start + 1 : 0, to: start + slice.length };
}

/**
 * Page numbers to draw, with `null` for an elision. Always keeps the first and
 * last page and the one either side of the current one; a gap is only drawn when
 * it actually hides more than one page, since "1 … 3 4 5" is longer than "1 2 3 4 5".
 */
export function pageWindow(page: number, pages: number): (number | null)[] {
  // Three abreast even at the ends, so the row does not shrink on page 1.
  const start = Math.min(Math.max(1, page - 1), Math.max(1, pages - 2));
  const keep = new Set([1, pages, start, start + 1, start + 2]);
  const shown = [...Array(pages).keys()].map((i) => i + 1).filter((n) => keep.has(n));
  return shown.flatMap((n, i) => {
    const previous = shown[i - 1];
    if (previous === undefined || n - previous === 1) return [n];
    // A gap that hides one page is longer than the page it hides.
    return n - previous === 2 ? [n - 1, n] : [null, n];
  });
}

const isExample = (product: Pick<StoreProduct, 'source'>) => product.source === 'demo';

/**
 * Real, sellable parts ahead of the sample listings, each group keeping the order
 * it arrived in. `sortProducts` already ranks buyable parts first, but a pinned
 * featured slot can pull one back out of order — and with samples outnumbering
 * the real catalogue two to one, a visitor must never page through examples to
 * reach something they can buy.
 */
export function stockedFirst<P extends Pick<StoreProduct, 'source'>>(products: readonly P[]): P[] {
  return [...products.filter((p) => !isExample(p)), ...products.filter(isExample)];
}

/** The real/sample split, so the page can state it instead of implying 237 buyable parts. */
export function countStocked(products: readonly Pick<StoreProduct, 'source'>[]): { stocked: number; examples: number } {
  const examples = products.filter(isExample).length;
  return { stocked: products.length - examples, examples };
}

/** Where the sample listings start on this page, or -1 if none are on it. */
export function firstExampleIndex(products: readonly Pick<StoreProduct, 'source'>[]): number {
  return products.findIndex(isExample);
}

export function priceLabel(product: Pick<StoreProduct, 'priceMinCents' | 'priceMaxCents' | 'purchasable'>): string {
  // Sample listings carry no price: quoting one would be inventing the shop's.
  if (!product.purchasable) return 'Quote';
  const min = money(product.priceMinCents, { whole: product.priceMinCents % 100 === 0 });
  return product.priceMaxCents > product.priceMinCents ? `From ${min}` : min;
}

/** Generation display info for a Shopify generation collection handle. */
export function generationInfo(collection: string | null): { platform: PlatformId; name: string; short: string } | null {
  if (!collection) return null;
  for (const platform of PLATFORMS) {
    const index = platform.generationCollections.indexOf(collection);
    const name = platform.generations[index];
    if (index < 0 || !name) continue;
    const code = platform.id === 'duramax' ? name.split(' ').find((word) => /^L[A-Z0-9]{2}$/.test(word)) : undefined;
    return { platform: platform.id, name, short: code ?? name };
  }
  return null;
}

export function truckLabel(truck: TruckSelection | null): string | null {
  if (!truck) return null;
  const platform = PLATFORMS.find((p) => p.id === truck.platform);
  return generationInfo(truck.generationCollection)?.short ?? platform?.name ?? null;
}

/** How the visitor would say it: "2020 L5P" once they have picked a year, "Duramax" before that. */
export function savedTruckLabel(saved: SavedTruck | null): string | null {
  const base = truckLabel(saved?.selection ?? null);
  if (!saved || !base) return null;
  return saved.fitment.year ? `${saved.fitment.year} ${base}` : base;
}

export interface TruckFilter {
  platform: PlatformId | null;
  gen: string | null;
  /** True when the listing narrowed itself, so the page can say so and offer a way out. */
  fromSavedTruck: boolean;
}

/**
 * What the listing actually filters on. An explicit choice always wins; otherwise
 * the saved truck applies itself, because arriving at an unfiltered wall of parts
 * after telling the site what you drive is the thing this is meant to stop.
 */
export function listingTruckFilter(params: StoreParams, saved: SavedTruck | null): TruckFilter {
  if (params.platform || params.all || !saved) {
    return { platform: params.platform, gen: params.gen, fromSavedTruck: false };
  }
  return { platform: saved.selection.platform, gen: saved.selection.generationCollection, fromSavedTruck: true };
}

const FIT_RANK = { fits: 2, universal: 1, platform: 1, no: 0 } as const;

/**
 * Same category and a shared platform (universal parts only match universal
 * parts). What fits the visitor's truck ranks first, then the same generation:
 * offering an alternative that does not fit is not an alternative.
 */
export function relatedProducts(products: readonly StoreProduct[], product: StoreProduct, limit = 4, truck: SavedTruck | null = null): StoreProduct[] {
  const shares = (other: StoreProduct) =>
    product.platforms.length ? other.platforms.some((p) => product.platforms.includes(p)) : other.platforms.length === 0;
  const sameGen = (other: StoreProduct) => Number(other.generationCollections.some((g) => product.generationCollections.includes(g)));
  const fitRank = (other: StoreProduct) => (truck ? FIT_RANK[fitsTruck(other, truck.selection)] : 0);
  const pool = sortProducts(products.filter((p) => p.handle !== product.handle && p.category === product.category && shares(p)), 'featured');
  return [...pool].sort((a, b) => fitRank(b) - fitRank(a) || sameGen(b) - sameGen(a)).slice(0, limit);
}

/** Up to `limit` in-stock, photographed products from the given categories, round-robin. */
export function featuredProducts(products: readonly StoreProduct[], categories: readonly CategoryId[], limit: number): StoreProduct[] {
  const pools = categories.map((id) => products.filter((p) => p.category === id && p.available && p.images.length > 0));
  const picked: StoreProduct[] = [];
  for (let round = 0; picked.length < limit && pools.some((pool) => pool[round]); round += 1) {
    for (const pool of pools) {
      const next = pool[round];
      if (next && picked.length < limit) picked.push(next);
    }
  }
  return picked;
}

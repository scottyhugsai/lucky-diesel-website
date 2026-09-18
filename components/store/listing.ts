/** Pure helpers for store listings: params, sorting, price and fitment labels. */
import { money } from '@/lib/format';
import { PLATFORMS } from '@/lib/site';
import { CATEGORIES, type CategoryId, type PlatformId, type StoreProduct, type TruckSelection } from '@/lib/store/normalize';

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
}

type RawParams = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? '';

/** Validates listing search params; anything unknown is dropped rather than trusted. */
export function parseStoreParams(raw: RawParams): StoreParams {
  const category = CATEGORIES.find((c) => c.id === first(raw.category))?.id ?? null;
  const platform = PLATFORMS.find((p) => p.id === first(raw.platform)) ?? null;
  const gen = first(raw.gen);
  const sort = SORTS.find((s) => s.id === first(raw.sort))?.id ?? 'featured';
  return {
    category,
    platform: platform?.id ?? null,
    gen: platform?.generationCollections.includes(gen) ? gen : null,
    q: first(raw.q).trim().slice(0, 80),
    sort,
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

/** Same category and a shared platform (universal parts only match universal parts); same generation ranks first. */
export function relatedProducts(products: readonly StoreProduct[], product: StoreProduct, limit = 4): StoreProduct[] {
  const shares = (other: StoreProduct) =>
    product.platforms.length ? other.platforms.some((p) => product.platforms.includes(p)) : other.platforms.length === 0;
  const sameGen = (other: StoreProduct) => Number(other.generationCollections.some((g) => product.generationCollections.includes(g)));
  const pool = sortProducts(products.filter((p) => p.handle !== product.handle && p.category === product.category && shares(p)), 'featured');
  return [...pool].sort((a, b) => sameGen(b) - sameGen(a)).slice(0, limit);
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

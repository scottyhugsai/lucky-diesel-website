import 'server-only';
import { cache } from 'react';
import { BUSINESS, PLATFORMS } from '@/lib/site';
import { normalizeProduct, type CategoryId, type PlatformId, type ShopifyProduct, type StoreProduct } from './normalize';

const REVALIDATE_SECONDS = 3600;
const PAGE_SIZE = 250;
const MAX_PAGES = 8;

export interface Catalog {
  products: StoreProduct[];
  /** False when Shopify couldn't be reached; pages should point shoppers at luckydiesel.com. */
  ok: boolean;
}

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${BUSINESS.store}${path}`, {
      next: { revalidate: REVALIDATE_SECONDS, tags: ['catalog'] },
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.error(`[store] ${path} → HTTP ${response.status}`);
      return null;
    }
    return (await response.json()) as T;
  } catch (error) {
    console.error(`[store] ${path} failed: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

async function fetchAllProducts(path: string): Promise<ShopifyProduct[] | null> {
  const all: ShopifyProduct[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const data = await getJson<{ products: ShopifyProduct[] }>(`${path}?limit=${PAGE_SIZE}&page=${page}`);
    if (!data) return page === 1 ? null : all;
    all.push(...data.products);
    if (data.products.length < PAGE_SIZE) break;
  }
  return all;
}

/**
 * The live Shopify catalog, normalised. Generation fitment comes from the
 * store's own per-generation collections. Cached for an hour.
 */
export const getCatalog = cache(async (): Promise<Catalog> => {
  const products = await fetchAllProducts('/products.json');
  if (!products) return { products: [], ok: false };

  const generationHandles = PLATFORMS.flatMap((platform) => platform.generationCollections);
  const memberships = await Promise.all(
    generationHandles.map(async (collection) => ({ collection, products: (await fetchAllProducts(`/collections/${collection}/products.json`)) ?? [] })),
  );
  const collectionsByHandle = new Map<string, string[]>();
  for (const { collection, products: members } of memberships) {
    for (const member of members) {
      collectionsByHandle.set(member.handle, [...(collectionsByHandle.get(member.handle) ?? []), collection]);
    }
  }

  return { products: products.map((product) => normalizeProduct(product, collectionsByHandle)), ok: true };
});

export async function getProduct(handle: string): Promise<StoreProduct | null> {
  const { products } = await getCatalog();
  return products.find((product) => product.handle === handle) ?? null;
}

export interface CatalogFilter {
  category?: CategoryId | null;
  platform?: PlatformId | null;
  generationCollection?: string | null;
  query?: string | null;
}

/** Filters by category, platform, exact generation (keeping universal parts) and free-text search. */
export function filterProducts(products: readonly StoreProduct[], filter: CatalogFilter): StoreProduct[] {
  const query = filter.query?.trim().toLowerCase();
  return products.filter((product) => {
    if (filter.category && product.category !== filter.category) return false;
    // No platforms means "fits anything" for a store product, but a sample entry
    // always states its own fitment — so an empty list there means it fits none
    // of the three diesel platforms (a gas truck part, typically).
    if (filter.platform && !product.platforms.includes(filter.platform)) {
      if (product.platforms.length || product.fitmentLabels.length) return false;
    }
    // Shopping for a truck means parts: keep universal devices, drop apparel unless merch was asked for.
    if (filter.platform && product.category === 'merch' && filter.category !== 'merch') return false;
    if (filter.generationCollection && product.platforms.length) {
      const forPlatform = product.generationCollections.filter((h) => h.startsWith(`${filter.platform ?? ''}`));
      if (forPlatform.length && !forPlatform.includes(filter.generationCollection)) return false;
    }
    if (query) {
      const haystack = `${product.title} ${product.vendor} ${product.tags.join(' ')}`.toLowerCase();
      if (!query.split(/\s+/).every((word) => haystack.includes(word))) return false;
    }
    return true;
  });
}

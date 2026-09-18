import 'server-only';
import { cache } from 'react';
import { BUSINESS, PLATFORMS } from '@/lib/site';
import { buildDemoProducts } from './demo/catalog';
import { normalizeProduct, type CategoryId, type PlatformId, type ShopifyProduct, type StoreProduct } from './normalize';

/**
 * Sample listings show what a full catalogue would look like for trucks the
 * store does not stock yet. They carry negative ids, are labelled everywhere
 * they appear, and route to a quote instead of checkout. Set DEMO_CATALOG to
 * anything but 'true' — as go-live will — and they disappear completely.
 */
const DEMO_CATALOG_ENABLED = process.env.DEMO_CATALOG === 'true';

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
 * The live Shopify catalog, normalised — real, sellable products only.
 *
 * This is the default on purpose. Product feeds, ad creative, campaigns, the
 * build planner and stock alerts all read it, and none of them may ever carry a
 * sample listing. Storefront pages that *should* show samples ask for them by
 * calling `getStorefrontCatalog()`.
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

/** The catalogue as the shop pages show it: real products plus sample listings. */
export const getStorefrontCatalog = cache(async (): Promise<Catalog> => {
  const catalog = await getCatalog();
  // The store being unreachable must not leave sample parts standing in as the shop.
  if (!catalog.ok || !DEMO_CATALOG_ENABLED) return catalog;
  return { products: [...catalog.products, ...buildDemoProducts()], ok: true };
});

export async function getProduct(handle: string): Promise<StoreProduct | null> {
  const { products } = await getStorefrontCatalog();
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
      // Without a platform, every handle would match the empty prefix, so fall
      // back to the generation's own platform prefix.
      const prefix = filter.platform ?? filter.generationCollection.split('-')[0] ?? '';
      const forPlatform = product.generationCollections.filter((handle) => handle.startsWith(prefix));
      if (forPlatform.length && !forPlatform.includes(filter.generationCollection)) return false;
    }
    if (query) {
      const haystack = `${product.title} ${product.vendor} ${product.tags.join(' ')}`.toLowerCase();
      if (!query.split(/\s+/).every((word) => haystack.includes(word))) return false;
    }
    return true;
  });
}

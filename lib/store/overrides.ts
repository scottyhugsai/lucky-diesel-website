import type { ProductOverride } from '@/lib/site-content/registry';
import { PLATFORMS } from '@/lib/site';
import type { PlatformId, StoreProduct } from './normalize';

export type OverrideLookup = (handle: string) => ProductOverride;

const PLATFORM_IDS: readonly string[] = PLATFORMS.map((platform) => platform.id);

function withOverride(product: StoreProduct, override: ProductOverride): StoreProduct {
  const pinnedPlatforms = override.fitment.filter((value): value is PlatformId => PLATFORM_IDS.includes(value));
  const pinnedGenerations = override.fitment.filter((value) => !PLATFORM_IDS.includes(value));
  const ownImages = override.images.map((src) => ({ src, width: 1600, height: 1600, alt: override.title ?? product.title }));

  return {
    ...product,
    title: override.title ?? product.title,
    summary: override.summary ?? product.summary,
    // The owner's photos lead; the store's stay behind them rather than being lost.
    images: [...ownImages, ...product.images],
    platforms: [...new Set([...product.platforms, ...pinnedPlatforms])],
    generationCollections: [...new Set([...product.generationCollections, ...pinnedGenerations])],
    tags: [...new Set([...product.tags, ...override.badges])],
  };
}

/** The catalogue as the site should show it: hidden parts gone, the rest re-worded. */
export function applyOverrides(products: readonly StoreProduct[], lookup: OverrideLookup): StoreProduct[] {
  return products.flatMap((product) => {
    const override = lookup(product.handle);
    return override.hidden ? [] : [withOverride(product, override)];
  });
}

/** Featured parts by their chosen slot, then everything else in the order given. */
export function featuredFirst(products: readonly StoreProduct[], lookup: OverrideLookup): StoreProduct[] {
  const featured = products
    .map((product) => ({ product, slot: lookup(product.handle).featuredSort }))
    .filter((entry): entry is { product: StoreProduct; slot: number } => entry.slot !== null)
    .sort((a, b) => a.slot - b.slot)
    .map((entry) => entry.product);
  const pinned = new Set(featured.map((product) => product.handle));
  return [...featured, ...products.filter((product) => !pinned.has(product.handle))];
}

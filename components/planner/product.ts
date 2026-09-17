import type { StoreProduct, StoreVariant } from '@/lib/store/normalize';
import type { PlatformId } from '@/lib/store/normalize';

/** Only the catalog fields the planner needs, so the client bundle stays small. */
export type PlannerProduct = Pick<
  StoreProduct,
  'id' | 'handle' | 'title' | 'vendor' | 'category' | 'platforms' | 'generationCollections' | 'offRoadOnly' | 'variants'
> & { image: { src: string; width: number; height: number } | null };

export type { StoreVariant };

export const PLANNER_CATEGORIES = ['tuning', 'exhaust', 'fuel', 'turbo'] as const;

/** Server-side pre-filter: planner categories on this platform only, trimmed to plain serialisable data. */
export function toPlannerProducts(products: readonly StoreProduct[], platform: PlatformId): PlannerProduct[] {
  return products
    .filter((p) => (PLANNER_CATEGORIES as readonly string[]).includes(p.category) && p.platforms.includes(platform))
    .map((p) => ({
      id: p.id,
      handle: p.handle,
      title: p.title,
      vendor: p.vendor,
      category: p.category,
      platforms: p.platforms,
      generationCollections: p.generationCollections,
      offRoadOnly: p.offRoadOnly,
      variants: p.variants,
      image: p.images[0] ? { src: p.images[0].src, width: p.images[0].width, height: p.images[0].height } : null,
    }));
}

import type { PlatformId, StoreProduct } from '../normalize';
import { PRODUCT_SPECS, type ProductSpec } from './specs';
import { unique } from './util';

/** Sample ids start here and go down. Negative ids can never form a Shopify cart permalink. */
const FIRST_ID = 1000;
const MAX_FITMENT_LINES = 8;
const MAX_INTRO_GROUPS = 3;
const VENDOR = 'Sample catalogue';
const PLATFORM_ORDER: readonly PlatformId[] = ['duramax', 'powerstroke', 'cummins'];

function fitmentLabels(spec: ProductSpec): string[] {
  const labels = unique(spec.groups.flatMap((group) => group.labels));
  if (labels.length <= MAX_FITMENT_LINES) return labels;
  const kept = labels.slice(0, MAX_FITMENT_LINES - 1);
  return [...kept, `…and ${labels.length - kept.length} further listed generations. Ask for confirmation on yours.`];
}

function introFitment(spec: ProductSpec): string {
  const shorts = spec.groups.map((group) => group.short);
  const head = shorts.slice(0, MAX_INTRO_GROUPS).join(', ');
  const rest = shorts.length - MAX_INTRO_GROUPS;
  return rest > 0 ? `${head} and ${rest} more` : head;
}

function toProduct(spec: ProductSpec, index: number): StoreProduct {
  const id = -(FIRST_ID + index);
  const labels = fitmentLabels(spec);
  const { family } = spec;
  return {
    id,
    handle: spec.handle,
    source: 'demo',
    purchasable: false,
    title: spec.title,
    vendor: VENDOR,
    category: family.category,
    platforms: PLATFORM_ORDER.filter((platform) => spec.groups.some((group) => group.platforms.includes(platform))),
    generationCollections: unique(spec.groups.flatMap((group) => group.generationCollections)),
    fitmentLabels: labels,
    offRoadOnly: false,
    tags: unique([...family.tags, ...spec.groups.flatMap((group) => group.tags)]),
    priceMinCents: 0,
    priceMaxCents: 0,
    available: true,
    options: [],
    variants: [{ id, title: null, optionValues: [], priceCents: 0, compareAtCents: null, available: true, image: null }],
    images: [],
    summary: family.description,
    intro: [`Listed for ${introFitment(spec)}.`, 'Sample catalogue entry: no photo and no price here. Ask for a quote to confirm the exact part for your truck.'],
    bullets: [
      { label: 'Fits', text: labels[0] ?? spec.groups[0]?.short ?? spec.title },
      { label: 'What it is', text: family.what },
      { label: 'Included', text: family.included },
      ...(family.note ? [{ label: 'Note', text: family.note }] : []),
    ],
  };
}

/**
 * The sample parts catalogue: public vehicle fitment data, no prices, no photos,
 * no claim about what the shop stocks. Every id is negative so these can never
 * be added to a real cart.
 */
export function buildDemoProducts(): StoreProduct[] {
  return PRODUCT_SPECS.map(toProduct);
}

export function demoProductsByHandle(): Map<string, StoreProduct> {
  return new Map(buildDemoProducts().map((product) => [product.handle, product]));
}

/** handle → truck id → generation ids, built from the same specs the products are. */
const FITMENT_INDEX: ReadonlyMap<string, ReadonlyMap<string, ReadonlySet<string>>> = new Map(
  PRODUCT_SPECS.map((spec) => {
    const byTruck = new Map<string, Set<string>>();
    for (const fit of spec.groups.flatMap((group) => group.fits)) {
      const generations = byTruck.get(fit.truckId) ?? new Set<string>();
      generations.add(fit.generationId);
      byTruck.set(fit.truckId, generations);
    }
    return [spec.handle, byTruck];
  }),
);

/** True when the sample part is listed for that truck, and that generation if one is named. */
export function fitsTruck(product: StoreProduct, truckId: string, generationId?: string | null): boolean {
  const generations = FITMENT_INDEX.get(product.handle)?.get(truckId);
  if (!generations) return false;
  return generationId === undefined || generationId === null || generations.has(generationId);
}

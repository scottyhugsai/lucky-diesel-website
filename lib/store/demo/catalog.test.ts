import { describe, expect, it } from 'vitest';
import { PLATFORMS } from '@/lib/site';
import { isRealVariantId } from '../cart';
import { buildDemoProducts, demoProductsByHandle, fitsTruck } from './catalog';
import { FITMENT_GROUPS } from './groups';
import { PART_FAMILIES } from './parts';
import { findTruck } from './trucks';

const products = buildDemoProducts();
const byHandle = demoProductsByHandle();
const COLLECTIONS = new Set(PLATFORMS.flatMap((platform) => platform.generationCollections));

/** The words that would turn a sample listing into an emissions-defeating advert. */
const BANNED = /\b(delete|deletes|deleted|race pipe|test pipe|dpf.?delete|egr.?delete|def.?delete|straight.?pipe)\b/i;
const textOf = (product: (typeof products)[number]) =>
  [product.title, product.summary, ...product.intro, ...product.bullets.flatMap((b) => [b.label ?? '', b.text]), ...product.tags].join(' | ');

describe('buildDemoProducts', () => {
  it('builds a catalogue of the size the store pages expect', () => {
    expect(products.length).toBeGreaterThanOrEqual(120);
    expect(products.length).toBeLessThanOrEqual(200);
  });

  it('gives every product and variant a negative id, so no sample can reach a Shopify checkout', () => {
    for (const product of products) {
      expect(Number.isInteger(product.id), product.handle).toBe(true);
      expect(product.id, product.handle).toBeLessThan(0);
      expect(product.variants).toHaveLength(1);
      for (const variant of product.variants) {
        expect(Number.isInteger(variant.id), product.handle).toBe(true);
        expect(variant.id, product.handle).toBeLessThan(0);
        expect(isRealVariantId(variant.id)).toBe(false);
      }
    }
  });

  it('never reuses a product id', () => {
    expect(new Set(products.map((p) => p.id)).size).toBe(products.length);
  });

  it('gives every product a unique demo- handle', () => {
    expect(new Set(products.map((p) => p.handle)).size).toBe(products.length);
    for (const product of products) expect(product.handle).toMatch(/^demo-[a-z0-9-]+$/);
  });

  it('marks every product as an unpurchasable sample quoted at zero', () => {
    for (const product of products) {
      expect(product.source).toBe('demo');
      expect(product.purchasable).toBe(false);
      expect(product.priceMinCents).toBe(0);
      expect(product.priceMaxCents).toBe(0);
      expect(product.vendor).toBe('Sample catalogue');
      expect(product.images).toEqual([]);
      expect(product.offRoadOnly).toBe(false);
      expect(product.variants[0]?.priceCents).toBe(0);
      expect(product.variants[0]?.compareAtCents).toBeNull();
      expect(product.variants[0]?.available).toBe(true);
    }
  });

  it('states fitment on every product', () => {
    for (const product of products) {
      expect(product.fitmentLabels.length, product.handle).toBeGreaterThan(0);
      expect(product.fitmentLabels.length, product.handle).toBeLessThanOrEqual(8);
    }
  });

  it('keeps the sample badge out of the title', () => {
    for (const product of products) expect(product.title).not.toMatch(/sample/i);
  });

  it('never advertises removing emissions equipment', () => {
    for (const product of products) expect(textOf(product), product.handle).not.toMatch(BANNED);
  });

  it('keeps copy short enough for the product card', () => {
    for (const product of products) {
      expect(product.summary.split(/\s+/).length, product.handle).toBeLessThanOrEqual(30);
      expect(product.bullets.length, product.handle).toBeGreaterThanOrEqual(2);
      expect(product.bullets.length, product.handle).toBeLessThanOrEqual(5);
      expect(product.intro.length).toBeGreaterThan(0);
      for (const paragraph of product.intro) expect(paragraph.split(/\s+/).length, product.handle).toBeLessThanOrEqual(40);
    }
  });

  it('only lists generation collections the shop has, and only for its own platforms', () => {
    for (const product of products) {
      for (const handle of product.generationCollections) {
        expect(COLLECTIONS.has(handle), handle).toBe(true);
        expect(product.platforms.some((platform) => handle.startsWith(`${platform}-`))).toBe(true);
      }
      if (product.platforms.length === 0) expect(product.generationCollections).toEqual([]);
    }
  });

  it('gives gas-only parts no diesel platform', () => {
    const gasOnly = products.find((p) => p.handle === 'demo-cat-back-exhaust-gas-sd-73');
    expect(gasOnly?.platforms).toEqual([]);
  });

  it('uses lowercase slug tags', () => {
    for (const product of products) {
      for (const tag of product.tags) expect(tag, product.handle).toMatch(/^[a-z0-9][a-z0-9.-]*$/);
    }
  });
});

describe('demoProductsByHandle', () => {
  it('indexes every product by its handle', () => {
    expect(byHandle.size).toBe(products.length);
    const first = products[0];
    expect(first ? byHandle.get(first.handle)?.title : null).toBe(first?.title);
  });
});

describe('fitsTruck', () => {
  const cumminsInjectors = byHandle.get('demo-performance-injectors-cum-67b');
  const duramaxIntake = byHandle.get('demo-cold-air-intake-dmax-l5p');

  it('matches the truck the part was listed for', () => {
    expect(cumminsInjectors ? fitsTruck(cumminsInjectors, 'ram-2500', 'ramhd-2013-2018') : false).toBe(true);
    expect(cumminsInjectors ? fitsTruck(cumminsInjectors, 'ram-3500') : false).toBe(true);
  });

  it('does not put a Cummins injector set on an F-150', () => {
    expect(cumminsInjectors ? fitsTruck(cumminsInjectors, 'ford-f-150', 'f150-2021') : true).toBe(false);
    expect(cumminsInjectors ? fitsTruck(cumminsInjectors, 'ford-f-150') : true).toBe(false);
  });

  it('rejects the right truck in the wrong generation', () => {
    expect(cumminsInjectors ? fitsTruck(cumminsInjectors, 'ram-2500', 'ramhd-2003-2007') : true).toBe(false);
  });

  it('matches a Duramax part to both Chevrolet and GMC', () => {
    expect(duramaxIntake ? fitsTruck(duramaxIntake, 'chevrolet-silverado-2500hd', 'gmhd-2020') : false).toBe(true);
    expect(duramaxIntake ? fitsTruck(duramaxIntake, 'gmc-sierra-3500hd', 'gmhd-2020') : false).toBe(true);
  });

  it('returns false for a product that is not part of the sample set', () => {
    const stranger = { ...products[0], handle: 'demo-not-a-real-sample' };
    expect(stranger.handle ? fitsTruck(stranger as (typeof products)[number], 'ram-2500') : true).toBe(false);
  });
});

describe('fitment data', () => {
  it('resolves every group a part family names', () => {
    const known = new Set(FITMENT_GROUPS.map((group) => group.id));
    const unknown = PART_FAMILIES.flatMap((family) => family.groups.filter((id) => !known.has(id)).map((id) => `${family.id}:${id}`));
    expect(unknown).toEqual([]);
  });

  it('resolves every group to at least one real truck generation', () => {
    for (const group of FITMENT_GROUPS) expect(group.fits.length, group.id).toBeGreaterThan(0);
  });

  it('only names truck and generation ids that exist', () => {
    for (const group of FITMENT_GROUPS) {
      for (const fit of group.fits) {
        const truck = findTruck(fit.truckId);
        expect(truck, fit.truckId).not.toBeNull();
        expect(truck?.generations.some((generation) => generation.id === fit.generationId), `${fit.truckId}/${fit.generationId}`).toBe(true);
      }
    }
  });
});

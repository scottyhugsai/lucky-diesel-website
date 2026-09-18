import { describe, expect, test } from 'vitest';
import type { StoreProduct } from '@/lib/store/normalize';
import { featuredProducts, generationInfo, listingTruckFilter, parseStoreParams, priceLabel, productsHref, relatedProducts, savedTruckLabel, sortProducts, truckLabel } from './listing';
import { truckFromFitment, truckFromSelection } from '@/lib/fitment/truck-cookie';

const product = (over: Partial<StoreProduct>): StoreProduct => ({
  id: 1, handle: 'x', source: 'shopify', purchasable: true, title: 'X', vendor: 'DDP', category: 'turbo', platforms: ['duramax'], generationCollections: [],
  fitmentLabels: [], offRoadOnly: false, tags: [], priceMinCents: 1000, priceMaxCents: 1000, available: true, options: [], variants: [],
  images: [{ src: 'a.jpg', width: 1, height: 1, alt: '' }], summary: '', intro: [], bullets: [], ...over,
});

describe('listing params', () => {
  test('keeps valid values and drops the rest', () => {
    expect(parseStoreParams({ category: 'fuel', platform: 'duramax', gen: 'duramax-2017-present-l5p', q: ' cp3 ', sort: 'price-asc' }))
      .toEqual({ category: 'fuel', platform: 'duramax', gen: 'duramax-2017-present-l5p', q: 'cp3', sort: 'price-asc', all: false });
    expect(parseStoreParams({ category: 'nope', platform: 'cummins', gen: 'duramax-2017-present-l5p', sort: ['bad'] }))
      .toEqual({ category: null, platform: 'cummins', gen: null, q: '', sort: 'featured', all: false });
  });

  test('builds short hrefs', () => {
    expect(productsHref({})).toBe('/store/products');
    expect(productsHref({ gen: 'duramax-2017-present-l5p' })).toBe('/store/products');
    expect(productsHref({ platform: 'duramax', gen: 'duramax-2017-present-l5p', sort: 'featured' }))
      .toBe('/store/products?platform=duramax&gen=duramax-2017-present-l5p');
  });
});

describe('sorting and labels', () => {
  const cheap = product({ handle: 'cheap', priceMinCents: 100 });
  const pricey = product({ handle: 'pricey', priceMinCents: 900 });
  const gone = product({ handle: 'gone', priceMinCents: 50, available: false });

  test('sorts by price with sold-out items last, without mutating', () => {
    const input = [pricey, gone, cheap];
    expect(sortProducts(input, 'price-asc').map((p) => p.handle)).toEqual(['cheap', 'pricey', 'gone']);
    expect(sortProducts(input, 'price-desc').map((p) => p.handle)).toEqual(['pricey', 'cheap', 'gone']);
    expect(sortProducts(input, 'featured').map((p) => p.handle)).toEqual(['pricey', 'cheap', 'gone']);
    expect(input.map((p) => p.handle)).toEqual(['pricey', 'gone', 'cheap']);
  });

  test('shows "From" only for price ranges', () => {
    expect(priceLabel({ priceMinCents: 325000, priceMaxCents: 425000, purchasable: true })).toBe('From $3,250');
    expect(priceLabel({ priceMinCents: 2599, priceMaxCents: 2599, purchasable: true })).toBe('$25.99');
  });

  test('says "Quote" for a sample listing rather than inventing a price', () => {
    expect(priceLabel({ priceMinCents: 0, priceMaxCents: 0, purchasable: false })).toBe('Quote');
  });

  test('names generations', () => {
    expect(generationInfo('duramax-2017-present-l5p')).toEqual({ platform: 'duramax', name: '2017–Present L5P 6.6L', short: 'L5P' });
    expect(generationInfo('cummins-2019-present-6-7l')?.short).toBe('2019–Present 6.7L');
    expect(generationInfo('unknown')).toBeNull();
    expect(truckLabel({ platform: 'powerstroke', generationCollection: null })).toBe('Powerstroke');
  });
});

describe('related and featured', () => {
  test('related shares category and platform', () => {
    const base = product({ handle: 'base' });
    const all = [base, product({ handle: 'same' }), product({ handle: 'ford', platforms: ['powerstroke'] }), product({ handle: 'fuel', category: 'fuel' })];
    expect(relatedProducts(all, base).map((p) => p.handle)).toEqual(['same']);
    const l5p = product({ handle: 'l5p', generationCollections: ['duramax-2017-present-l5p'] });
    const lml = product({ handle: 'lml', generationCollections: ['duramax-2011-2016-lml'] });
    const twin = product({ handle: 'twin', generationCollections: ['duramax-2017-present-l5p'] });
    expect(relatedProducts([l5p, lml, twin], l5p).map((p) => p.handle)).toEqual(['twin', 'lml']);
  });

  test('featured round-robins categories and skips unphotographed or sold-out items', () => {
    const all = [
      product({ handle: 't1' }), product({ handle: 't2' }), product({ handle: 'f1', category: 'fuel' }),
      product({ handle: 'f0', category: 'fuel', images: [] }), product({ handle: 'tx', available: false }),
    ];
    expect(featuredProducts(all, ['turbo', 'fuel'], 3).map((p) => p.handle)).toEqual(['t1', 'f1', 't2']);
  });
});

describe('sample listings never outrank real ones', () => {
  const real = product({ handle: 'real', priceMinCents: 100000, available: true, purchasable: true });
  const sample = product({ handle: 'sample', priceMinCents: 0, available: true, purchasable: false, source: 'demo' });

  test('cheapest-first does not put a priceless sample at the top', () => {
    expect(sortProducts([sample, real], 'price-asc').map((p) => p.handle)).toEqual(['real', 'sample']);
  });

  test('the default order puts buyable parts first', () => {
    expect(sortProducts([sample, real], 'featured').map((p) => p.handle)).toEqual(['real', 'sample']);
  });
});

describe('the saved truck on a listing', () => {
  const l5p = truckFromFitment({ year: 2020, make: 'chevrolet', model: 'chevrolet-silverado-2500hd', engine: 'gm-6-6-l5p' });
  const platformOnly = truckFromSelection('cummins', null);
  const base = parseStoreParams({});

  test('names the truck the way a shopper would', () => {
    expect(savedTruckLabel(l5p)).toBe('2020 L5P');
    expect(savedTruckLabel(platformOnly)).toBe('Cummins');
    expect(savedTruckLabel(null)).toBeNull();
  });

  test('filters to the saved truck when nothing was asked for', () => {
    expect(listingTruckFilter(base, l5p)).toEqual({ platform: 'duramax', gen: 'duramax-2017-present-l5p', fromSavedTruck: true });
  });

  test('an explicit filter beats the saved truck', () => {
    const asked = parseStoreParams({ platform: 'cummins' });
    expect(listingTruckFilter(asked, l5p)).toEqual({ platform: 'cummins', gen: null, fromSavedTruck: false });
  });

  test('"show everything" sets the truck aside without clearing it', () => {
    expect(listingTruckFilter(parseStoreParams({ all: '1' }), l5p)).toEqual({ platform: null, gen: null, fromSavedTruck: false });
    expect(productsHref({ ...base, all: true })).toBe('/store/products?all=1');
  });

  test('no saved truck means no filter', () => {
    expect(listingTruckFilter(base, null)).toEqual({ platform: null, gen: null, fromSavedTruck: false });
  });
});

describe('related parts ranked for the saved truck', () => {
  const lml = truckFromSelection('duramax', 'duramax-2011-2016-lml');
  const base = product({ handle: 'subject', category: 'turbo', platforms: ['duramax'], generationCollections: [] });
  const wrongGen = product({ handle: 'wrong-gen', category: 'turbo', platforms: ['duramax'], generationCollections: ['duramax-2017-present-l5p'] });
  const rightGen = product({ handle: 'right-gen', category: 'turbo', platforms: ['duramax'], generationCollections: ['duramax-2011-2016-lml'] });

  test('puts parts that fit the truck first', () => {
    const ranked = relatedProducts([base, wrongGen, rightGen], base, 4, lml);
    expect(ranked.map((p) => p.handle)).toEqual(['right-gen', 'wrong-gen']);
  });

  test('without a truck it keeps the existing order', () => {
    expect(relatedProducts([base, wrongGen, rightGen], base, 4).map((p) => p.handle)).toEqual(['wrong-gen', 'right-gen']);
  });
});

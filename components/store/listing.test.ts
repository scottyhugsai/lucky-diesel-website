import { describe, expect, test } from 'vitest';
import type { StoreProduct } from '@/lib/store/normalize';
import { featuredProducts, generationInfo, parseStoreParams, priceLabel, productsHref, relatedProducts, sortProducts, truckLabel } from './listing';

const product = (over: Partial<StoreProduct>): StoreProduct => ({
  id: 1, handle: 'x', title: 'X', vendor: 'DDP', category: 'turbo', platforms: ['duramax'], generationCollections: [],
  offRoadOnly: false, tags: [], priceMinCents: 1000, priceMaxCents: 1000, available: true, options: [], variants: [],
  images: [{ src: 'a.jpg', width: 1, height: 1, alt: '' }], summary: '', intro: [], bullets: [], ...over,
});

describe('listing params', () => {
  test('keeps valid values and drops the rest', () => {
    expect(parseStoreParams({ category: 'fuel', platform: 'duramax', gen: 'duramax-2017-present-l5p', q: ' cp3 ', sort: 'price-asc' }))
      .toEqual({ category: 'fuel', platform: 'duramax', gen: 'duramax-2017-present-l5p', q: 'cp3', sort: 'price-asc' });
    expect(parseStoreParams({ category: 'nope', platform: 'cummins', gen: 'duramax-2017-present-l5p', sort: ['bad'] }))
      .toEqual({ category: null, platform: 'cummins', gen: null, q: '', sort: 'featured' });
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
    expect(priceLabel({ priceMinCents: 325000, priceMaxCents: 425000 })).toBe('From $3,250');
    expect(priceLabel({ priceMinCents: 2599, priceMaxCents: 2599 })).toBe('$25.99');
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

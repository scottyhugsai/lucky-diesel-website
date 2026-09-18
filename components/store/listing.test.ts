import { describe, expect, test } from 'vitest';
import type { StoreProduct } from '@/lib/store/normalize';
import { countStocked, featuredProducts, pageWindow, firstExampleIndex, generationInfo, listingTruckFilter, paginate, parseStoreParams, priceLabel, productsHref, relatedProducts, savedTruckLabel, sortProducts, stockedFirst, truckLabel } from './listing';
import { truckFromFitment, truckFromSelection } from '@/lib/fitment/truck-cookie';

const product = (over: Partial<StoreProduct>): StoreProduct => ({
  id: 1, handle: 'x', source: 'shopify', purchasable: true, title: 'X', vendor: 'DDP', category: 'turbo', platforms: ['duramax'], generationCollections: [],
  fitmentLabels: [], offRoadOnly: false, tags: [], priceMinCents: 1000, priceMaxCents: 1000, available: true, options: [], variants: [],
  images: [{ src: 'a.jpg', width: 1, height: 1, alt: '' }], summary: '', intro: [], bullets: [], ...over,
});

describe('listing params', () => {
  test('keeps valid values and drops the rest', () => {
    expect(parseStoreParams({ category: 'fuel', platform: 'duramax', gen: 'duramax-2017-present-l5p', q: ' cp3 ', sort: 'price-asc' }))
      .toEqual({ category: 'fuel', platform: 'duramax', gen: 'duramax-2017-present-l5p', q: 'cp3', sort: 'price-asc', all: false, stocked: false, page: 1 });
    expect(parseStoreParams({ category: 'nope', platform: 'cummins', gen: 'duramax-2017-present-l5p', sort: ['bad'] }))
      .toEqual({ category: null, platform: 'cummins', gen: null, q: '', sort: 'featured', all: false, stocked: false, page: 1 });
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

describe('paging a long listing', () => {
  const items = Array.from({ length: 50 }, (_, i) => i);

  test('slices the requested page and reports where you are', () => {
    expect(paginate(items, 1, 24)).toMatchObject({ page: 1, pages: 3, total: 50, from: 1, to: 24 });
    expect(paginate(items, 1, 24).items).toEqual(items.slice(0, 24));
    expect(paginate(items, 3, 24)).toMatchObject({ page: 3, pages: 3, from: 49, to: 50 });
    expect(paginate(items, 3, 24).items).toEqual([48, 49]);
  });

  test('clamps a page number out of range rather than showing nothing', () => {
    expect(paginate(items, 99, 24).page).toBe(3);
    expect(paginate(items, 0, 24).page).toBe(1);
    expect(paginate(items, -5, 24).items).toEqual(items.slice(0, 24));
  });

  test('an empty result is one page, not zero', () => {
    expect(paginate([], 1, 24)).toEqual({ items: [], page: 1, pages: 1, total: 0, from: 0, to: 0 });
  });

  test('does not mutate the input', () => {
    const input = [3, 1, 2];
    paginate(input, 1, 2);
    expect(input).toEqual([3, 1, 2]);
  });
});

describe('page and stocked params', () => {
  test('reads a page number and drops nonsense', () => {
    expect(parseStoreParams({ page: '4' }).page).toBe(4);
    expect(parseStoreParams({ page: 'nope' }).page).toBe(1);
    expect(parseStoreParams({ page: '-2' }).page).toBe(1);
    expect(parseStoreParams({ page: '0' }).page).toBe(1);
  });

  test('reads the stocked-only flag', () => {
    expect(parseStoreParams({ stocked: '1' }).stocked).toBe(true);
    expect(parseStoreParams({}).stocked).toBe(false);
  });

  test('keeps page and stocked in the URL, and page 1 out of it', () => {
    expect(productsHref({ page: 1 })).toBe('/store/products');
    expect(productsHref({ page: 3 })).toBe('/store/products?page=3');
    expect(productsHref({ stocked: true })).toBe('/store/products?stocked=1');
    expect(productsHref({ category: 'fuel', stocked: true, page: 2 })).toBe('/store/products?category=fuel&stocked=1&page=2');
  });
});

describe('sample listings are kept behind the real catalogue', () => {
  const real = product({ handle: 'real' });
  const other = product({ handle: 'other' });
  const sample = product({ handle: 'sample', purchasable: false, source: 'demo' });

  test('examples sort after everything the shop actually sells', () => {
    expect(stockedFirst([sample, real, other]).map((p) => p.handle)).toEqual(['real', 'other', 'sample']);
  });

  test('order inside each group is left alone, and the input is not mutated', () => {
    const input = [other, sample, real];
    expect(stockedFirst(input).map((p) => p.handle)).toEqual(['other', 'real', 'sample']);
    expect(input.map((p) => p.handle)).toEqual(['other', 'sample', 'real']);
  });

  test('counts the split so the page can say it out loud', () => {
    expect(countStocked([real, other, sample])).toEqual({ stocked: 2, examples: 1 });
    expect(countStocked([])).toEqual({ stocked: 0, examples: 0 });
  });

  test('the first example on a page is where the divider goes', () => {
    expect(firstExampleIndex([real, other, sample])).toBe(2);
    expect(firstExampleIndex([sample, real])).toBe(0);
    expect(firstExampleIndex([real, other])).toBe(-1);
  });
});

describe('the page-number window', () => {
  test('shows every page while they still fit', () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(3, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  test('keeps the first, last and current pages, with gaps between', () => {
    expect(pageWindow(1, 10)).toEqual([1, 2, 3, null, 10]);
    expect(pageWindow(6, 10)).toEqual([1, null, 5, 6, 7, null, 10]);
    expect(pageWindow(10, 10)).toEqual([1, null, 8, 9, 10]);
  });

  test('never draws a gap that hides a single page', () => {
    expect(pageWindow(4, 6)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

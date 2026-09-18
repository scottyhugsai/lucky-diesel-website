import { describe, expect, it } from 'vitest';
import type { StoreProduct } from './normalize';
import { MAX_COMPARE, compareRows, parseCompare, sizeOf, supportedPowerOf } from './specs';

const product = (over: Partial<StoreProduct>): StoreProduct => ({
  id: 1, handle: 'a', source: 'shopify', purchasable: true, title: 'A', vendor: 'DDP',
  category: 'turbo', platforms: ['duramax'], generationCollections: [], fitmentLabels: [], offRoadOnly: false,
  tags: [], priceMinCents: 100000, priceMaxCents: 100000, available: true, options: [], variants: [],
  images: [], summary: '', intro: [], bullets: [], ...over,
});

describe('sizeOf', () => {
  it('reads the compressor size out of a turbo title', () => {
    expect(sizeOf(product({ title: 'DDP Dominator 72mm Turbocharger 05-10' }))).toBe('72 mm');
  });

  it('reads how far over stock an injector set is', () => {
    expect(sizeOf(product({ category: 'fuel', title: 'DDP 2003-2004 6.0 Powerstroke Reman 30% over Injector Set' }))).toBe('30% over stock');
  });

  it('says nothing rather than guessing', () => {
    expect(sizeOf(product({ title: 'Lucky Diesel Hat' }))).toBeNull();
    // A year range is not a size.
    expect(sizeOf(product({ title: 'Tuning Package 2015-2016' }))).toBeNull();
  });
});

describe('supportedPowerOf', () => {
  it('finds the figure the manufacturer quotes', () => {
    const p = product({ summary: 'Designed to support up to 900-950 horsepower with the proper fuel modifications.' });
    expect(supportedPowerOf(p)).toBe('900-950 hp');
  });

  it('reads a single figure too', () => {
    expect(supportedPowerOf(product({ intro: ['Supports 650hp when fuelled correctly.'] }))).toBe('650 hp');
  });

  it('returns null when nothing is quoted', () => {
    expect(supportedPowerOf(product({ summary: 'A very good turbocharger.' }))).toBeNull();
  });
});

describe('compareRows', () => {
  const turbo = product({ handle: 'turbo', title: 'DDP Dominator 72mm Turbocharger', priceMinCents: 349500, fitmentLabels: ['2005–2010 Duramax'] });
  const injectors = product({ handle: 'inj', title: 'DDP 30% over Injector Set', category: 'fuel', priceMinCents: 310000, available: false });

  it('builds one row per spec, with a value for each product', () => {
    const rows = compareRows([turbo, injectors]);
    expect(rows.length).toBeGreaterThan(4);
    for (const row of rows) expect(row.values).toHaveLength(2);
  });

  it('explains what each spec means, not just what it is', () => {
    for (const row of compareRows([turbo, injectors])) {
      expect(row.label.length, row.key).toBeGreaterThan(0);
      expect(row.meaning.length, row.key).toBeGreaterThan(12);
    }
  });

  it('drops a row no product has anything to say about', () => {
    const rows = compareRows([product({ handle: 'x', title: 'Hat', category: 'merch' })]);
    expect(rows.some((row) => row.key === 'size')).toBe(false);
  });

  it('marks a sold-out part rather than hiding it', () => {
    const stock = compareRows([turbo, injectors]).find((row) => row.key === 'stock');
    expect(stock?.values).toEqual(['In stock', 'Sold out']);
  });

  it('never prices a sample listing', () => {
    const demo = product({ handle: 'demo-x', source: 'demo', purchasable: false, priceMinCents: 0 });
    const price = compareRows([demo]).find((row) => row.key === 'price');
    expect(price?.values[0]).toBe('Quote');
  });
});

describe('parseCompare', () => {
  it('keeps valid handles, in order, de-duplicated and capped', () => {
    expect(parseCompare('a,b,a,c,d,e,f')).toEqual(['a', 'b', 'c', 'd'].slice(0, MAX_COMPARE));
  });

  it('drops anything that is not a handle', () => {
    expect(parseCompare('a,../../etc,<script>,b')).toEqual(['a', 'b']);
    expect(parseCompare(undefined)).toEqual([]);
    expect(parseCompare(['a', 'b'])).toEqual(['a', 'b']);
  });
});

describe('emissions row', () => {
  const turbo = product({ handle: 'turbo', category: 'turbo' });

  it('prints a recorded EO number so a customer can check it themselves', () => {
    const map = new Map([['turbo', { status: 'carb_eo' as const, eoNumber: 'D-123-45' }]]);
    const row = compareRows([turbo], map).find((entry) => entry.key === 'emissions');
    expect(row?.values[0]).toBe('CARB EO D-123-45');
  });

  it('says it is not documented rather than implying either way', () => {
    const row = compareRows([turbo]).find((entry) => entry.key === 'emissions');
    expect(row?.values[0]).toBe('Ask us — not documented yet');
  });

  it('does not raise emissions for a part that has none', () => {
    const row = compareRows([product({ handle: 'hat', category: 'merch' })]).find((entry) => entry.key === 'emissions');
    expect(row?.values[0]).toBe('No emissions impact');
  });
});

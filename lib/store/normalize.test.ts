import { describe, expect, test } from 'vitest';
import fixture from './__fixtures__/products.json';
import { fitsTruck, normalizeProduct, parseDescription, type ShopifyProduct } from './normalize';

const raw = fixture.products as unknown as ShopifyProduct[];
const byTitle = (part: string) => {
  const product = raw.find((p) => p.title.includes(part));
  if (!product) throw new Error(`fixture missing ${part}`);
  return normalizeProduct(product, new Map());
};

describe('normalizeProduct', () => {
  test('categorises by type, tags and title', () => {
    expect(byTitle('CP3 Conversion').category).toBe('fuel');
    expect(byTitle('Turbocharger').category).toBe('turbo');
    expect(byTitle('Transmission Tuning').category).toBe('tuning');
    expect(byTitle('Tee').category).toBe('merch');
    expect(byTitle('exhaust').category).toBe('exhaust');
    expect(byTitle('AutoAgent').category).toBe('tuning');
  });

  test('reads platforms from tags and treats merch as universal', () => {
    expect(byTitle('CP3 Conversion').platforms).toEqual(['duramax']);
    expect(byTitle('Transmission Tuning').platforms).toEqual(['powerstroke']);
    expect(byTitle('Tee').platforms).toEqual([]);
  });

  test('trusts a title that names one platform over conflicting store tags', () => {
    const cummins = { ...raw[0]!, title: 'DDP 2004.5-2007 5.9L Cummins Performance Injector Set', tags: ['Cummins', 'Duramax', 'Duramax 2004.5-2005 LLY'] };
    expect(normalizeProduct(cummins, new Map()).platforms).toEqual(['cummins']);
  });

  test('flags off-road-only products', () => {
    expect(byTitle('Transmission Tuning').offRoadOnly).toBe(true);
    expect(byTitle('CP3 Conversion').offRoadOnly).toBe(false);
  });

  test('prices in cents with a min/max range across variants', () => {
    const kit = byTitle('CP3 Conversion');
    expect(kit.priceMinCents).toBeGreaterThan(0);
    expect(kit.priceMaxCents).toBeGreaterThanOrEqual(kit.priceMinCents);
    expect(Number.isInteger(kit.priceMinCents)).toBe(true);
    expect(kit.variants[0]!.priceCents).toBe(Math.round(Number(raw[0]!.variants[0]!.price) * 100));
  });

  test('keeps variant option values and availability', () => {
    const kit = byTitle('CP3 Conversion');
    expect(kit.options[0]!.name).toBe('Pump Configuration');
    expect(kit.variants[0]!.optionValues[0]).toMatch(/mm CP3/);
    expect(typeof kit.variants[0]!.available).toBe('boolean');
  });

  test('uses collection membership for generation fitment', () => {
    const kitRaw = raw.find((p) => p.title.includes('CP3 Conversion'))!;
    const kit = normalizeProduct(kitRaw, new Map([[kitRaw.handle, ['duramax-2017-present-l5p']]]));
    expect(kit.generationCollections).toEqual(['duramax-2017-present-l5p']);
  });
});

describe('fitsTruck', () => {
  const kitRaw = raw.find((p) => p.title.includes('CP3 Conversion'))!;
  const kit = normalizeProduct(kitRaw, new Map([[kitRaw.handle, ['duramax-2017-present-l5p']]]));

  test('matches the exact generation', () => {
    expect(fitsTruck(kit, { platform: 'duramax', generationCollection: 'duramax-2017-present-l5p' })).toBe('fits');
  });

  test('rejects another platform', () => {
    expect(fitsTruck(kit, { platform: 'cummins', generationCollection: null })).toBe('no');
  });

  test('is "platform" when only the platform is known', () => {
    expect(fitsTruck(kit, { platform: 'duramax', generationCollection: null })).toBe('platform');
  });

  test('rejects a different generation of the same platform', () => {
    expect(fitsTruck(kit, { platform: 'duramax', generationCollection: 'duramax-2001-2004-lb7' })).toBe('no');
  });

  test('universal products fit everything', () => {
    expect(fitsTruck(byTitle('Tee'), { platform: 'cummins', generationCollection: 'cummins-2019-present-6-7l' })).toBe('universal');
  });
});

describe('parseDescription', () => {
  test('turns Shopify HTML into plain intro text and bullets', () => {
    const parsed = parseDescription('<p><strong>Big</strong> turbo &amp; more.</p><ul><li><strong>Fitment:</strong> 2017+ L5P</li><li>Billet wheel</li></ul><script>alert(1)</script>');
    expect(parsed.intro).toEqual(['Big turbo & more.']);
    expect(parsed.bullets).toEqual([{ label: 'Fitment', text: '2017+ L5P' }, { label: null, text: 'Billet wheel' }]);
    expect(JSON.stringify(parsed)).not.toContain('<');
    expect(JSON.stringify(parsed)).not.toContain('alert');
  });

  test('summarises in one short sentence', () => {
    const parsed = parseDescription('<p>Converts the factory system. Choose 10, 12 or 14mm.</p>');
    expect(parsed.summary).toBe('Converts the factory system.');
  });

  test('handles empty descriptions', () => {
    expect(parseDescription('')).toEqual({ summary: '', intro: [], bullets: [] });
  });
});

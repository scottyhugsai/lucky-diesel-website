import { describe, expect, it } from 'vitest';
import type { StoreProduct } from '@/lib/store/normalize';
import { productJsonLd } from './product-json-ld';

const product = (over: Partial<StoreProduct>): StoreProduct => ({
  id: 1, handle: 'p', source: 'shopify', purchasable: true, title: 'Stage 2 Turbocharger', vendor: 'DDP',
  category: 'turbo', platforms: ['duramax'], generationCollections: [], fitmentLabels: [], offRoadOnly: false,
  tags: [], priceMinCents: 100000, priceMaxCents: 100000, available: true, options: [], variants: [],
  images: [{ src: 'a.jpg', width: 1, height: 1, alt: '' }], summary: '', intro: [], bullets: [], ...over,
});

const URL = 'https://example.com/store/products/p';

describe('productJsonLd', () => {
  it('publishes an ordinary part', () => {
    expect(productJsonLd(product({}), URL, 'Lucky Diesel')).toMatchObject({ '@type': 'Product', name: 'Stage 2 Turbocharger' });
  });

  it('publishes nothing for a sample listing', () => {
    expect(productJsonLd(product({ purchasable: false }), URL, 'Lucky Diesel')).toBeNull();
  });

  // The shop's live catalogue contains a kit whose OPTION VALUES are the
  // problem: "Race Pipe" and "EGR Kit" are choices, not words in the title.
  // The claims checker already catches it for promotional slots. Schema is a
  // published offer for sale, read by machines, so it has to clear the same bar.
  it('publishes nothing for a listing whose options offer a defeat device', () => {
    const diyKit = product({
      title: '2011-2019 6.7L Powerstroke DIY Kit',
      options: [{ name: 'Exhaust', values: ['Race Pipe', 'Stock'] }, { name: 'EGR', values: ['EGR Kit', 'None'] }],
    });
    expect(productJsonLd(diyKit, URL, 'Lucky Diesel')).toBeNull();
  });

  it('publishes nothing for an off-road-only part', () => {
    expect(productJsonLd(product({ offRoadOnly: true }), URL, 'Lucky Diesel')).toBeNull();
  });
});

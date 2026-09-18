import { describe, expect, it } from 'vitest';
import type { ProductOverride } from '@/lib/site-content/registry';
import { applyOverrides, featuredFirst } from './overrides';
import type { StoreProduct } from './normalize';

const base = (over: Partial<StoreProduct>): StoreProduct => ({
  id: 1, handle: 'turbo', source: 'shopify', purchasable: true, title: 'Stock turbo', vendor: 'DDP',
  category: 'turbo', platforms: ['duramax'], generationCollections: [], fitmentLabels: [], offRoadOnly: false,
  tags: [], priceMinCents: 100000, priceMaxCents: 100000, available: true, options: [], variants: [],
  images: [{ src: 'stock.jpg', width: 10, height: 10, alt: '' }], summary: 'Stock summary', intro: [], bullets: [], ...over,
});

const noOverride: ProductOverride = { hidden: false, title: null, summary: null, badges: [], fitment: [], images: [], featuredSort: null };
const lookup = (map: Record<string, Partial<ProductOverride>>) => (handle: string): ProductOverride => ({ ...noOverride, ...map[handle] });

describe('applyOverrides', () => {
  it('leaves a product untouched when nothing is overridden', () => {
    const [product] = applyOverrides([base({})], lookup({}));
    expect(product).toEqual(base({}));
  });

  it('replaces the title and short description', () => {
    const [product] = applyOverrides([base({})], lookup({ turbo: { title: 'Our turbo', summary: 'Our words' } }));
    expect(product?.title).toBe('Our turbo');
    expect(product?.summary).toBe('Our words');
  });

  it('puts the owner’s photos first and keeps the store’s behind them', () => {
    const [product] = applyOverrides([base({})], lookup({ turbo: { images: ['/images/mine.jpg'] } }));
    expect(product?.images.map((image) => image.src)).toEqual(['/images/mine.jpg', 'stock.jpg']);
  });

  it('drops hidden products entirely', () => {
    expect(applyOverrides([base({})], lookup({ turbo: { hidden: true } }))).toEqual([]);
  });

  it('adds pinned fitment without losing what the store already knew', () => {
    const [product] = applyOverrides([base({ generationCollections: ['duramax-2011-2016-lml'] })], lookup({ turbo: { fitment: ['duramax-2017-present-l5p'] } }));
    expect(product?.generationCollections).toEqual(['duramax-2011-2016-lml', 'duramax-2017-present-l5p']);
  });

  it('pins a platform named in the fitment list', () => {
    const [product] = applyOverrides([base({ platforms: [] })], lookup({ turbo: { fitment: ['cummins'] } }));
    expect(product?.platforms).toEqual(['cummins']);
  });

  it('never makes a sample part buyable', () => {
    const demo = base({ source: 'demo', purchasable: false, handle: 'demo-turbo', id: -1 });
    const [product] = applyOverrides([demo], lookup({ 'demo-turbo': { title: 'Renamed' } }));
    expect(product?.purchasable).toBe(false);
    expect(product?.source).toBe('demo');
  });
});

describe('featuredFirst', () => {
  const a = base({ handle: 'a', title: 'A' });
  const b = base({ handle: 'b', title: 'B' });
  const c = base({ handle: 'c', title: 'C' });

  it('orders featured products by their slot, then the rest as they came', () => {
    const order = featuredFirst([a, b, c], lookup({ c: { featuredSort: 1 }, a: { featuredSort: 2 } }));
    expect(order.map((product) => product.handle)).toEqual(['c', 'a', 'b']);
  });

  it('leaves the order alone when nothing is featured', () => {
    expect(featuredFirst([a, b, c], lookup({})).map((product) => product.handle)).toEqual(['a', 'b', 'c']);
  });
});

describe('sample listings and search engines', () => {
  it('publishes no structured data for a part that is not for sale', async () => {
    const { productJsonLd } = await import('@/components/store/product-json-ld');
    const demo = base({ source: 'demo', purchasable: false, priceMinCents: 0, priceMaxCents: 0 });
    expect(productJsonLd(demo, 'https://example.com/x', 'Lucky Diesel')).toBeNull();
    expect(productJsonLd(base({}), 'https://example.com/x', 'Lucky Diesel')).not.toBeNull();
  });
});

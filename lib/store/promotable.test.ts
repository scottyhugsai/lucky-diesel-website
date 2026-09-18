import { describe, expect, it } from 'vitest';
import type { StoreProduct } from './normalize';
import { isSafeToPromote, promotableText } from './promotable';

const product = (over: Partial<StoreProduct>): StoreProduct => ({
  id: 1, handle: 'p', source: 'shopify', purchasable: true, title: 'Stage 2 Turbocharger', vendor: 'DDP',
  category: 'turbo', platforms: ['duramax'], generationCollections: [], fitmentLabels: [], offRoadOnly: false,
  tags: [], priceMinCents: 100000, priceMaxCents: 100000, available: true, options: [], variants: [],
  images: [{ src: 'a.jpg', width: 1, height: 1, alt: '' }], summary: '', intro: [], bullets: [], ...over,
});

describe('promotableText', () => {
  it('gathers everything a shopper would read, including option values', () => {
    const text = promotableText(product({
      title: 'DIY Kit',
      tags: ['powerstroke'],
      options: [{ name: 'Pipe', values: ['Race Pipe', 'Stock'] }],
      summary: 'A kit.',
      bullets: [{ label: 'Includes', text: 'clamps' }],
    }));
    expect(text).toContain('DIY Kit');
    expect(text).toContain('Race Pipe');
    expect(text).toContain('clamps');
    expect(text).toContain('powerstroke');
  });
});

describe('isSafeToPromote', () => {
  it('promotes an ordinary performance part', () => {
    expect(isSafeToPromote(product({}))).toBe(true);
  });

  it('refuses a part whose options offer a race pipe', () => {
    expect(isSafeToPromote(product({ options: [{ name: 'Pipe', values: ['Race Pipe', 'Stock'] }] }))).toBe(false);
  });

  it('refuses anything that names an EGR or DPF delete', () => {
    expect(isSafeToPromote(product({ title: 'EGR Delete Kit' }))).toBe(false);
    expect(isSafeToPromote(product({ summary: 'Includes a DPF delete pipe.' }))).toBe(false);
    expect(isSafeToPromote(product({ tags: ['dpf-delete'] }))).toBe(false);
  });

  it('refuses off-road-only parts', () => {
    expect(isSafeToPromote(product({ offRoadOnly: true }))).toBe(false);
  });

  it('refuses sample listings — a promotion should point at something buyable', () => {
    expect(isSafeToPromote(product({ source: 'demo', purchasable: false }))).toBe(false);
  });

  it('still promotes a turbo the owner has not filed CARB paperwork for', () => {
    // "Unverified" is every performance part until it is tagged; excluding them
    // would leave a diesel shop promoting nothing but t-shirts.
    expect(isSafeToPromote(product({ category: 'tuning', title: 'EZ Lynk Tuning Package' }))).toBe(true);
  });
});

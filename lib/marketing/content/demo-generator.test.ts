import { describe, expect, test } from 'vitest';
import { AD_LIMITS } from './brand';
import { checkContent } from './compliance';
import { generateDemoVariants } from './demo-generator';
import type { BuildRef, CreativeBrief, ProductRef } from './types';

const build: BuildRef = {
  id: 'b1', slug: 'l5p', title: 'Purple-piped L5P', vehicleLabel: 'GMC Sierra 2500HD L5P', platform: 'duramax',
  beforeHp: 445, afterHp: 560, beforeTorque: 910, afterTorque: 1150, parts: ['DDP Stage 2 turbo'], image: '/images/build-l5p-purple.jpg', isSample: true,
};

const product: ProductRef = {
  handle: 'ddp-turbo', title: 'DDP Stage 2 Turbo', vendor: 'Dan’s Diesel Performance', category: 'turbo',
  priceFromCents: 169500, image: 'https://cdn.example/turbo.png', platforms: ['duramax'], offRoadOnly: false,
};

describe('generateDemoVariants', () => {
  test('returns the requested number of labelled demo variants', () => {
    const variants = generateDemoVariants({ goal: 'leads', platform: 'meta', subject: { kind: 'build', build }, count: 5 });
    expect(variants).toHaveLength(5);
    expect(variants.every((v) => v.generator === 'demo')).toBe(true);
    expect(new Set(variants.map((v) => v.label)).size).toBe(5);
    expect(new Set(variants.map((v) => v.angle)).size).toBeGreaterThan(1);
  });

  test('is deterministic for the same brief and seed', () => {
    const brief: CreativeBrief = { goal: 'sales', platform: 'meta', subject: { kind: 'product', product }, seed: 'x' };
    expect(generateDemoVariants(brief)).toEqual(generateDemoVariants(brief));
  });

  test('respects platform character limits', () => {
    for (const platform of ['meta', 'google_pmax', 'google_search', 'tiktok'] as const) {
      const limits = AD_LIMITS[platform];
      for (const v of generateDemoVariants({ goal: 'leads', platform, subject: { kind: 'season', season: 'tow_season' }, count: 8 })) {
        expect(v.headline.length).toBeLessThanOrEqual(limits.headline);
        expect(v.primaryText.length).toBeLessThanOrEqual(limits.primary);
        if (limits.description) expect((v.description ?? '').length).toBeLessThanOrEqual(limits.description);
        expect(limits.ctas).toContain(v.cta);
        expect(v.primaryText).not.toMatch(/\{|\}/);
      }
    }
  });

  test('uses real build numbers and never leaves placeholders', () => {
    const variants = generateDemoVariants({ goal: 'leads', platform: 'meta', subject: { kind: 'dyno', build }, count: 4 });
    const text = variants.map((v) => `${v.headline} ${v.primaryText}`).join(' ');
    expect(text).toMatch(/560|1150|115/);
    expect(variants[0]!.imageTemplate).toBe('dyno');
    expect(variants[0]!.imageParams.afterHp).toBe(560);
  });

  test('clean seasonal copy passes compliance', () => {
    const variants = generateDemoVariants({ goal: 'bookings', platform: 'google_pmax', subject: { kind: 'season', season: 'hurricane_prep' } });
    expect(variants.every((v) => v.complianceStatus !== 'block')).toBe(true);
  });

  test('blocks variants for risky products and records the issues', () => {
    const risky: ProductRef = { ...product, handle: 'dpf-pipe', title: 'DPF Delete Pipe', offRoadOnly: true };
    const variants = generateDemoVariants({ goal: 'sales', platform: 'meta', subject: { kind: 'product', product: risky }, count: 3 });
    expect(variants.length).toBe(3);
    for (const v of variants) {
      expect(v.complianceStatus).toBe('block');
      expect(v.complianceIssues.map((i) => i.term)).toContain('off-road-only SKU');
    }
    expect(variants.some((v) => v.complianceIssues.some((i) => i.term !== 'off-road-only SKU' && i.severity === 'block'))).toBe(true);
  });
});

describe('checkContent', () => {
  test('blocks emissions and review-incentive language, warns on tuning claims', () => {
    expect(checkContent(['EGR delete kits in stock']).status).toBe('block');
    expect(checkContent(['Straight pipe sound, no inspections in SC']).status).toBe('block');
    expect(checkContent(['Leave us a review and get a $20 coupon']).status).toBe('block');
    expect(checkContent(['Review us on Yelp']).status).toBe('block');
    expect(checkContent(['EZ-Lynk tune installed']).status).toBe('warn');
    expect(checkContent(['Brakes, cooling and fuel filters checked']).status).toBe('pass');
  });
});

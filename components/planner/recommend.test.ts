import { describe, expect, it } from 'vitest';
import { fitsTruck } from '@/lib/store/normalize';
import type { PlannerProduct } from './product';
import { emissionsOf, recommend, sizeOf, type Plan } from './recommend';

let nextId = 1;
function product(title: string, extra: Partial<PlannerProduct> & { sizes?: [string, number][] } = {}): PlannerProduct {
  const id = nextId++;
  const { sizes = [[ 'Default', 100_00 ]], ...rest } = extra;
  return {
    id, handle: `p-${id}`, title, vendor: 'DDP', category: 'turbo', platforms: ['duramax'], generationCollections: [],
    offRoadOnly: false, image: null,
    variants: sizes.map(([variantTitle, priceCents], index) => ({
      id: id * 100 + index, title: variantTitle === 'Default' ? null : variantTitle, optionValues: [],
      priceCents, compareAtCents: null, available: true, image: null,
    })),
    ...rest,
  };
}

const L5P = 'duramax-2017-present-l5p';
const LML = 'duramax-2011-2016-lml';
const PSD = 'powerstroke-2011-2019-6-7l';

const catalog: PlannerProduct[] = [
  product('17-26 stainless L5P 5" exhaust', { category: 'exhaust', generationCollections: [L5P], sizes: [['Default', 700_00]] }),
  product('DDP L5P CP3 Conversion Kit', { category: 'fuel', generationCollections: [L5P], sizes: [['10mm CP3', 3250_00], ['12mm CP3', 3750_00], ['14mm CP3', 4250_00]] }),
  product('DDP L5P 64mm Stage 2 Turbocharger', { generationCollections: [L5P], sizes: [['Base price', 2795_00], ['+$85.00', 2880_00]] }),
  product('DDP L5P 66mm Stage 2 Turbocharger', { generationCollections: [L5P], sizes: [['Base price', 2895_00]] }),
  product('DDP L5P Performance Injector Set', { category: 'fuel', generationCollections: [L5P], sizes: [['50% Over', 3696_00], ['100% Over', 4130_00]] }),
  product('DDP Dominator LML 72mm Turbocharger', { generationCollections: [LML], sizes: [['Base price', 3495_00]] }),
  product('10mm CP3 Duramax', { category: 'fuel', generationCollections: [LML], sizes: [['Default', 2000_00]] }),
  product('DDP 2004.5-2007 5.9L Cummins Performance Injector Set', { category: 'fuel', platforms: ['duramax', 'cummins'], generationCollections: [L5P], sizes: [['30% Over', 100_00]] }),
  product('ASAP 2017-2019 F250-F450 Tuning Package (Engine/Transmission)', { category: 'tuning', platforms: ['powerstroke'], generationCollections: [PSD], sizes: [['Limited Support', 700_00], ['Full Support', 800_00]] }),
  product('ASAP 2011-2012 F250-F450 Tuning Package', { category: 'tuning', platforms: ['powerstroke'], generationCollections: [PSD], sizes: [['Limited Support', 700_00]] }),
  product('AMDP 2011-2019 6.7L Powerstroke Custom Tuning', { category: 'tuning', platforms: ['powerstroke'], offRoadOnly: true, generationCollections: [PSD], sizes: [['Limited', 636_74]] }),
  product('11-26 6.7 Powerstroke 5" stainless exhaust', { category: 'exhaust', platforms: ['powerstroke'], generationCollections: [PSD], sizes: [['Default', 650_00]] }),
  product('EZ-lynk AutoAgent 3', { category: 'tuning', platforms: ['powerstroke'], generationCollections: [PSD], sizes: [['Default', 549_99]] }),
];

const l5p = { platform: 'duramax' as const, generationCollection: L5P };
const psd = { platform: 'powerstroke' as const, generationCollection: PSD };
const titles = (plan: Plan) => plan.stages.flatMap((s) => s.picks.map((p) => `${p.product.title} | ${p.variant.title ?? ''}`));

describe('recommend', () => {
  it('never recommends a part that does not fit the truck', () => {
    for (const goal of ['daily', 'tow', 'power', 'allout'] as const) {
      const plan = recommend({ products: catalog, truck: l5p, goal, budget: null });
      for (const pick of plan.stages.flatMap((s) => s.picks)) {
        expect(fitsTruck(pick.product, l5p)).not.toBe('no');
        expect(pick.product.title).not.toMatch(/cummins|LML/i);
      }
    }
  });

  it('towing picks conservative sizes, CP3 before turbo', () => {
    const plan = recommend({ products: catalog, truck: l5p, goal: 'tow', budget: 'no-limit' });
    expect(titles(plan)).toEqual([
      '17-26 stainless L5P 5" exhaust | ',
      'DDP L5P CP3 Conversion Kit | 10mm CP3',
      'DDP L5P 64mm Stage 2 Turbocharger | Base price',
    ]);
    expect(plan.subtotalCents).toBe(700_00 + 3250_00 + 2795_00);
    expect(plan.supporting).toContain('Transmission tuning');
    expect(plan.notes[0]).toMatch(/tune/i);
  });

  it('all-out picks the largest CP3, turbo and injectors up to 100% over', () => {
    const plan = recommend({ products: catalog, truck: l5p, goal: 'allout', budget: null });
    expect(titles(plan)).toEqual(expect.arrayContaining([
      'DDP L5P CP3 Conversion Kit | 14mm CP3',
      'DDP L5P 66mm Stage 2 Turbocharger | Base price',
      'DDP L5P Performance Injector Set | 100% Over',
    ]));
  });

  it('more power picks mid sizes', () => {
    const plan = recommend({ products: catalog, truck: l5p, goal: 'power', budget: null });
    expect(titles(plan)).toContain('DDP L5P CP3 Conversion Kit | 12mm CP3');
    expect(titles(plan)).toContain('DDP L5P 66mm Stage 2 Turbocharger | Base price');
  });

  it('skips what does not fit the budget and keeps the running total under the cap', () => {
    const plan = recommend({ products: catalog, truck: l5p, goal: 'tow', budget: '5000-10000' });
    expect(plan.subtotalCents).toBeLessThanOrEqual(10_000_00);
    const small = recommend({ products: catalog, truck: l5p, goal: 'tow', budget: 'under-1500' });
    expect(titles(small)).toEqual(['17-26 stainless L5P 5" exhaust | ']);
    expect(small.skipped.map((s) => s.slot)).toEqual(['cp3', 'turbo']);
  });

  it('prefers street-legal tunes with transmission tuning for towing, and flags year-specific files', () => {
    const plan = recommend({ products: catalog, truck: psd, goal: 'tow', budget: null });
    const tune = plan.stages[0]?.picks[0];
    expect(tune?.product.title).toMatch(/Engine\/Transmission/);
    expect(tune?.product.offRoadOnly).toBe(false);
    expect(tune?.confirmYear).toBe(true);
    expect(plan.stages[0]?.picks.some((p) => p.slot === 'trans')).toBe(false);
    expect(titles(plan).join()).not.toMatch(/AutoAgent/);
  });

  it('keeps off-road-only parts out of a daily-driver plan', () => {
    const offroadOnly = catalog.filter((p) => !/ASAP/.test(p.title));
    const plan = recommend({ products: offroadOnly, truck: psd, goal: 'daily', budget: null });
    expect(titles(plan).join()).not.toMatch(/AMDP/);
    const power = recommend({ products: offroadOnly, truck: psd, goal: 'power', budget: null });
    expect(power.stages[0]?.picks[0]?.emissions).toBe('offroad');
  });

  it('honours a swap to another fitting variant and reports going over budget', () => {
    const plan = recommend({ products: catalog, truck: l5p, goal: 'tow', budget: 'under-1500', overrides: { cp3: 2 * 100 + 2 } });
    expect(titles(plan)).toContain('DDP L5P CP3 Conversion Kit | 14mm CP3');
    expect(plan.overBudgetCents).toBeGreaterThan(0);
    const ignored = recommend({ products: catalog, truck: l5p, goal: 'tow', budget: null, overrides: { turbo: 6 * 100 } });
    expect(titles(ignored)).not.toContain('DDP Dominator LML 72mm Turbocharger | Base price');
  });

  it('reports no fitment when nothing is listed for the generation', () => {
    const plan = recommend({ products: catalog, truck: { platform: 'cummins', generationCollection: 'cummins-2019-present-6-7l' }, goal: 'power', budget: null });
    expect(plan.hasFitment).toBe(false);
    expect(plan.stages).toEqual([]);
  });
});

describe('engine options', () => {
  it('picks the option for the truck’s engine on shared products', () => {
    const cp3 = product('14mm CP3 Cummins', { category: 'fuel', platforms: ['cummins'], sizes: [['5.9L Cummins', 3000_00], ['6.7L Cummins', 3000_00]] });
    const injectors = product('DDP 6.7L Cummins Injector Set', { category: 'fuel', platforms: ['cummins'], generationCollections: ['cummins-2013-2018-6-7l'], sizes: [['100% Over', 4000_00]] });
    const plan = recommend({ products: [cp3, injectors], truck: { platform: 'cummins', generationCollection: 'cummins-2013-2018-6-7l' }, goal: 'allout', budget: null });
    const pick = plan.stages.flatMap((s) => s.picks).find((p) => p.slot === 'cp3');
    expect(pick?.variant.title).toBe('6.7L Cummins');
    expect(pick?.alternatives.map((a) => a.variantTitle)).not.toContain('5.9L Cummins');
  });
});

describe('helpers', () => {
  it('reads sizes and emissions status', () => {
    expect(sizeOf('DDP L5P 66mm Stage 2 Turbocharger')).toBe(66);
    expect(sizeOf('45% Over / New')).toBe(45);
    expect(sizeOf('Sportzman CP3 - 675 HP')).toBeNull();
    expect(emissionsOf({ title: 'Kit', offRoadOnly: true }, { title: null })).toBe('offroad');
    expect(emissionsOf({ title: 'Kit', offRoadOnly: false }, { title: 'Emissions-Compliant CP3' })).toBe('compliant');
    expect(emissionsOf({ title: 'Kit', offRoadOnly: false }, { title: '10mm CP3' })).toBe('confirm');
  });
});

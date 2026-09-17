import { describe, expect, test } from 'vitest';
import { planWeek, seasonFor, type PlannerInputs } from './planner';

const now = new Date('2026-09-17T14:00:00Z');
const build = { id: 'b1', slug: 's', title: 'Purple L5P', vehicleLabel: 'GMC 2500HD', platform: 'duramax', beforeHp: 445, afterHp: 548, beforeTorque: 910, afterTorque: 1105, parts: [], image: null, isSample: false, createdAt: '2026-09-12T00:00:00Z' };
const base: PlannerInputs = {
  now, builds: [build], dynoRuns: [], offers: [{ code: 'TOW', headline: 'Tow-ready inspection', valueLabel: '$89', terms: '', endsAt: '2026-10-15', landingSlug: 'tow' }],
  products: [{ handle: 'turbo', title: 'Stage 2 Turbo', vendor: 'DDP', category: 'turbo', priceFromCents: 169500, image: null, platforms: [], offRoadOnly: false }],
  openSlotsThisWeek: 8, liveCampaigns: 0, alreadyDrafted: new Set(),
};

describe('weekly planner', () => {
  test('picks the season from the shop-local month', () => {
    expect(seasonFor(now)).toBe('hurricane_prep');
    expect(seasonFor(new Date('2026-12-10T12:00:00Z'))).toBe('winter_ready');
  });

  test('proposes ads and posts from real data, capped', () => {
    const plan = planWeek(base);
    const ads = plan.items.filter((i) => i.type === 'ad');
    expect(ads.length).toBeGreaterThan(0);
    expect(ads.length).toBeLessThanOrEqual(3);
    expect(plan.items.some((i) => i.subject.kind === 'build' && i.type === 'social')).toBe(true);
    expect(plan.items.some((i) => i.subject.kind === 'offer')).toBe(true);
    const seasonal = ads.find((i) => i.subject.kind === 'season');
    expect(seasonal?.platform).toBe('google_pmax');
    expect(seasonal?.extraFacts?.openSlots).toBe('8');
  });

  test('full bays: no booking ads, push parts instead', () => {
    const plan = planWeek({ ...base, openSlotsThisWeek: 1 });
    const ads = plan.items.filter((i) => i.type === 'ad');
    expect(ads.every((a) => a.goal === 'sales')).toBe(true);
    expect(plan.notes.join(' ')).toMatch(/Only 1 open bays/);
  });

  test('skips anything already drafted and explains an empty week', () => {
    const drafted = new Set(['social:build:b1', 'ad:build:b1', 'ad:offer:tow', 'ad:season:hurricane_prep', 'social:season:hurricane_prep', 'social:product:turbo']);
    const plan = planWeek({ ...base, alreadyDrafted: drafted });
    expect(plan.items).toHaveLength(0);
    expect(plan.notes.join(' ')).toMatch(/Nothing new/);
  });
});

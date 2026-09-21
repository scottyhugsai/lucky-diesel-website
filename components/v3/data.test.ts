import { describe, expect, it } from 'vitest';
import { aggregateBuilds } from './build-stats';

import type { DynoBuild } from './build-stats';

const build = (over: Partial<DynoBuild>): DynoBuild => ({
  slug: 'a', title: 'A', vehicleLabel: 'Truck', platform: 'duramax', heroImage: '',
  beforeHp: 400, afterHp: 500, beforeTorque: 800, afterTorque: 900, hpGain: 100, torqueGain: 100, isSample: false,
  ...over,
});

describe('aggregateBuilds', () => {
  it('never derives a headline figure from a sample build', () => {
    const stats = aggregateBuilds([build({ slug: 's', isSample: true, hpGain: 300, afterTorque: 1500 })]);
    expect(stats.avgHpGain).toBeNull();
    expect(stats.topTorque).toBeNull();
    expect(stats.trucks).toBe(0);
    expect(stats.allSamples).toBe(true);
  });

  it('still lists sample builds on the leaderboard, where each row is labelled', () => {
    const stats = aggregateBuilds([build({ slug: 's', isSample: true, hpGain: 300 })]);
    expect(stats.leaderboard.map((b) => b.slug)).toEqual(['s']);
  });

  it('averages only the real builds when both kinds exist', () => {
    const stats = aggregateBuilds([
      build({ slug: 'real', hpGain: 100, afterTorque: 900 }),
      build({ slug: 'sample', isSample: true, hpGain: 500, afterTorque: 2000 }),
    ]);
    expect(stats.avgHpGain).toBe(100);
    expect(stats.topTorque).toBe(900);
    expect(stats.trucks).toBe(1);
    expect(stats.allSamples).toBe(false);
  });
});

describe('the biggest gain the shop can claim', () => {
  // v2's bento tile prints this at 88px under the words "Real numbers." It was
  // computed by its own query with no is_sample filter, so on a seeded database
  // the sample build's gain was the headline. Same shape as the hero stats and
  // the shop-volume counts before it.
  it('is null when every build is a sample, however big the sample gain', () => {
    expect(aggregateBuilds([build({ isSample: true, hpGain: 999 })]).topHpGain).toBeNull();
  });

  it('ignores a bigger sample gain in favour of the best real one', () => {
    const stats = aggregateBuilds([
      build({ slug: 'real-small', hpGain: 80 }),
      build({ slug: 'real-big', hpGain: 140 }),
      build({ slug: 'sample', isSample: true, hpGain: 900 }),
    ]);
    expect(stats.topHpGain).toBe(140);
  });

  it('is null when no real build has a dyno figure at all', () => {
    expect(aggregateBuilds([build({ hpGain: null })]).topHpGain).toBeNull();
    expect(aggregateBuilds([]).topHpGain).toBeNull();
  });
});

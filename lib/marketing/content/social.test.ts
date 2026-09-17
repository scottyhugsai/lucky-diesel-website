import { describe, expect, test } from 'vitest';
import { draftBuildPost, draftProductPost, draftTipPost, hashtagsFor, TIPS } from './social';
import type { BuildRef } from './types';

const build: BuildRef = {
  id: 'b1', slug: 'l5p', title: 'Purple-piped L5P', vehicleLabel: 'GMC Sierra 2500HD · L5P', platform: 'duramax',
  beforeHp: 445, afterHp: 548, beforeTorque: 910, afterTorque: 1105, parts: ['Coated intake pipes'], image: '/images/build-l5p-purple.jpg', isSample: false,
};

describe('social drafting', () => {
  test('build posts use real numbers, add a GBP summary and flag owner photos for privacy review', () => {
    const draft = draftBuildPost(build, 'build', 'https://x.test/book');
    expect(draft.caption).toContain('445 → 548 hp');
    expect(draft.caption).toMatch(/Results vary/);
    expect(draft.gbpSummary).not.toMatch(/#/);
    expect(draft.alternates.length).toBeGreaterThanOrEqual(2);
    expect(draft.imageTemplate).toBe('before_after');
    expect(draft.needsPrivacyReview).toBe(true);
    expect(draft.platforms).toContain('gbp');
  });

  test('dyno runs without a photo get the dyno card', () => {
    const draft = draftBuildPost({ ...build, image: null }, 'dyno', 'https://x.test');
    expect(draft.imageTemplate).toBe('dyno');
    expect(draft.needsPrivacyReview).toBe(false);
  });

  test('hashtags are deduped, platform-aware and capped', () => {
    const tags = hashtagsFor('cummins', ['#LuckyDiesel', '#Extra'], 6);
    expect(tags).toHaveLength(6);
    expect(new Set(tags).size).toBe(6);
    expect(tags).toContain('#Cummins');
  });

  test('pillar drafts rotate tips and never fail compliance', () => {
    expect(draftTipPost(0, 'u').title).not.toBe(draftTipPost(1, 'u').title);
    expect(draftTipPost(TIPS.length, 'u').title).toBe(draftTipPost(0, 'u').title);
    for (let i = 0; i < TIPS.length; i += 1) expect(draftTipPost(i, 'u').complianceStatus).not.toBe('block');
    const product = draftProductPost({ handle: 'h', title: 'DDP Stage 2 Turbo', vendor: 'DDP', category: 'turbo', priceFromCents: 169500, image: null, platforms: ['duramax'], offRoadOnly: false }, 'u');
    expect(product.caption).toContain('$1,695');
    expect(product.pillar).toBe('product_spotlight');
  });
});

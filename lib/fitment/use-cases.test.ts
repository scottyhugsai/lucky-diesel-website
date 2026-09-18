import { describe, expect, it } from 'vitest';
import { checkClaims } from '@/lib/marketing/core/compliance';
import { wordCount } from '@/lib/site-content/fields';
import { SERVICES } from '@/lib/site';
import { USE_CASES, findUseCase } from './use-cases';

describe('use-case tiers', () => {
  it('has a tier for each real reason someone books', () => {
    expect(USE_CASES.map((useCase) => useCase.id)).toEqual(['sorted', 'tow', 'boost']);
  });

  it('keeps every name and promise inside the site copy rules', () => {
    for (const useCase of USE_CASES) {
      expect(wordCount(useCase.name), useCase.id).toBeLessThanOrEqual(6);
      expect(wordCount(useCase.promise), useCase.id).toBeLessThanOrEqual(6);
      expect(wordCount(useCase.consequence), useCase.id).toBeLessThanOrEqual(40);
    }
  });

  it('points only at services the shop actually lists', () => {
    const known = new Set(SERVICES.map((service) => service.id));
    for (const useCase of USE_CASES) {
      for (const service of useCase.services) expect(known, `${useCase.id}/${service}`).toContain(service);
    }
  });

  // The taxonomy is the compliance position, so it has to survive the same
  // checker that gates generated marketing copy. Blocks are the hard line;
  // a `tuning_claim` warning is expected on any honest tuning copy and is a
  // standing reminder to keep CARB/EPA documentation on file.
  it('trips no blocking claim on any word it shows', () => {
    for (const useCase of USE_CASES) {
      const text = [useCase.name, useCase.promise, useCase.consequence, ...useCase.involves, useCase.emissions].join(' · ');
      const blocks = checkClaims(text).issues.filter((issue) => issue.severity === 'block');
      expect(blocks.map((issue) => issue.rule), useCase.id).toEqual([]);
    }
  });

  it('states the emissions position on every tier, not just the fast one', () => {
    for (const useCase of USE_CASES) expect(useCase.emissions).toMatch(/emissions equipment stays fitted/i);
  });

  it('offers no off-road or competition-only tier', () => {
    const all = JSON.stringify(USE_CASES).toLowerCase();
    expect(all).not.toContain('off-road');
    expect(all).not.toContain('competition');
  });

  it('finds a tier by id and shrugs at anything else', () => {
    expect(findUseCase('tow')?.name).toBe('Tow Tuned');
    expect(findUseCase('nope')).toBeNull();
    expect(findUseCase(null)).toBeNull();
  });
});

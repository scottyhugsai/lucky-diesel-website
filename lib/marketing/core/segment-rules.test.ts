import { describe, expect, test } from 'vitest';
import { categorizeService, evaluateSegment, matchesRules, parseSegmentRules, type ContactFacts } from './segment-rules';

const now = new Date('2026-09-17T15:00:00Z');
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000);

function contact(id: string, overrides: Partial<ContactFacts> = {}): ContactFacts {
  return {
    customerId: id, platforms: ['duramax'], generations: ['2017–Present L5P 6.6L L5P'], mileage: 60_000, lastVisitAt: daysAgo(30), paidVisits: 1,
    lifetimeValueCents: 150_000, tags: [], smsMarketing: false, emailMarketing: true, lifecycleStage: 'customer', loyaltyTier: 'stage_1',
    source: 'google', isFleet: false, services: [], ...overrides,
  };
}

const parse = (input: unknown) => {
  const result = parseSegmentRules(input);
  if (!result.ok) throw new Error(result.error);
  return result.rules;
};

describe('parseSegmentRules', () => {
  test('accepts the full vocabulary', () => {
    const result = parseSegmentRules({ match: 'all', conditions: [
      { field: 'platform', op: 'in', values: ['Duramax', 'cummins'] },
      { field: 'generation', op: 'not_in', values: ['LB7'] },
      { field: 'mileage', op: 'between', min: 50_000, max: 150_000 },
      { field: 'days_since_last_visit', op: 'gte', value: 180 },
      { field: 'lifetime_value_cents', op: 'lte', value: 1_000_000 },
      { field: 'tags', op: 'has_any', values: ['tows'] },
      { field: 'consent', op: 'is', value: 'sms_marketing' },
      { field: 'lifecycle_stage', op: 'in', values: ['repeat', 'vip'] },
      { field: 'service_history', op: 'has_none', values: ['turbo'], within_days: 365 },
      { field: 'fleet', op: 'is', value: false },
      { field: 'has_visited', op: 'is', value: true },
    ] });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.rules.conditions[0]).toEqual({ field: 'platform', op: 'in', values: ['duramax', 'cummins'] });
  });

  test.each([
    [{ match: 'all', conditions: [{ field: 'email; drop table customers', op: 'in', values: ['x'] }] }, 'unknown field'],
    [{ match: 'all', conditions: [{ field: 'platform', op: 'like', values: ['%'] }] }, 'op must be'],
    [{ match: 'all', conditions: [{ field: 'mileage', op: 'gte', value: '1 or 1=1' }] }, 'must be a number'],
    [{ match: 'all', conditions: [{ field: 'service_history', op: 'has_any', values: ['delete'] }] }, 'unknown service'],
    [{ match: 'all', conditions: [{ field: 'lifecycle_stage', op: 'in', values: ['admin'] }] }, 'known strings'],
    [{ match: 'some', conditions: [] }, 'match must be'],
    [{ match: 'all', conditions: Array.from({ length: 26 }, () => ({ field: 'fleet', op: 'is', value: true })) }, 'At most'],
    [null, 'must be an object'],
  ])('rejects invalid rules (%#)', (input, message) => {
    const result = parseSegmentRules(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(message);
  });
});

describe('evaluating segments', () => {
  test('“had tune, no turbo”', () => {
    const rules = parse({ match: 'all', conditions: [
      { field: 'service_history', op: 'has_any', values: ['tune'] },
      { field: 'service_history', op: 'has_none', values: ['turbo'] },
    ] });
    const people = [
      contact('tuned', { services: [{ category: 'tune', at: daysAgo(40) }] }),
      contact('tuned-and-turbo', { services: [{ category: 'tune', at: daysAgo(40) }, { category: 'turbo', at: daysAgo(10) }] }),
      contact('stock'),
    ];
    expect(evaluateSegment(rules, people, now)).toEqual(['tuned']);
  });

  test('lapsed high-mileage Powerstrokes (any generation substring match)', () => {
    const rules = parse({ match: 'all', conditions: [
      { field: 'platform', op: 'in', values: ['powerstroke'] },
      { field: 'generation', op: 'in', values: ['6.7'] },
      { field: 'mileage', op: 'gte', value: 120_000 },
      { field: 'days_since_last_visit', op: 'gte', value: 180 },
    ] });
    const people = [
      contact('match', { platforms: ['powerstroke'], generations: ['2011–2019 6.7L'], mileage: 176_000, lastVisitAt: daysAgo(200) }),
      contact('recent', { platforms: ['powerstroke'], generations: ['2011–2019 6.7L'], mileage: 176_000, lastVisitAt: daysAgo(20) }),
      contact('never', { platforms: ['powerstroke'], generations: ['2011–2019 6.7L'], mileage: 176_000, lastVisitAt: null }),
    ];
    expect(evaluateSegment(rules, people, now)).toEqual(['match']);
  });

  test('match any, tags, consent, fleet and loyalty tier', () => {
    const rules = parse({ match: 'any', conditions: [{ field: 'tags', op: 'has_all', values: ['tows', 'boat'] }, { field: 'fleet', op: 'is', value: true }] });
    expect(matchesRules(rules, contact('a', { tags: ['Tows', 'boat'] }), now)).toBe(true);
    expect(matchesRules(rules, contact('b', { tags: ['tows'] }), now)).toBe(false);
    expect(matchesRules(rules, contact('c', { isFleet: true }), now)).toBe(true);
    const sms = parse({ match: 'all', conditions: [{ field: 'consent', op: 'is', value: 'sms_marketing' }, { field: 'loyalty_tier', op: 'in', values: ['stage_1'] }] });
    expect(matchesRules(sms, contact('d', { smsMarketing: true }), now)).toBe(true);
    expect(matchesRules(sms, contact('e'), now)).toBe(false);
  });

  test('service history can be limited to a recent window', () => {
    const rules = parse({ match: 'all', conditions: [{ field: 'service_history', op: 'has_any', values: ['maintenance'], within_days: 90 }] });
    expect(matchesRules(rules, contact('old', { services: [{ category: 'maintenance', at: daysAgo(200) }] }), now)).toBe(false);
    expect(matchesRules(rules, contact('new', { services: [{ category: 'maintenance', at: daysAgo(20) }] }), now)).toBe(true);
  });

  test('an empty rule set matches nobody', () => {
    expect(evaluateSegment({ match: 'all', conditions: [] }, [contact('x')], now)).toEqual([]);
  });
});

describe('categorizeService', () => {
  test('maps shop job titles to categories', () => {
    expect(categorizeService('EZ-Lynk performance tune')).toEqual(['tune']);
    expect(categorizeService('DDP Stage 2 turbo upgrade')).toEqual(['turbo']);
    expect(categorizeService('CP3 pump replacement')).toEqual(['fuel']);
    expect(categorizeService('Maintenance service')).toEqual(['maintenance']);
    expect(categorizeService('ARP head studs')).toEqual(['head_studs']);
    expect(categorizeService(null)).toEqual([]);
  });
});

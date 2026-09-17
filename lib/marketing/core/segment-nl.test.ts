import { describe, expect, test } from 'vitest';
import { parseSegmentText } from './segment-nl';

const conditions = (text: string) => parseSegmentText(text).rules.conditions;

describe('parseSegmentText', () => {
  test('the inventory example', () => {
    const result = parseSegmentText('Cummins owners not seen in 12 months who tow');
    expect(result.rules.match).toBe('all');
    expect(result.rules.conditions).toEqual(expect.arrayContaining([
      { field: 'platform', op: 'in', values: ['cummins'] },
      { field: 'days_since_last_visit', op: 'gte', value: 360 },
      { field: 'usage', op: 'in', values: ['towing'] },
    ]));
    expect(result.rules.conditions).toHaveLength(3);
    expect(result.ignored).toEqual([]);
  });

  test('mileage, spend and generation', () => {
    expect(conditions('L5P Duramax over 150k miles who spent $5k+')).toEqual(expect.arrayContaining([
      { field: 'mileage', op: 'gte', value: 150_000 },
      { field: 'lifetime_value_cents', op: 'gte', value: 500_000 },
      { field: 'generation', op: 'in', values: ['l5p'] },
      { field: 'platform', op: 'in', values: ['duramax'] },
    ]));
  });

  test('negated services and platforms', () => {
    expect(conditions('never tuned, not ford')).toEqual(expect.arrayContaining([
      { field: 'service_history', op: 'has_none', values: ['tune'] },
      { field: 'platform', op: 'not_in', values: ['powerstroke'] },
    ]));
    expect(conditions('had a turbo')).toEqual([{ field: 'service_history', op: 'has_any', values: ['turbo'] }]);
  });

  test('recent visits, churn, consent and tags', () => {
    expect(conditions('seen in the last 90 days')).toEqual([{ field: 'days_since_last_visit', op: 'lte', value: 90 }]);
    expect(conditions('at risk vips who can text tagged boat')).toEqual(expect.arrayContaining([
      { field: 'overdue_ratio', op: 'gte', value: 1.5 },
      { field: 'lifecycle_stage', op: 'in', values: ['vip'] },
      { field: 'consent', op: 'is', value: 'sms_marketing' },
      { field: 'tags', op: 'has_any', values: ['boat'] },
    ]));
    expect(conditions('haven\'t been in for a year')).toEqual([{ field: 'days_since_last_visit', op: 'gte', value: 365 }]);
  });

  test('reports ignored words and never throws on junk', () => {
    const result = parseSegmentText('purple unicorns <script>');
    expect(result.rules.conditions).toEqual([]);
    expect(result.ignored).toEqual(expect.arrayContaining(['purple', 'unicorns']));
    expect(() => parseSegmentText('x'.repeat(5000))).not.toThrow();
  });
});

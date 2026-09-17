import { describe, expect, it } from 'vitest';
import { CHECKLISTS, findChecklist, isoWeek, periodKey, progress } from './checklists';

describe('CHECKLISTS', () => {
  it('uses ids the ops_checklist_ticks check accepts', () => {
    for (const list of CHECKLISTS) {
      expect(list.items.length).toBeGreaterThan(0);
      for (const item of list.items) {
        expect(item.id).toMatch(/^[a-z0-9_]{1,40}$/);
        expect(item.label.length).toBeLessThanOrEqual(46);
      }
      expect(new Set(list.items.map((i) => i.id)).size).toBe(list.items.length);
    }
  });
});

describe('periodKey', () => {
  it('returns once, an ISO week or a month', () => {
    expect(periodKey('launch')).toBe('once');
    expect(periodKey('weekly', new Date('2026-09-17T12:00:00Z'))).toBe('2026-W38');
    expect(periodKey('monthly', new Date('2026-09-17T12:00:00Z'))).toBe('2026-09');
  });

  it('matches the migration pattern', () => {
    const pattern = /^(once|\d{4}-W\d{2}|\d{4}-\d{2})$/;
    for (const list of CHECKLISTS) expect(periodKey(list.kind, new Date('2026-01-04T00:00:00Z'))).toMatch(pattern);
  });
});

describe('isoWeek', () => {
  it('puts January 1st in the previous year’s last week when it is a Thursday-less week', () => {
    expect(isoWeek(new Date('2027-01-01T00:00:00Z'))).toEqual({ year: 2026, week: 53 });
    expect(isoWeek(new Date('2026-01-01T00:00:00Z'))).toEqual({ year: 2026, week: 1 });
  });
});

describe('progress', () => {
  it('counts ticked items', () => {
    const list = findChecklist('weekly')!;
    expect(progress(list, new Set())).toMatchObject({ done: 0, complete: false });
    expect(progress(list, new Set(list.items.map((i) => i.id)))).toMatchObject({ done: list.items.length, complete: true });
  });
});

import { describe, expect, test } from 'vitest';
import { chartMarkers, monthBounds, monthGrid, parseMonth, placeEntries, seasonEntries, shiftMonth, type CalendarEntry } from './marketing-calendar';

describe('month helpers', () => {
  test('parseMonth accepts YYYY-MM near today and falls back otherwise', () => {
    expect(parseMonth('2026-10', '2026-09-17')).toBe('2026-10');
    expect(parseMonth('2026-13', '2026-09-17')).toBe('2026-09');
    expect(parseMonth('1999-01', '2026-09-17')).toBe('2026-09');
    expect(parseMonth(['2026-10'], '2026-09-17')).toBe('2026-09');
  });

  test('shiftMonth wraps years and monthBounds knows month lengths', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(monthBounds('2028-02')).toEqual({ first: '2028-02-01', last: '2028-02-29' });
  });

  test('monthGrid returns full Sunday-first weeks covering the month', () => {
    const weeks = monthGrid('2026-09');
    expect(weeks[0]![0]).toBe('2026-08-30');
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks.flat()).toContain('2026-09-30');
    expect(weeks[weeks.length - 1]![6]).toBe('2026-10-03');
  });
});

describe('placing entries', () => {
  const entries: CalendarEntry[] = [
    { id: '1', kind: 'ad', title: 'Fall tune ads', start: '2026-09-10', end: '2026-09-12', href: null },
    { id: '2', kind: 'campaign', title: 'Dyno invite', start: '2026-09-11', end: '2026-09-11', href: null },
  ];

  test('multi-day entries land on every covered day, campaigns first', () => {
    const map = placeEntries(entries, ['2026-09-10', '2026-09-11', '2026-09-13']);
    expect(map.get('2026-09-10')!.map((e) => e.id)).toEqual(['1']);
    expect(map.get('2026-09-11')!.map((e) => e.id)).toEqual(['2', '1']);
    expect(map.get('2026-09-13')).toEqual([]);
  });

  test('chartMarkers clips to the series range', () => {
    const days = ['2026-09-11', '2026-09-12', '2026-09-13'];
    expect(chartMarkers(entries, days)).toEqual([
      { index: 0, span: 2, kind: 'ad', title: 'Fall tune ads' },
      { index: 0, span: 1, kind: 'campaign', title: 'Dyno invite' },
    ]);
  });

  test('seasonEntries spans first to last month', () => {
    expect(seasonEntries(2026, [{ key: 'winter', name: 'Winter', months: [10, 11] }])[0]).toMatchObject({ start: '2026-10-01', end: '2026-11-30' });
  });
});

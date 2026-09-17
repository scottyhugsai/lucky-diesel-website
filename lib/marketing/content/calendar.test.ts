import { describe, expect, test } from 'vitest';
import { pillarOccurrences, scheduleDrafts, shopDay, suggestPostingTimes } from './calendar';

// Thursday 2026-09-17, 10:00 in Charleston (EDT, UTC-4).
const from = new Date('2026-09-17T14:00:00Z');
const localHour = (d: Date) => Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: 'America/New_York' }).format(d));

describe('posting time suggestions', () => {
  test('stay inside the platform window, in the future, and spaced out', () => {
    const times = suggestPostingTimes('instagram', from, 4);
    expect(times).toHaveLength(4);
    for (const t of times) {
      expect(t > from).toBe(true);
      expect([2, 3, 4, 5, 6]).toContain(shopDay(t).weekday);
      expect([12, 17, 19]).toContain(localHour(t));
    }
    for (let i = 1; i < times.length; i += 1) expect(times[i]!.getTime() - times[i - 1]!.getTime()).toBeGreaterThanOrEqual(20 * 3_600_000);
  });

  test('GBP posts land on Tuesday or Thursday at 10am', () => {
    const [first, second] = suggestPostingTimes('gbp', from, 2);
    expect(shopDay(first!)).toEqual({ date: '2026-09-22', weekday: 2 });
    expect(localHour(first!)).toBe(10);
    expect(shopDay(second!).weekday).toBe(4);
  });

  test('skips slots already taken', () => {
    const taken = [new Date('2026-09-17T16:00:00Z')]; // Thu 12:00 local
    const [next] = suggestPostingTimes('instagram', from, 1, taken);
    expect(shopDay(next!).date).toBe('2026-09-18');
  });
});

describe('scheduling', () => {
  test('drafts for one platform never share a slot', () => {
    const scheduled = scheduleDrafts(
      [{ id: 'a', platform: 'facebook' }, { id: 'b', platform: 'facebook' }, { id: 'c', platform: 'gbp' }],
      from,
    );
    expect(scheduled.map((s) => s.id)).toEqual(['a', 'b', 'c']);
    const fb = scheduled.filter((s) => s.platform === 'facebook').map((s) => s.at.getTime());
    expect(new Set(fb.map((t) => shopDay(new Date(t)).date)).size).toBe(2);
  });

  test('respects notBefore', () => {
    const notBefore = new Date('2026-09-24T00:00:00Z');
    const [s] = scheduleDrafts([{ id: 'x', platform: 'instagram', notBefore }], from);
    expect(s!.at > notBefore).toBe(true);
  });

  test('pillars recur on their days over two weeks', () => {
    const occ = pillarOccurrences(from, new Date('2026-10-04T03:00:00Z'));
    expect(occ.filter((o) => o.pillar === 'tip_tuesday').map((o) => shopDay(o.at).date)).toEqual(['2026-09-22', '2026-09-29']);
    expect(occ.filter((o) => o.pillar === 'build_of_the_month').map((o) => shopDay(o.at).date)).toEqual(['2026-10-02']);
    expect(occ.filter((o) => o.pillar === 'product_spotlight').map((o) => shopDay(o.at).date)).toEqual(['2026-09-17', '2026-09-24', '2026-10-01']);
  });
});

import { describe, expect, it } from 'vitest';
import { buildContestRules, contestCopyIssues, validateContest, type ContestParams } from './contest-rules';
import { buildLeaderboard, dynoSlots, eventPostDraft, eventSchema, isFollowUpDue, leadingNomination, monthKey, monthLabel, publicName, reminderStage } from './event-rules';

describe('dynoSlots', () => {
  it('splits the event and marks taken slots', () => {
    const slots = dynoSlots('2026-10-17T14:00:00Z', '2026-10-17T15:00:00Z', 20, ['2026-10-17T14:20:00.000Z']);
    expect(slots.map((s) => s.taken)).toEqual([false, true, false]);
    expect(slots[0]?.label).toBe('10:00 AM');
    expect(dynoSlots('2026-10-17T14:00:00Z', '2026-10-17T15:00:00Z', 0, [])).toEqual([]);
  });
});

describe('timing', () => {
  const now = new Date('2026-10-10T15:00:00Z');
  it('picks the reminder stage', () => {
    expect(reminderStage('2026-10-17T15:00:00Z', now)).toBe('7d');
    expect(reminderStage('2026-10-11T14:00:00Z', now)).toBe('1d');
    expect(reminderStage('2026-10-14T15:00:00Z', now)).toBeNull();
    expect(reminderStage('2026-10-09T15:00:00Z', now)).toBeNull();
  });
  it('follows up the day after', () => {
    expect(isFollowUpDue('2026-10-09T20:00:00Z', now)).toBe(true);
    expect(isFollowUpDue('2026-10-10T10:00:00Z', now)).toBe(false);
    expect(isFollowUpDue('2026-10-01T10:00:00Z', now)).toBe(false);
  });
});

describe('leaderboard', () => {
  it('shows only verified checked-in runs, names only when opted in', () => {
    const rows = buildLeaderboard([
      { id: 'a', fullName: 'Jordan Alvarez', platform: 'duramax', horsepower: 610, torque: 1200, showName: true, verified: true, status: 'checked_in' },
      { id: 'b', fullName: 'Private Person', platform: 'cummins', horsepower: 700, torque: 1300, showName: false, verified: true, status: 'checked_in' },
      { id: 'c', fullName: 'Unverified', platform: 'cummins', horsepower: 900, torque: 1500, showName: true, verified: false, status: 'checked_in' },
      { id: 'd', fullName: 'Not here', platform: 'cummins', horsepower: 800, torque: 1500, showName: true, verified: true, status: 'registered' },
    ]);
    expect(rows.map((r) => [r.rank, r.name, r.platform])).toEqual([[1, 'Truck 1', 'Cummins'], [2, 'Jordan A.', 'Duramax']]);
    expect(publicName('Cher')).toBe('Cher');
  });
});

describe('syndication', () => {
  it('builds Event schema and a post draft', () => {
    const schema = eventSchema({ name: 'Dyno Day', description: null, startsAt: '2026-10-17T14:00:00Z', endsAt: '2026-10-17T18:00:00Z', location: null, priceCents: 0, capacity: 2, taken: 2, registrationOpen: true }, 'https://x/events/dyno', { name: 'Lucky Diesel', city: 'Conway', region: 'SC', siteUrl: 'https://x' });
    expect(schema['@type']).toBe('Event');
    expect((schema.offers as Record<string, string>).availability).toContain('SoldOut');
    const draft = eventPostDraft({ name: 'Toy Drive Dyno Day', startsAt: '2026-12-12T15:00:00Z', location: null, charity: 'Toys for Tots', kind: 'dyno_day' }, 'https://x/e');
    expect(draft.caption).toContain('Toys for Tots');
    expect(draft.caption).toContain('emissions-compliant');
  });
});

describe('build of the month', () => {
  it('keys months in shop time and picks the leader', () => {
    expect(monthKey(new Date('2026-11-01T02:00:00Z'))).toBe('2026-10');
    expect(monthLabel('2026-10')).toBe('October 2026');
    expect(leadingNomination([{ nominationId: 'a', votes: 2 }, { nominationId: 'b', votes: 3 }, { nominationId: 'c', votes: 3 }])).toBe('b');
    expect(leadingNomination([{ nominationId: 'a', votes: 0 }])).toBeNull();
  });
});

describe('contest rules', () => {
  const params: ContestParams = {
    title: 'Build of the Month', sponsor: 'Lucky Diesel LLC', sponsorAddress: '123 Main St, Conway SC', startDate: '2026-10-01', endDate: '2026-10-31',
    eligibility: '', howToEnter: 'Nominate a truck at luckydiesel.com/events/build-of-the-month.', prize: 'Shop hoodie', prizeValueCents: 6000, winnerSelection: 'vote', winnerNotice: '',
  };
  it('includes the required disclaimers', () => {
    const rules = buildContestRules(params);
    expect(rules).toContain('NO PURCHASE NECESSARY');
    expect(rules).toMatch(/in no way sponsored, endorsed, administered by or associated with Facebook/);
    expect(validateContest(params)).toEqual([]);
  });
  it('flags purchase and share requirements', () => {
    expect(validateContest({ ...params, howToEnter: 'Buy a tune and share this post' })).toEqual(['Entry cannot require a purchase.', 'Don’t require shares or tags to enter (Meta rules).']);
    expect(contestCopyIssues('Giveaway! Tag a friend to win')).toHaveLength(3);
    expect(contestCopyIssues('Giveaway. No purchase necessary. Rules: link')).toEqual([]);
    expect(contestCopyIssues('Oil change special')).toEqual([]);
  });
});

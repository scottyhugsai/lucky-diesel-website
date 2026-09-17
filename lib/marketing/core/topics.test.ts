import { describe, expect, test } from 'vitest';
import { ensureOptInReply, isTopicAllowed, matchKeyword, newsletterKey, sunsetStep } from './topics';

const day = (n: number) => new Date(Date.UTC(2026, 0, 1) + n * 86_400_000);
const kw = [{ keyword: 'DIESEL', active: true }, { keyword: 'HOURS', active: false }];

describe('topics and keywords', () => {
  test('topic preferences only block muted topics', () => {
    expect(isTopicAllowed(['offers'], 'offers')).toBe(false);
    expect(isTopicAllowed(['offers'], 'events')).toBe(true);
    expect(isTopicAllowed(['offers'], null)).toBe(true);
  });

  test('keywords match one word, ignore inactive ones and sentences', () => {
    expect(matchKeyword(' diesel! ', kw)?.keyword).toBe('DIESEL');
    expect(matchKeyword('hours', kw)).toBeNull();
    expect(matchKeyword('I love diesel trucks a lot', kw)).toBeNull();
  });

  test('opt-in replies always carry brand, rates, HELP and STOP', () => {
    expect(ensureOptInReply('You are in!', 'Lucky Diesel')).toBe('Lucky Diesel: You are in! Msg & data rates may apply. Reply HELP for help. Reply STOP to cancel.');
  });
});

describe('sunsetStep', () => {
  test('notices, waits, then suppresses the unengaged', () => {
    expect(sunsetStep({ firstMailedAt: day(0), lastEngagedAt: null, noticeAt: null }, day(200), 180)).toBe('notice');
    expect(sunsetStep({ firstMailedAt: day(100), lastEngagedAt: null, noticeAt: null }, day(200), 180)).toBe('none');
    expect(sunsetStep({ firstMailedAt: day(0), lastEngagedAt: day(150), noticeAt: null }, day(200), 180)).toBe('none');
    expect(sunsetStep({ firstMailedAt: day(0), lastEngagedAt: null, noticeAt: day(195) }, day(200), 180)).toBe('none');
    expect(sunsetStep({ firstMailedAt: day(0), lastEngagedAt: null, noticeAt: day(180) }, day(200), 180)).toBe('suppress');
    expect(sunsetStep({ firstMailedAt: day(0), lastEngagedAt: day(190), noticeAt: day(180) }, day(200), 180)).toBe('reset');
    expect(sunsetStep({ firstMailedAt: day(0), lastEngagedAt: null, noticeAt: null }, day(400), 0)).toBe('none');
  });

  test('newsletter key is per shop-local month', () => {
    expect(newsletterKey(new Date('2026-10-01T02:00:00Z'), 'America/New_York')).toBe('newsletter-2026-09');
  });
});

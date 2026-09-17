import { describe, expect, test } from 'vitest';
import {
  autoReplyBucket, isShopOpen, isStale, isUnanswered, lostNurtureDue, quoteNudgeDue, slaLevel, snoozeJustEnded, type ThreadMessage,
} from './speed';

const now = new Date('2026-09-17T15:00:00Z'); // Thu 11:00 in New York
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);
const hoursAgo = (h: number) => minutesAgo(h * 60);
const daysAgo = (d: number) => hoursAgo(d * 24);
const rules = { slaFirstMinutes: 5, slaBackupMinutes: 15 };

describe('speed-to-lead SLA', () => {
  test('escalates untouched new leads at 5 and 15 minutes', () => {
    expect(slaLevel({ status: 'new', createdAt: minutesAgo(4), contactedAt: null }, now, rules)).toBe(0);
    expect(slaLevel({ status: 'new', createdAt: minutesAgo(5), contactedAt: null }, now, rules)).toBe(1);
    expect(slaLevel({ status: 'new', createdAt: minutesAgo(15), contactedAt: null }, now, rules)).toBe(2);
  });

  test('stops once the lead is contacted', () => {
    expect(slaLevel({ status: 'contacted', createdAt: minutesAgo(30), contactedAt: null }, now, rules)).toBe(0);
    expect(slaLevel({ status: 'new', createdAt: minutesAgo(30), contactedAt: minutesAgo(1) }, now, rules)).toBe(0);
  });
});

describe('stale deals and snoozes', () => {
  test('open deals go stale after the quiet window unless snoozed', () => {
    expect(isStale({ status: 'contacted', lastActivityAt: hoursAgo(49), snoozedUntil: null }, now, 48)).toBe(true);
    expect(isStale({ status: 'contacted', lastActivityAt: hoursAgo(47), snoozedUntil: null }, now, 48)).toBe(false);
    expect(isStale({ status: 'won', lastActivityAt: daysAgo(10), snoozedUntil: null }, now, 48)).toBe(false);
    expect(isStale({ status: 'new', lastActivityAt: daysAgo(10), snoozedUntil: hoursAgo(-5) }, now, 48)).toBe(false);
  });

  test('a snooze that just ended is due', () => {
    expect(snoozeJustEnded(hoursAgo(1), now)).toBe(true);
    expect(snoozeJustEnded(hoursAgo(-1), now)).toBe(false);
    expect(snoozeJustEnded(daysAgo(8), now)).toBe(false);
  });
});

describe('business hours', () => {
  const hours = { openHour: 8, closeHour: 17, openDays: [1, 2, 3, 4, 5], timeZone: 'America/New_York' };
  test('uses shop-local weekday and hour', () => {
    expect(isShopOpen(now, hours)).toBe(true);
    expect(isShopOpen(new Date('2026-09-17T23:30:00Z'), hours)).toBe(false); // 19:30 local
    expect(isShopOpen(new Date('2026-09-19T15:00:00Z'), hours)).toBe(false); // Saturday
  });

  test('auto-reply bucket is per number and 12-hour window', () => {
    expect(autoReplyBucket('+1 (843) 555-0142', now)).toBe(autoReplyBucket('8435550142', new Date(now.getTime() + 1000)));
    expect(autoReplyBucket('8435550142', now)).not.toBe(autoReplyBucket('8435550142', new Date(now.getTime() + 13 * 3_600_000)));
  });
});

describe('unanswered texts', () => {
  const msg = (direction: 'inbound' | 'outbound', h: number, automationKey: string | null = null): ThreadMessage => ({ direction, createdAt: hoursAgo(h), automationKey });

  test('an inbound text older than the window with no human reply is unanswered', () => {
    expect(isUnanswered([msg('outbound', 5, 'lead_auto_reply'), msg('inbound', 3)], now, 2)).toBe(true);
    expect(isUnanswered([msg('inbound', 1)], now, 2)).toBe(false);
  });

  test('auto-replies do not count as answered, inbox replies do', () => {
    expect(isUnanswered([msg('inbound', 3), msg('outbound', 2.9, 'after_hours_auto_reply')], now, 2)).toBe(true);
    expect(isUnanswered([msg('inbound', 3), msg('outbound', 2.5, 'inbox_reply')], now, 2)).toBe(false);
  });

  test('STOP / HELP keywords need no reply', () => {
    expect(isUnanswered([msg('inbound', 5, 'inbound:stop')], now, 2)).toBe(false);
  });
});

describe('quote expiry and lost nurture', () => {
  test('nudges inside the last days before expiry', () => {
    expect(quoteNudgeDue(daysAgo(-2), now, 3)).toBe(true);
    expect(quoteNudgeDue(daysAgo(-5), now, 3)).toBe(false);
    expect(quoteNudgeDue(daysAgo(1), now, 3)).toBe(false);
    expect(quoteNudgeDue(null, now, 3)).toBe(false);
  });

  test('picks the track step by reason and day mark', () => {
    expect(lostNurtureDue('Price', daysAgo(31), now)).toBe('mkt_lost_price_30d');
    expect(lostNurtureDue('Price', daysAgo(40), now)).toBeNull();
    expect(lostNurtureDue('Timing', daysAgo(91), now)).toBe('mkt_lost_timing_90d');
    expect(lostNurtureDue('No response', daysAgo(31), now)).toBe('mkt_lost_no_response_30d');
    expect(lostNurtureDue('Not a fit', daysAgo(31), now)).toBeNull();
    expect(lostNurtureDue(null, daysAgo(31), now)).toBeNull();
  });
});

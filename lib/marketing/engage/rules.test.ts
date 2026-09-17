import { describe, expect, test } from 'vitest';
import {
  abBucket, abStats, announcementId, cleanChatBody, cleanVin, countdownLabel, duePartialFollowUps, encodeConsent, formatRange, isLive,
  isShopOpen, needsConsentPrompt, numberForSource, parseAnnouncement, parseConsent, parseHeardAbout, parsePriceRanges, parseVariants,
  pickPopup, priceRangeFor, socialProofMessage, toE164Us, upsertRange, waitlistTopic, type PopupRule,
} from './rules';

const now = new Date('2026-09-17T15:00:00Z');

describe('form fields', () => {
  test('heard-about accepts only listed ids', () => {
    expect(parseHeardAbout('instagram')).toBe('instagram');
    expect(parseHeardAbout('<script>')).toBeNull();
    expect(parseHeardAbout(3)).toBeNull();
  });

  test('VIN is normalized and must be 17 valid characters', () => {
    expect(cleanVin(' 1gc4yreyxmf123456 ')).toBe('1GC4YREYXMF123456');
    expect(cleanVin('1GC4YREYXMF12345O')).toBeNull();
    expect(cleanVin('SHORT')).toBeNull();
  });
});

describe('announcement bar', () => {
  test('parses safe fields and drops off-site links', () => {
    const a = parseAnnouncement({ text: ' Dyno day Saturday ', href: 'https://evil.example', linkLabel: 'RSVP', endsAt: '2026-09-20T00:00:00Z', countdown: true });
    expect(a).toMatchObject({ text: 'Dyno day Saturday', href: null, countdown: true });
    expect(parseAnnouncement({ text: '' })).toBeNull();
    expect(parseAnnouncement({ text: 'x', href: '//evil.example' })?.href).toBeNull();
    expect(parseAnnouncement({ text: 'x', href: '/events' })?.href).toBe('/events');
  });

  test('live window and countdown', () => {
    expect(isLive({ startsAt: '2026-09-18T00:00:00Z', endsAt: null }, now)).toBe(false);
    expect(isLive({ startsAt: null, endsAt: '2026-09-17T14:00:00Z' }, now)).toBe(false);
    expect(isLive({ startsAt: null, endsAt: null }, now)).toBe(true);
    expect(countdownLabel('2026-09-20T15:00:00Z', now)).toBe('3 days left');
    expect(countdownLabel('2026-09-17T20:00:00Z', now)).toBe('5 hours left');
    expect(countdownLabel('2026-09-17T15:30:00Z', now)).toBe('Ends soon');
    expect(countdownLabel('2026-09-17T14:00:00Z', now)).toBeNull();
  });

  test('id changes with the text', () => {
    const base = { text: 'A', href: null, linkLabel: null, startsAt: null, endsAt: null, countdown: false };
    expect(announcementId(base)).not.toBe(announcementId({ ...base, text: 'B' }));
  });
});

describe('popups', () => {
  const popup = (id: string, pathPrefix: string, extra: Partial<PopupRule> = {}): PopupRule => ({
    id, pathPrefix, trigger: 'time', triggerValue: 30, headline: 'h', body: null, ctaLabel: 'Go', ctaHref: '/x', startsAt: null, endsAt: null, ...extra,
  });

  test('longest live prefix wins and prefixes match whole segments', () => {
    const list = [popup('all', '/'), popup('duramax', '/duramax'), popup('old', '/duramax', { endsAt: '2026-01-01T00:00:00Z' })];
    expect(pickPopup(list, '/duramax', now)?.id).toBe('duramax');
    expect(pickPopup(list, '/duramax/lb7', now)?.id).toBe('duramax');
    expect(pickPopup(list, '/duramaxx', now)?.id).toBe('all');
    expect(pickPopup([popup('d', '/duramax')], '/cummins', now)).toBeNull();
  });
});

describe('price ranges', () => {
  test('platform-specific beats any; invalid rows dropped', () => {
    const ranges = parsePriceRanges([
      { service: 'tuning', platform: 'any', lowCents: 60000, highCents: 120000 },
      { service: 'tuning', platform: 'duramax', lowCents: 80000, highCents: 150000 },
      { service: 'turbo', platform: 'any', lowCents: 5, highCents: 1 },
      'junk',
    ]);
    expect(ranges).toHaveLength(2);
    expect(priceRangeFor(ranges, 'tuning', 'duramax')?.lowCents).toBe(80000);
    expect(priceRangeFor(ranges, 'tuning', 'cummins')?.lowCents).toBe(60000);
    expect(priceRangeFor(ranges, 'turbo', 'cummins')).toBeNull();
    expect(formatRange({ lowCents: 80000, highCents: 150000 })).toBe('$800–$1,500');
  });

  test('upsert replaces the same service and platform', () => {
    const next = upsertRange([{ service: 'a', platform: 'any', lowCents: 1, highCents: 2 }], { service: 'a', platform: 'any', lowCents: 3, highCents: 4 });
    expect(next).toEqual([{ service: 'a', platform: 'any', lowCents: 3, highCents: 4 }]);
  });
});

describe('A/B tests', () => {
  test('bucket is stable and roughly even', () => {
    expect(abBucket('visitor-123', 't1', 2)).toBe(abBucket('visitor-123', 't1', 2));
    const counts = [0, 0];
    for (let i = 0; i < 2000; i++) counts[abBucket(`v${i}xxxxxx`, 'test', 2)]! += 1;
    expect(Math.abs(counts[0]! - counts[1]!)).toBeLessThan(200);
  });

  test('variants need two valid entries; stats compute rates', () => {
    expect(parseVariants([{ key: 'a', text: 'One' }])).toEqual([]);
    const variants = parseVariants([{ key: 'a', text: 'One' }, { key: 'b', text: 'Two' }, { key: 'BAD', text: 'x' }]);
    expect(variants).toHaveLength(2);
    const stats = abStats(variants, [{ variant: 'a', kind: 'exposure' }, { variant: 'a', kind: 'exposure' }, { variant: 'a', kind: 'conversion' }]);
    expect(stats[0]).toEqual({ key: 'a', exposures: 2, conversions: 1, rate: 0.5 });
    expect(stats[1]!.rate).toBe(0);
  });
});

describe('cookie consent', () => {
  test('round trip and re-prompt on new policy version', () => {
    const raw = encodeConsent({ version: '2026-09-17', analytics: true, ads: false });
    expect(parseConsent(raw)).toEqual({ version: '2026-09-17', analytics: true, ads: false });
    expect(needsConsentPrompt(parseConsent(raw), '2026-09-17')).toBe(false);
    expect(needsConsentPrompt(parseConsent(raw), '2026-10-01')).toBe(true);
    expect(parseConsent('v=<x>&a=1')).toBeNull();
  });
});

describe('call tracking', () => {
  test('numbers normalize and match source exactly', () => {
    expect(toE164Us('(843) 555-0101')).toBe('+18435550101');
    expect(toE164Us('555')).toBeNull();
    const numbers = [{ source: 'google', phone: '+18435550101' }];
    expect(numberForSource(numbers, 'Google')?.phone).toBe('+18435550101');
    expect(numberForSource(numbers, 'facebook')).toBeNull();
    expect(numberForSource(numbers, null)).toBeNull();
  });
});

describe('social proof', () => {
  test('never shows small numbers', () => {
    expect(socialProofMessage({ finishedJobs: 2, dynoRuns: 1 })).toBeNull();
    expect(socialProofMessage({ finishedJobs: 7, dynoRuns: 2 })).toBe('7 trucks finished in our shop this week');
    expect(socialProofMessage({ finishedJobs: 7, dynoRuns: 4 })).toBe('4 trucks on our dyno this week');
  });
});

describe('chat and waitlist helpers', () => {
  test('chat body strips control characters and caps length', () => {
    expect(cleanChatBody('  hi there ')).toBe('hi there');
    expect(cleanChatBody('x'.repeat(1001))).toBeNull();
    expect(cleanChatBody('   ')).toBeNull();
  });

  test('shop hours in shop time zone', () => {
    const hours = { open: 8, close: 18, days: [1, 2, 3, 4, 5] };
    expect(isShopOpen(new Date('2026-09-17T15:00:00Z'), 'America/New_York', hours)).toBe(true); // Thu 11am
    expect(isShopOpen(new Date('2026-09-17T23:30:00Z'), 'America/New_York', hours)).toBe(false); // Thu 7:30pm
    expect(isShopOpen(new Date('2026-09-19T15:00:00Z'), 'America/New_York', hours)).toBe(false); // Sat
  });

  test('waitlist topics are slugged', () => {
    expect(waitlistTopic('product', 'S&B Cold Air Intake!')).toBe('product:s-b-cold-air-intake');
    expect(waitlistTopic('tune', '')).toBeNull();
  });
});

describe('abandoned form follow-up', () => {
  const base = { id: 'p1', updatedAt: '2026-09-17T13:00:00Z', remindConsent: true, convertedLeadId: null, followedUpAt: null, email: 'a@b.co', phone: '(843) 555-0101' };

  test('only opted-in, idle, unconverted partials without a later lead', () => {
    expect(duePartialFollowUps([base], [], now)).toHaveLength(1);
    expect(duePartialFollowUps([{ ...base, remindConsent: false }], [], now)).toHaveLength(0);
    expect(duePartialFollowUps([{ ...base, updatedAt: '2026-09-17T14:30:00Z' }], [], now)).toHaveLength(0);
    expect(duePartialFollowUps([{ ...base, updatedAt: '2026-09-10T14:30:00Z' }], [], now)).toHaveLength(0);
    expect(duePartialFollowUps([{ ...base, followedUpAt: '2026-09-17T14:00:00Z' }], [], now)).toHaveLength(0);
    expect(duePartialFollowUps([base], [{ email: 'A@B.CO', phone: 'x', createdAt: '2026-09-17T13:05:00Z' }], now)).toHaveLength(0);
    expect(duePartialFollowUps([base], [{ email: 'a@b.co', phone: 'x', createdAt: '2026-08-01T00:00:00Z' }], now)).toHaveLength(1);
  });
});

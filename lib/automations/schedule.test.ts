import { describe, expect, test } from 'vitest';
import { AUTOMATIONS, describeTiming } from './catalog';
import { applyQuietHours, computeScheduledFor, dedupeKey } from './schedule';

const eventAt = new Date('2026-09-16T14:00:00Z');

describe('computeScheduledFor', () => {
  test('fires instantly for zero-delay event automations', () => {
    expect(computeScheduledFor({ anchor: 'event', delayMinutes: 0, eventAt })).toEqual(eventAt);
  });

  test('adds the delay for event automations', () => {
    expect(computeScheduledFor({ anchor: 'event', delayMinutes: 1440, eventAt })?.toISOString()).toBe('2026-09-17T14:00:00.000Z');
  });

  test('schedules reminders before the appointment start', () => {
    const appointmentStartsAt = new Date('2026-09-20T13:00:00Z');
    expect(
      computeScheduledFor({ anchor: 'before_appointment', delayMinutes: 1440, eventAt, appointmentStartsAt })?.toISOString(),
    ).toBe('2026-09-19T13:00:00.000Z');
  });

  test('skips a reminder whose time has already passed', () => {
    const appointmentStartsAt = new Date('2026-09-16T17:00:00Z');
    expect(computeScheduledFor({ anchor: 'before_appointment', delayMinutes: 1440, eventAt, appointmentStartsAt })).toBeNull();
  });

  test('skips appointment reminders when there is no appointment', () => {
    expect(computeScheduledFor({ anchor: 'before_appointment', delayMinutes: 120, eventAt })).toBeNull();
  });
});

describe('applyQuietHours', () => {
  test('leaves daytime sends alone', () => {
    const noonEastern = new Date('2026-09-16T16:00:00Z');
    expect(applyQuietHours(noonEastern)).toEqual(noonEastern);
  });

  test('pushes a late-night send to 8am Eastern', () => {
    const elevenPmEastern = new Date('2026-09-17T03:00:00Z');
    expect(applyQuietHours(elevenPmEastern).toISOString()).toBe('2026-09-17T12:00:00.000Z');
  });

  test('pushes an early-morning send to 8am the same day', () => {
    const sixAmEastern = new Date('2026-09-16T10:00:00Z');
    expect(applyQuietHours(sixAmEastern).toISOString()).toBe('2026-09-16T12:00:00.000Z');
  });
});

describe('dedupeKey', () => {
  test('is stable for the same subject', () => {
    expect(dedupeKey('review_request', 'invoice', 'abc')).toBe(dedupeKey('review_request', 'invoice', 'abc'));
    expect(dedupeKey('a', 'lead', null, 'x')).toBe('a:lead:none:x');
  });
});

describe('catalog', () => {
  test('keys are unique and every channel has copy', () => {
    const keys = AUTOMATIONS.map((a) => a.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const automation of AUTOMATIONS) {
      if (automation.channels.includes('sms')) expect(automation.sms, automation.key).toBeTruthy();
      if (automation.channels.includes('email')) {
        expect(automation.emailSubject, automation.key).toBeTruthy();
        expect(automation.emailBody, automation.key).toBeTruthy();
      }
    }
  });

  test('describes timing in plain words', () => {
    expect(describeTiming({ anchor: 'event', delayMinutes: 0 })).toBe('Instantly');
    expect(describeTiming({ anchor: 'event', delayMinutes: 4320 })).toBe('3 days after');
    expect(describeTiming({ anchor: 'before_appointment', delayMinutes: 120 })).toBe('2 hours before appointment');
  });
});

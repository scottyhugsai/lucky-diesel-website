import { describe, expect, test } from 'vitest';
import { LIMITS } from './rate-limit';

describe('the request limits', () => {
  test('covers every public endpoint that accepts a write', () => {
    expect(Object.keys(LIMITS).sort()).toEqual(
      ['lead', 'lead-partial', 'preferences', 'referral', 'report-feed', 'waitlist'].sort(),
    );
  });

  test('every limit is a real window and a real ceiling', () => {
    for (const [bucket, limit] of Object.entries(LIMITS)) {
      expect(limit.windowSeconds, bucket).toBeGreaterThan(0);
      expect(limit.max, bucket).toBeGreaterThan(0);
      // A window longer than an hour outlives the index that sweeps old rows.
      expect(limit.windowSeconds, bucket).toBeLessThanOrEqual(3600);
    }
  });

  // The lead form is the one an attacker gets paid to flood, so it is the
  // tightest. If someone loosens it past the others this fails.
  test('the lead form is the strictest of them', () => {
    for (const [bucket, limit] of Object.entries(LIMITS)) {
      if (bucket !== 'lead') expect(limit.max, bucket).toBeGreaterThanOrEqual(LIMITS.lead.max);
    }
  });
});

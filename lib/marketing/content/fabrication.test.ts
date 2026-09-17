import { describe, expect, it } from 'vitest';
import { findUnverifiedClaims } from './fabrication';

describe('findUnverifiedClaims', () => {
  const facts = { leads: 42, spendCents: 125_000, cpl: '$29.76', rating: 4.8, phone: '(843) 555-0142', gain: '+110 hp' };

  it('passes numbers that come from the facts, including cents as dollars', () => {
    const report = findUnverifiedClaims('42 leads for $1,250 ($29.76 each). Rated 4.8 stars. Call (843) 555-0142. Up to 110 hp.', facts);
    expect(report).toEqual({ ok: true, unverified: [] });
  });

  it('flags invented numbers, prices and percentages', () => {
    const report = findUnverifiedClaims('Save 20% — only $199 this week, 300 happy customers.', facts);
    expect(report.ok).toBe(false);
    expect(report.unverified).toEqual(['20%', '$199', '300']);
  });

  it('flags an invented phone number', () => {
    expect(findUnverifiedClaims('Call 843-555-9999', facts).unverified).toEqual(['8435559999']);
  });

  it('ignores small counts, years and URLs', () => {
    expect(findUnverifiedClaims('3 quick tips for your 2019 Ram: https://x.com/a/123456', facts).ok).toBe(true);
  });
});

import { describe, expect, test } from 'vitest';
import { decodeAttributionCookie, encodeAttributionCookie, nextAttribution, normalizeSourceName, parseTouch } from './attribution-touch';

const now = new Date('2026-09-17T15:00:00Z');
const touch = (href: string, referrer: string | null = null) => parseTouch(new URL(href), referrer, now);

describe('parseTouch', () => {
  test('UTM source wins and is normalised', () => {
    expect(touch('https://luckydiesel.com/book?utm_source=IG&utm_medium=paid_social&utm_campaign=towing')).toMatchObject({ source: 'instagram', medium: 'paid_social', campaign: 'towing', landingPath: '/book' });
    expect(touch('https://luckydiesel.com/?utm_source=facebook')?.source).toBe('facebook');
    expect(touch('https://luckydiesel.com/?utm_source=newsletter')?.source).toBe('email');
  });

  test('click ids imply the platform and a paid medium', () => {
    expect(touch('https://luckydiesel.com/?gclid=abc')).toMatchObject({ source: 'google', medium: 'paid', gclid: 'abc' });
    expect(touch('https://luckydiesel.com/?wbraid=abc')?.source).toBe('google');
    expect(touch('https://luckydiesel.com/?fbclid=AbC')).toMatchObject({ source: 'facebook', fbclid: 'AbC' });
    expect(touch('https://luckydiesel.com/?ttclid=1')?.source).toBe('tiktok');
    expect(touch('https://luckydiesel.com/?msclkid=1')?.source).toBe('bing');
  });

  test('referral codes and campaign ids are validated', () => {
    expect(touch('https://luckydiesel.com/book?ref=cody-7kq2')).toMatchObject({ source: 'referral', ref: 'CODY-7KQ2' });
    expect(touch('https://luckydiesel.com/book?ref=<script>')?.ref).toBeNull();
    expect(touch('https://luckydiesel.com/?ld_cid=not-a-uuid&utm_source=sms')?.campaignId).toBeNull();
  });

  test('external referrers become organic/referral touches; internal navigation is ignored', () => {
    expect(touch('https://luckydiesel.com/duramax', 'https://www.google.com/')).toMatchObject({ source: 'google', medium: 'organic' });
    expect(touch('https://luckydiesel.com/', 'https://l.instagram.com/?u=x')?.source).toBe('instagram');
    expect(touch('https://luckydiesel.com/', 'https://dieselforum.example/thread')).toMatchObject({ source: 'other', medium: 'referral' });
    expect(touch('https://luckydiesel.com/book', 'https://luckydiesel.com/')).toBeNull();
    expect(touch('https://luckydiesel.com/book')).toBeNull();
  });

  test('values are trimmed to a safe length', () => {
    expect(touch(`https://luckydiesel.com/?utm_campaign=${'x'.repeat(500)}`)?.campaign).toHaveLength(200);
  });
});

describe('attribution cookie', () => {
  test('round-trips, keeps first touch, replaces last touch', () => {
    const first = touch('https://luckydiesel.com/?utm_source=tiktok')!;
    const second = touch('https://luckydiesel.com/?gclid=x')!;
    const start = nextAttribution(null, first, () => 'anon12345678');
    const later = nextAttribution(decodeAttributionCookie(encodeAttributionCookie(start)), second, () => 'unused000000');
    expect(later.aid).toBe('anon12345678');
    expect(later.ft?.source).toBe('tiktok');
    expect(later.lt?.source).toBe('google');
    expect(nextAttribution(later, null, () => 'x').lt?.source).toBe('google');
  });

  test('rejects tampered or malformed cookies', () => {
    expect(decodeAttributionCookie('not-base64!!')).toBeNull();
    expect(decodeAttributionCookie(btoa(JSON.stringify({ aid: 'short' })))).toBeNull();
    const forged = decodeAttributionCookie(btoa(JSON.stringify({ aid: 'anon12345678', ft: { source: 'hacker', at: now.toISOString(), landingPath: '/' }, lt: null })));
    expect(forged).toEqual({ aid: 'anon12345678', ft: null, lt: null });
  });
});

describe('normalizeSourceName', () => {
  test('maps legacy customer sources', () => {
    expect(normalizeSourceName('website')).toBe('direct');
    expect(normalizeSourceName('online booking')).toBe('direct');
    expect(normalizeSourceName('Instagram')).toBe('instagram');
    expect(normalizeSourceName('referral')).toBe('referral');
    expect(normalizeSourceName('yard sign')).toBe('other');
  });
});

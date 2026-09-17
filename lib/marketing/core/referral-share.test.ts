import { describe, expect, test } from 'vitest';
import { referralHeadline, referralShareText, referralShareUrl } from './referral-share';

describe('referral share', () => {
  test('personal link uses the refer page and encodes the code', () => {
    expect(referralShareUrl('https://luckydiesel.com/', 'CODY-7KQ2')).toBe('https://luckydiesel.com/refer/CODY-7KQ2');
  });

  test('generic link is the home page tagged as a referral share', () => {
    expect(referralShareUrl('https://luckydiesel.com', null)).toBe('https://luckydiesel.com/?utm_source=referral&utm_medium=share&utm_campaign=refer-a-friend');
  });

  test('offer copy only when a code and a discount exist', () => {
    expect(referralShareText({ code: 'CODY-7KQ2', discountCents: 2500 }, 'Lucky Diesel')).toContain('$25 off');
    expect(referralShareText({ code: 'CODY-7KQ2', discountCents: 0 }, 'Lucky Diesel')).not.toContain('off');
    expect(referralShareText({ code: null, discountCents: 2500 }, 'Lucky Diesel')).not.toContain('off');
    expect(referralHeadline({ code: 'X-1234', discountCents: 2599 })).toBe('Give $25, get rewarded');
    expect(referralHeadline({ code: null, discountCents: 2500 })).toBe('Know a diesel owner?');
  });
});

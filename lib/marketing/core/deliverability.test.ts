import { describe, expect, test } from 'vitest';
import { checkDeliverability, domainOf, evaluateAuthRecords, extractUrls, formatSender } from './deliverability';

describe('checkDeliverability', () => {
  test('clean copy passes', () => {
    expect(checkDeliverability({ channel: 'email', subject: 'Towing season check', body: 'Hey {{first_name}}, book here: {{link}}' })).toEqual([]);
  });

  test('flags spam words, caps, exclamations and shorteners', () => {
    const rules = checkDeliverability({ channel: 'sms', body: 'ACT NOW!!! FREE MONEY ON ALL TURBO PARTS https://bit.ly/x {{link}}' }).map((i) => `${i.rule}:${i.severity}`);
    expect(rules).toEqual(expect.arrayContaining(['spam_words:warn', 'all_caps:warn', 'exclamation:warn', 'public_shortener:block', 'sms_links:warn']));
  });

  test('extracts urls without trailing punctuation', () => {
    expect(extractUrls('See https://a.test/x. And http://b.test!')).toEqual(['https://a.test/x', 'http://b.test']);
  });
});

describe('formatSender', () => {
  test('uses the stored name and email, stripping header injection', () => {
    expect(formatSender('Jake at Lucky "Diesel"\r\nBcc: x', 'jake@luckydiesel.com', 'x@y.com')).toBe('Jake at Lucky DieselBcc: x <jake@luckydiesel.com>');
    expect(formatSender('Jake', null, 'Lucky Diesel <onboarding@resend.dev>')).toBe('Jake <onboarding@resend.dev>');
    expect(formatSender('', 'bad', 'Lucky <a@b.co>')).toBe('a@b.co');
  });

  test('domainOf validates the host', () => {
    expect(domainOf('news@Mail.LuckyDiesel.com')).toBe('mail.luckydiesel.com');
    expect(domainOf('x@localhost')).toBeNull();
  });
});

describe('evaluateAuthRecords', () => {
  test('grades SPF, DKIM and DMARC', () => {
    const checks = evaluateAuthRecords({ spf: ['v=spf1 include:amazonses.com ~all'], dkim: [`p=${'A'.repeat(60)}`], dmarc: ['v=DMARC1; p=none'] });
    expect(checks.map((c) => c.state)).toEqual(['pass', 'pass', 'warn']);
    expect(evaluateAuthRecords({ spf: [], dkim: [], dmarc: [] }).map((c) => c.state)).toEqual(['missing', 'missing', 'missing']);
  });
});

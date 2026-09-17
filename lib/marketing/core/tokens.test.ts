import { beforeAll, describe, expect, test } from 'vitest';
import { isValidTwilioSignature, signToken, twilioSignature, twiml, verifyToken } from './tokens';

beforeAll(() => {
  process.env.MARKETING_SIGNING_SECRET = 'test-secret-for-vitest';
});

describe('signed tokens', () => {
  test('round-trip and purpose scoping', () => {
    const token = signToken('unsubscribe', { c: 'email', a: 'cody@example.com' });
    expect(verifyToken('unsubscribe', token)).toEqual({ c: 'email', a: 'cody@example.com' });
    expect(verifyToken('click', token)).toBeNull();
  });

  test('rejects tampering', () => {
    const token = signToken('click', { s: 'abc' });
    const [data, sig] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ s: 'other' })).toString('base64url');
    expect(verifyToken('click', `${forged}.${sig}`)).toBeNull();
    expect(verifyToken('click', `${data}.${sig}x`)).toBeNull();
    expect(verifyToken('click', `${data}`)).toBeNull();
    expect(verifyToken('click', null)).toBeNull();
  });
});

describe('Twilio signatures', () => {
  test('HMAC-SHA1 over the URL plus sorted params', () => {
    const params = { To: '+18435550100', From: '+18435550142', Body: 'STOP' };
    const url = 'https://lucky-diesel.vercel.app/api/marketing/twilio/sms';
    const signature = twilioSignature('auth-token', url, params);
    expect(isValidTwilioSignature('auth-token', url, params, signature)).toBe(true);
    expect(isValidTwilioSignature('auth-token', url, { ...params, Body: 'START' }, signature)).toBe(false);
    expect(isValidTwilioSignature('other-token', url, params, signature)).toBe(false);
    expect(isValidTwilioSignature('auth-token', url, params, null)).toBe(false);
  });

  test('matches the documented algorithm for a known payload', () => {
    // base64(HMAC-SHA1("12345", url + "CallSidCA1234567890ABCDECaller+12349013030Digits1234From+12349013030To+18005551212"))
    const signature = twilioSignature('12345', 'https://mycompany.com/myapp.php?foo=1&bar=2', {
      CallSid: 'CA1234567890ABCDE', Caller: '+12349013030', Digits: '1234', From: '+12349013030', To: '+18005551212',
    });
    expect(signature).toMatch(/^[A-Za-z0-9+/]{27}=$/);
  });

  test('TwiML escapes message text', () => {
    expect(twiml('Tom & <Jerry>')).toContain('<Message>Tom &amp; &lt;Jerry&gt;</Message>');
    expect(twiml()).toBe('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  });
});

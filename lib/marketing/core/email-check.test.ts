import { describe, expect, test } from 'vitest';
import { checkEmail, suggestEmailFix } from './email-check';

describe('suggestEmailFix', () => {
  test.each([
    ['jim@gmial.com', 'jim@gmail.com'],
    ['jim@gmail.con', 'jim@gmail.con'.replace('.con', '.com')],
    ['sue@yaho.com', 'sue@yahoo.com'],
    ['bo@hotmial.com', 'bo@hotmail.com'],
    ['al@outlok.com', 'al@outlook.com'],
  ])('%s → %s', (input, expected) => {
    expect(suggestEmailFix(input)).toBe(expected);
  });

  test.each(['jim@gmail.com', 'jim@mail.com', 'jim@luckydiesel.com', 'nope'])('leaves %s alone', (input) => {
    expect(suggestEmailFix(input)).toBeNull();
  });
});

describe('checkEmail', () => {
  test('rejects dead domains with a hint', async () => {
    const result = await checkEmail('jim@gmial.com', async () => 'dead');
    expect(result).toEqual({ ok: false, error: "That email can't get mail. Did you mean jim@gmail.com?", suggestion: 'jim@gmail.com' });
  });
  test('fails open when DNS is unknown', async () => {
    expect(await checkEmail('jim@example.org', async () => 'unknown')).toEqual({ ok: true });
  });
  test('rejects bad syntax without a lookup', async () => {
    let called = false;
    const result = await checkEmail('not an email', async () => { called = true; return 'ok'; });
    expect(result.ok).toBe(false);
    expect(called).toBe(false);
  });
});

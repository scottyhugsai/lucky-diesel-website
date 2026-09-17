import { randomBytes } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import { decryptToken, encryptToken, hasTokenKey, keyId } from './crypto';

const key = randomBytes(32).toString('base64');

describe('token encryption', () => {
  test('round-trips and never contains the plaintext', () => {
    const token = 'EAAG-secret-access-token-123';
    const sealed = encryptToken(token, key);
    expect(sealed).not.toContain(token);
    expect(sealed.startsWith(`v1.${keyId(key)}.`)).toBe(true);
    expect(decryptToken(sealed, key)).toBe(token);
  });

  test('uses a fresh IV each time', () => {
    expect(encryptToken('same', key)).not.toBe(encryptToken('same', key));
  });

  test('accepts hex keys and rejects bad or missing keys', () => {
    const hex = randomBytes(32).toString('hex');
    expect(decryptToken(encryptToken('x', hex), hex)).toBe('x');
    expect(hasTokenKey('short')).toBe(false);
    expect(hasTokenKey(undefined)).toBe(false);
    expect(() => encryptToken('x', undefined)).toThrow(/MARKETING_TOKEN_KEY/);
  });

  test('detects a rotated key and tampering', () => {
    const sealed = encryptToken('secret', key);
    expect(() => decryptToken(sealed, randomBytes(32).toString('base64'))).toThrow(/different/);
    const parts = sealed.split('.');
    parts[4] = Buffer.from('tampered').toString('base64url');
    expect(() => decryptToken(parts.join('.'), key)).toThrow();
  });
});

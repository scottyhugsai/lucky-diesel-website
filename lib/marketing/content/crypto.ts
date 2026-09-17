import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * AES-256-GCM for platform access/refresh tokens. The key comes from
 * MARKETING_TOKEN_KEY: 32 bytes as base64 or 64 hex characters. Ciphertext
 * format: v1.<keyId>.<iv>.<tag>.<data> (base64url parts). The key id lets a
 * rotated key be detected instead of producing garbage.
 */

const VERSION = 'v1';
const IV_BYTES = 12;
const KEY_BYTES = 32;

function parseKey(material: string | undefined): Buffer {
  const raw = material?.trim();
  if (!raw) throw new Error('MARKETING_TOKEN_KEY is not set');
  if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, 'hex');
  const decoded = Buffer.from(raw, 'base64');
  if (decoded.length === KEY_BYTES) return decoded;
  throw new Error('MARKETING_TOKEN_KEY must be 32 bytes (base64) or 64 hex characters');
}

const TAG_BYTES = 16;

export function keyId(material: string | undefined = process.env.MARKETING_TOKEN_KEY): string {
  return createHash('sha256').update(parseKey(material)).digest('hex').slice(0, 8);
}

export function hasTokenKey(material: string | undefined = process.env.MARKETING_TOKEN_KEY): boolean {
  try {
    parseKey(material);
    return true;
  } catch {
    return false;
  }
}

export function encryptToken(plaintext: string, material: string | undefined = process.env.MARKETING_TOKEN_KEY): string {
  const key = parseKey(material);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, keyId(material), iv.toString('base64url'), tag.toString('base64url'), data.toString('base64url')].join('.');
}

export function decryptToken(payload: string, material: string | undefined = process.env.MARKETING_TOKEN_KEY): string {
  const [version, id, iv, tag, data] = payload.split('.');
  if (version !== VERSION || !id || !iv || !tag || data === undefined) throw new Error('Unrecognised token ciphertext');
  if (id !== keyId(material)) throw new Error('Token was encrypted with a different MARKETING_TOKEN_KEY');
  const decipher = createDecipheriv('aes-256-gcm', parseKey(material), Buffer.from(iv, 'base64url'), { authTagLength: TAG_BYTES });
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}

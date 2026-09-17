import { describe, expect, test } from 'vitest';
import { encodeQr, formatBits, pickVersion, qrSvgPath } from './qr';

/* Output was also verified by decoding with jsQR for versions 1–10 during development. */

describe('QR encoder', () => {
  test('picks the smallest version for level M byte mode', () => {
    expect(pickVersion(14)).toBe(1);
    expect(pickVersion(15)).toBe(2);
    expect(pickVersion(213)).toBe(10);
    expect(pickVersion(214)).toBeNull();
  });

  test('format bits match the spec table for level M', () => {
    // ISO 18004 Annex C: M, mask 0 = 101010000010010.
    expect(formatBits(0)).toBe(0b101010000010010);
    expect(formatBits(5)).toBe(0b100000011001110);
    expect(formatBits(7)).toBe(0b100101010100000);
  });

  test('matrix has finder patterns, timing and the dark module', () => {
    const qr = encodeQr('https://luckydiesel.com/r/abc123')!;
    expect(qr.size).toBe(qr.version * 4 + 17);
    const row0 = qr.modules[0]!;
    expect(row0.slice(0, 7).every(Boolean)).toBe(true);
    expect(qr.modules[1]!.slice(1, 6).some(Boolean)).toBe(false);
    expect(qr.modules[6]!.slice(8, qr.size - 8).map((d, i) => d === (i % 2 === 0)).every(Boolean)).toBe(true);
    expect(qr.modules[qr.size - 8]![8]).toBe(true);
  });

  test('svg path draws one square per dark module inside the quiet zone', () => {
    const qr = encodeQr('a')!;
    const dark = qr.modules.flat().filter(Boolean).length;
    const { path, viewBox } = qrSvgPath(qr);
    expect(viewBox).toBe(29);
    expect(path.match(/M/g)).toHaveLength(dark);
  });

  test('too long returns null', () => {
    expect(encodeQr('x'.repeat(300))).toBeNull();
  });
});

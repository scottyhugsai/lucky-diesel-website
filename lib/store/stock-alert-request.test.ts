import { describe, expect, it } from 'vitest';
import { parseStockAlert } from './stock-alert-request';

const body = { topic: 'product:s-b-intake', label: 'S&B Cold Air Intake', email: 'Owner@Example.com', company: '' };

describe('parseStockAlert', () => {
  it('accepts a product topic and normalises the email and handle', () => {
    const parsed = parseStockAlert(body);
    expect(parsed).toEqual({ ok: true, value: { handle: 's-b-intake', email: 'owner@example.com', productTitle: 'S&B Cold Air Intake' } });
  });

  it('treats a filled honeypot as spam so the caller can answer ok', () => {
    const parsed = parseStockAlert({ ...body, company: 'bot inc' });
    expect(parsed.ok).toBe(false);
    expect(parsed.ok === false && parsed.spam).toBe(true);
  });

  it('rejects a non-product topic or a handle the table would refuse', () => {
    expect(parseStockAlert({ ...body, topic: 'tune:duramax' }).ok).toBe(false);
    expect(parseStockAlert({ ...body, topic: 'product:-leading-dash' }).ok).toBe(false);
    expect(parseStockAlert({ ...body, topic: 'product:Upper Case' }).ok).toBe(false);
  });

  it('rejects a bad email and a missing label', () => {
    expect(parseStockAlert({ ...body, email: 'nope' }).ok).toBe(false);
    expect(parseStockAlert({ ...body, label: '   ' }).ok).toBe(false);
  });

  it('rejects a non-object payload without claiming spam', () => {
    const parsed = parseStockAlert(null);
    expect(parsed.ok === false && parsed.spam).toBe(false);
  });

  it('caps a very long product title', () => {
    const parsed = parseStockAlert({ ...body, label: 'x'.repeat(400) });
    expect(parsed.ok && parsed.value.productTitle.length).toBe(200);
  });
});

import { describe, expect, test } from 'vitest';
import { inquiryRow, parseFleetInquiry } from './fleet-inquiry';

const valid = { name: 'Palmetto Hauling', contactName: 'Dana Reed', email: 'Dana@Palmetto.com', phone: '843-995-9252', truckCount: '12', city: 'Summerville' };

describe('parseFleetInquiry', () => {
  test('accepts a complete inquiry and normalizes email and phone', () => {
    const parsed = parseFleetInquiry(valid);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.email).toBe('dana@palmetto.com');
    expect(parsed.value.phone).toBe('(843) 995-9252');
    expect(parsed.value.truckCount).toBe(12);
    expect(parsed.value.city).toBe('Summerville');
  });

  test('treats a filled honeypot as spam without reporting errors', () => {
    const parsed = parseFleetInquiry({ ...valid, company: 'bot' });

    expect(parsed).toEqual({ ok: false, spam: true });
  });

  test('reports a field error for each missing or malformed required field', () => {
    const parsed = parseFleetInquiry({ name: 'A', contactName: '', email: 'nope', phone: '12345' });

    expect(parsed.ok).toBe(false);
    if (parsed.ok || parsed.spam) return;
    expect(Object.keys(parsed.errors).sort()).toEqual(['contactName', 'email', 'name', 'phone']);
  });

  test('leaves truck count null when omitted but rejects a non-integer', () => {
    const blank = parseFleetInquiry({ ...valid, truckCount: '' });
    expect(blank.ok && blank.value.truckCount).toBeNull();

    const bad = parseFleetInquiry({ ...valid, truckCount: '4.5' });
    expect(bad.ok).toBe(false);
    if (bad.ok || bad.spam) return;
    expect(bad.errors.truckCount).toBeDefined();
  });

  test('accepts an 11-digit number with a leading country code', () => {
    const parsed = parseFleetInquiry({ ...valid, phone: '+1 843 995 9252' });

    expect(parsed.ok && parsed.value.phone).toBe('(843) 995-9252');
  });

  test('rejects a non-object body', () => {
    expect(parseFleetInquiry(null).ok).toBe(false);
    expect(parseFleetInquiry('nope').ok).toBe(false);
  });
});

describe('inquiryRow', () => {
  test('lands as an inactive prospect so terms and priority bays stay off', () => {
    const parsed = parseFleetInquiry(valid);
    if (!parsed.ok) throw new Error('fixture should parse');

    const row = inquiryRow(parsed.value);

    expect(row.stage).toBe('prospect');
    expect(row.active).toBe(false);
    expect(row.source).toBe('fleet');
  });
});

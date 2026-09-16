import { describe, expect, test } from 'vitest';
import { parseLead } from './lead';

const valid = {
  name: 'Cody Brooks',
  phone: '(843) 555-0142',
  email: 'cody@example.com',
  platform: 'duramax',
  generation: '2017–Present L5P 6.6L',
  mileage: '84,000',
  service: 'tuning',
  details: 'Looking for a tune and a 5" exhaust on my L5P.',
  company: '',
};

describe('parseLead', () => {
  test('accepts a complete request and normalises the phone number', () => {
    const result = parseLead(valid);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lead.phone).toBe('(843) 555-0142');
    expect(result.lead.platformLabel).toBe('Duramax — 2017–Present L5P 6.6L');
    expect(result.lead.serviceLabel).toBe('Performance tuning');
  });

  test('accepts an 11-digit US number with a leading 1', () => {
    const result = parseLead({ ...valid, phone: '+1 843.555.0142' });

    expect(result.ok && result.lead.phone).toBe('(843) 555-0142');
  });

  test('reports every missing required field at once', () => {
    const result = parseLead({});

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual(
      ['details', 'email', 'name', 'phone', 'platform', 'service'].sort(),
    );
  });

  test('rejects a phone number with the wrong digit count', () => {
    const result = parseLead({ ...valid, phone: '555-0142' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.phone).toBeDefined();
  });

  test('rejects a malformed email', () => {
    const result = parseLead({ ...valid, email: 'cody@' });

    expect(!result.ok && result.errors.email).toBeTruthy();
  });

  test('rejects a generation that does not belong to the chosen platform', () => {
    const result = parseLead({ ...valid, platform: 'cummins' });

    expect(!result.ok && result.errors.generation).toBeTruthy();
  });

  test('allows the other-truck option without a generation', () => {
    const result = parseLead({ ...valid, platform: 'other', generation: '' });

    expect(result.ok && result.lead.platformLabel).toBe('Other truck / engine');
  });

  test('rejects unknown platforms and services', () => {
    const result = parseLead({ ...valid, platform: 'tesla', service: 'car-wash' });

    expect(!result.ok && Object.keys(result.errors).sort()).toEqual(['platform', 'service']);
  });

  test('flags a filled honeypot as spam without reporting errors', () => {
    const result = parseLead({ ...valid, company: 'Bot LLC' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.spam).toBe(true);
  });

  test('rejects non-object input', () => {
    expect(parseLead(null).ok).toBe(false);
    expect(parseLead('name=x').ok).toBe(false);
  });

  test('trims values and caps the details length', () => {
    const result = parseLead({ ...valid, name: '  Cody  ', details: 'x'.repeat(2001) });

    expect(!result.ok && result.errors.details).toBeTruthy();
    const trimmed = parseLead({ ...valid, name: '  Cody  ' });
    expect(trimmed.ok && trimmed.lead.name).toBe('Cody');
  });
});

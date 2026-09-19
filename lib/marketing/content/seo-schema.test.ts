import { describe, expect, test } from 'vitest';
import { BUSINESS } from '@/lib/site';
import { businessId, serviceSchema } from './seo-schema';

const base = 'https://example.com';

describe('one business, one node', () => {
  test('the business has a stable @id derived from the site URL', () => {
    expect(businessId(base)).toBe(`${base}/#business`);
  });

  // Two AutoRepair nodes for one shop is two businesses as far as a parser is
  // concerned, and neither inherits the other's signals. The service page
  // points at the entity the root layout publishes rather than describing it
  // again — which is also what stopped the two phone formats disagreeing.
  test('a service names its provider by reference, never by copying it', () => {
    const provider = serviceSchema({
      name: 'Duramax repair', description: 'x', url: `${base}/duramax`, serviceType: 'Diesel truck repair', base,
    }).provider as Record<string, unknown>;

    expect(provider).toEqual({ '@id': businessId(base) });
    expect(provider['@type']).toBeUndefined();
    expect(provider.telephone).toBeUndefined();
    expect(provider.name).toBeUndefined();
  });

  test('no service schema restates the phone number in any format', () => {
    const json = JSON.stringify(serviceSchema({
      name: 'x', description: 'x', url: base, serviceType: 'x', base,
    }));
    expect(json).not.toContain(BUSINESS.phoneDisplay);
    expect(json).not.toContain('843');
  });

  test('the service still carries its own name, type and area', () => {
    const schema = serviceSchema({
      name: 'Cummins repair', description: 'd', url: `${base}/cummins`, serviceType: 'Diesel truck repair', base, area: 'Summerville',
    });
    expect(schema['@type']).toBe('Service');
    expect(schema.name).toBe('Cummins repair');
    expect(schema.areaServed).toEqual({ '@type': 'City', name: 'Summerville' });
  });
});

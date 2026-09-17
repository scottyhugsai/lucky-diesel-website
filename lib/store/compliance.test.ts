import { createHmac, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { complianceFor, highValueCarts, isPromotable, normalizeEoNumber, productFeedTsv, type ComplianceMap } from './compliance';
import { parseShopifyCustomer, parseShopifyOrder, verifyShopifyHmac } from './shopify-webhook';

const map: ComplianceMap = new Map([['eo-tuner', { status: 'carb_eo', eoNumber: 'D-123-45' }], ['sema-pipe', { status: 'sema_verified', eoNumber: null }]]);

describe('SKU compliance', () => {
  it('defaults emissions parts to unverified and blocks them from promos', () => {
    expect(complianceFor({ handle: 'x', category: 'tuning', offRoadOnly: false }, map)).toBe('unverified');
    expect(complianceFor({ handle: 'hat', category: 'merch', offRoadOnly: false }, map)).toBe('not_applicable');
    expect(isPromotable({ handle: 'eo-tuner', category: 'tuning', offRoadOnly: false }, map)).toBe(true);
    expect(isPromotable({ handle: 'eo-tuner', category: 'tuning', offRoadOnly: true }, map)).toBe(false);
    expect(isPromotable({ handle: 'other-tuner', category: 'tuning', offRoadOnly: false }, map)).toBe(false);
  });

  it('checks EO number format', () => {
    expect(normalizeEoNumber(' d-123-45 ')).toBe('D-123-45');
    expect(normalizeEoNumber('123')).toBeNull();
  });

  it('builds a feed with only promotable in-stock parts', () => {
    const base = { vendor: 'V', summary: 'Nice\tpart', available: true, priceMinCents: 12345, images: [{ src: 'https://cdn/x.png' }] };
    const tsv = productFeedTsv([
      { ...base, handle: 'eo-tuner', title: 'EO Tuner', category: 'tuning', offRoadOnly: false },
      { ...base, handle: 'delete', title: 'Race pipe', category: 'exhaust', offRoadOnly: true },
      { ...base, handle: 'hat', title: 'Hat', category: 'merch', offRoadOnly: false, images: [] },
    ], map, 'https://s');
    const lines = tsv.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe('eo-tuner\tEO Tuner\tNice part\tin stock\tnew\t123.45 USD\thttps://s/store/products/eo-tuner\thttps://cdn/x.png\tV');
  });

  it('lists unconverted high-value carts from the last day', () => {
    const now = new Date('2026-09-17T15:00:00Z');
    const carts = highValueCarts([
      { id: 'a', customerId: 'c1', valueCents: 250000, occurredAt: '2026-09-17T01:00:00Z' },
      { id: 'b', customerId: 'c2', valueCents: 300000, occurredAt: '2026-09-17T02:00:00Z' },
      { id: 'c', customerId: null, valueCents: 50000, occurredAt: '2026-09-17T02:00:00Z' },
      { id: 'd', customerId: null, valueCents: 400000, occurredAt: '2026-09-15T02:00:00Z' },
    ], new Set(['c2']), now);
    expect(carts.map((c) => c.id)).toEqual(['a']);
  });
});

describe('Shopify webhooks', () => {
  it('verifies the HMAC', () => {
    const body = '{"id":1}';
    const secret = randomBytes(16).toString('hex');
    const sig = createHmac('sha256', secret).update(body).digest('base64');
    expect(verifyShopifyHmac(body, sig, secret)).toBe(true);
    expect(verifyShopifyHmac(body, sig, 'nope')).toBe(false);
    expect(verifyShopifyHmac(body, null, secret)).toBe(false);
    expect(verifyShopifyHmac(body, 'short', 'shh')).toBe(false);
  });

  it('parses orders and consent', () => {
    const order = parseShopifyOrder({
      id: 5551234, name: '#1001', email: 'Jo@Example.com', total_price: '1695.00', currency: 'usd', financial_status: 'paid', created_at: '2026-09-16T10:00:00-04:00', line_items: [{}, {}],
      customer: { first_name: 'Jo', last_name: 'Smith', phone: '+1 843 555 0100', email_marketing_consent: { state: 'subscribed', consent_updated_at: '2026-09-16T14:00:00Z' }, sms_marketing_consent: { state: 'not_subscribed' } },
    });
    expect(order).toMatchObject({ shopifyOrderId: '5551234', email: 'jo@example.com', totalCents: 169500, currency: 'USD', lineCount: 2, orderedAt: '2026-09-16T14:00:00.000Z' });
    expect(order?.customer).toMatchObject({ fullName: 'Jo Smith', phone: '(843) 555-0100', emailMarketing: 'subscribed', smsMarketing: null });
    expect(parseShopifyOrder({ id: 'drop table' })).toBeNull();
    expect(parseShopifyCustomer({ first_name: 'No contact' })).toBeNull();
    expect(parseShopifyCustomer({ email: 'a@b.co', email_marketing_consent: { state: 'unsubscribed' } })?.emailMarketing).toBe('unsubscribed');
  });
});

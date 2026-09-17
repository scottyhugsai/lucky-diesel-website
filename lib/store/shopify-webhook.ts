import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Shopify webhook parsing (orders/create, orders/paid, customers/create,
 * customers/update). Pure: signature check + payload → our shapes.
 */

export const SHOPIFY_TOPICS = ['orders/create', 'orders/paid', 'customers/create', 'customers/update'] as const;
export type ShopifyTopic = (typeof SHOPIFY_TOPICS)[number];

export function isShopifyTopic(value: string | null): value is ShopifyTopic {
  return value !== null && (SHOPIFY_TOPICS as readonly string[]).includes(value);
}

/** `X-Shopify-Hmac-Sha256` is base64 HMAC-SHA256 of the raw body. */
export function verifyShopifyHmac(rawBody: string, header: string | null, secret: string): boolean {
  if (!header || !secret) return false;
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest();
  let given: Buffer;
  try {
    given = Buffer.from(header, 'base64');
  } catch {
    return false;
  }
  return given.length === expected.length && timingSafeEqual(given, expected);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown, max = 200): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : typeof v === 'number' ? String(v) : null);

function phoneOf(raw: unknown): string | null {
  const digits = typeof raw === 'string' ? raw.replace(/\D/g, '') : '';
  const local = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  return local.length === 10 ? `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}` : null;
}

export type MarketingState = 'subscribed' | 'unsubscribed' | null;

function marketingState(raw: unknown): MarketingState {
  const state = str(obj(raw).state, 40);
  if (state === 'subscribed') return 'subscribed';
  if (state === 'unsubscribed' || state === 'redacted') return 'unsubscribed';
  return null;
}

export interface ShopifyCustomer {
  email: string | null;
  phone: string | null;
  fullName: string;
  emailMarketing: MarketingState;
  smsMarketing: MarketingState;
  /** Shopify's own consent timestamp, kept as evidence. */
  consentUpdatedAt: string | null;
}

export function parseShopifyCustomer(payload: unknown): ShopifyCustomer | null {
  const c = obj(payload);
  const emailRaw = str(c.email, 254)?.toLowerCase() ?? null;
  const email = emailRaw && EMAIL.test(emailRaw) ? emailRaw : null;
  const phone = phoneOf(c.phone) ?? phoneOf(obj(c.default_address).phone);
  if (!email && !phone) return null;
  const fullName = [str(c.first_name, 60), str(c.last_name, 60)].filter(Boolean).join(' ') || (email ? email.split('@')[0]! : 'Store customer');
  const emailConsent = obj(c.email_marketing_consent);
  return {
    email, phone, fullName,
    emailMarketing: marketingState(emailConsent),
    smsMarketing: marketingState(c.sms_marketing_consent),
    consentUpdatedAt: str(emailConsent.consent_updated_at, 40),
  };
}

export interface ShopifyOrder {
  shopifyOrderId: string;
  orderName: string | null;
  email: string | null;
  totalCents: number;
  currency: string;
  financialStatus: string | null;
  lineCount: number;
  orderedAt: string;
  customer: ShopifyCustomer | null;
}

export function parseShopifyOrder(payload: unknown): ShopifyOrder | null {
  const o = obj(payload);
  const id = str(o.id, 40);
  if (!id || !/^\d{1,20}$/.test(id)) return null;
  const total = Number(str(o.current_total_price, 20) ?? str(o.total_price, 20) ?? '0');
  const created = str(o.created_at, 40);
  const orderedAt = created && !Number.isNaN(Date.parse(created)) ? new Date(created).toISOString() : new Date().toISOString();
  const emailRaw = str(o.email, 254)?.toLowerCase() ?? null;
  const customer = parseShopifyCustomer({ ...obj(o.customer), email: obj(o.customer).email ?? emailRaw });
  return {
    shopifyOrderId: id,
    orderName: str(o.name, 40),
    email: emailRaw && EMAIL.test(emailRaw) ? emailRaw : customer?.email ?? null,
    totalCents: Number.isFinite(total) && total > 0 ? Math.min(100_000_000, Math.round(total * 100)) : 0,
    currency: (str(o.currency, 3) ?? 'USD').toUpperCase(),
    financialStatus: str(o.financial_status, 40),
    lineCount: Array.isArray(o.line_items) ? o.line_items.length : 0,
    orderedAt,
    customer,
  };
}

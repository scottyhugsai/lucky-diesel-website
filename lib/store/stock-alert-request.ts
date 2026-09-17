/**
 * "Notify me when it's back" sign-up parsing. The public form posts the same
 * body shape as the generic waitlist (`topic`, `label`, `email`, `company`),
 * where the topic is `product:<handle>`. Pure so it can be unit tested.
 */

export const STOCK_ALERT_CONSENT_TEXT = 'Email me once when this part is back in stock. One email, no marketing.';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Same shape as the `sku_compliance.handle` check constraint. */
const HANDLE = /^[a-z0-9][a-z0-9-]{0,254}$/;
const TOPIC_PREFIX = 'product:';

export interface StockAlertRequest {
  handle: string;
  email: string;
  productTitle: string;
}

export type StockAlertParse = { ok: true; value: StockAlertRequest } | { ok: false; error: string; spam: boolean };

const fail = (error: string, spam = false): StockAlertParse => ({ ok: false, error, spam });

export function parseStockAlert(payload: unknown): StockAlertParse {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return fail('Bad request.');
  const body = payload as Record<string, unknown>;

  // Honeypot: answer as if it worked, but keep the row out of the table.
  if (typeof body.company === 'string' && body.company.trim()) return fail('Bad request.', true);

  const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
  if (!topic.startsWith(TOPIC_PREFIX)) return fail('Unknown product.');
  const handle = topic.slice(TOPIC_PREFIX.length).toLowerCase();
  if (!HANDLE.test(handle)) return fail('Unknown product.');

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!EMAIL.test(email) || email.length > 254) return fail('Enter a valid email.');

  const label = typeof body.label === 'string' ? body.label.trim().replace(/\s+/g, ' ') : '';
  if (!label) return fail('Unknown product.');

  return { ok: true, value: { handle, email, productTitle: label.slice(0, 200) } };
}

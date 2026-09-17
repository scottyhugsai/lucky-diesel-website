import 'server-only';
import { recordConsent } from '@/lib/marketing/core/consent';
import type { createAdminClient } from '@/lib/supabase/admin';
import type { ShopifyCustomer, ShopifyOrder } from './shopify-webhook';

type Db = ReturnType<typeof createAdminClient>;

/** Finds our customer by email then phone; creates one for store buyers. Never changes consent here. */
async function upsertCustomer(db: Db, customer: ShopifyCustomer): Promise<string | null> {
  if (customer.email) {
    const { data } = await db.from('customers').select('id').eq('email', customer.email).limit(1);
    if (data?.[0]) return data[0].id;
  }
  if (customer.phone) {
    const { data } = await db.from('customers').select('id').eq('phone', customer.phone).limit(1);
    if (data?.[0]) return data[0].id;
  }
  // New store buyers start unsubscribed: only Shopify's explicit consent below subscribes them.
  const { data, error } = await db.from('customers').insert({
    full_name: customer.fullName.slice(0, 120), email: customer.email, phone: customer.phone, source: 'store', email_marketing_status: 'unsubscribed',
  }).select('id').single();
  if (error) {
    console.error(`[shopify] customer insert failed: ${error.message}`);
    return null;
  }
  return data.id;
}

/** Mirrors Shopify's email/SMS marketing consent into our append-only ledger. */
export async function syncShopifyConsent(db: Db, customerId: string, customer: ShopifyCustomer): Promise<number> {
  let recorded = 0;
  const evidence = { source: 'shopify_webhook', shopify_consent_updated_at: customer.consentUpdatedAt };
  if (customer.email && customer.emailMarketing) {
    const { data } = await db.from('customers').select('email_marketing_status').eq('id', customerId).maybeSingle();
    const current = data?.email_marketing_status === 'subscribed' ? 'subscribed' : 'unsubscribed';
    // Bounces/complaints are never overwritten by a store checkbox.
    const blocked = data?.email_marketing_status === 'bounced' || data?.email_marketing_status === 'complained';
    if (!blocked && current !== customer.emailMarketing) {
      const result = await recordConsent(db, { customerId, channel: 'email', purpose: 'marketing', action: customer.emailMarketing === 'subscribed' ? 'granted' : 'revoked', method: 'import', address: customer.email, evidence });
      if (result.ok) recorded += 1;
    }
  }
  // SMS: only opt-outs sync. An SMS opt-in needs our own TCPA consent text, not Shopify's checkbox.
  if (customer.phone && customer.smsMarketing === 'unsubscribed') {
    const result = await recordConsent(db, { customerId, channel: 'sms', purpose: 'marketing', action: 'revoked', method: 'import', address: customer.phone, evidence });
    if (result.ok) recorded += 1;
  }
  return recorded;
}

export async function ingestShopifyCustomer(db: Db, customer: ShopifyCustomer): Promise<{ customerId: string | null; consentChanges: number }> {
  const customerId = await upsertCustomer(db, customer);
  if (!customerId) return { customerId: null, consentChanges: 0 };
  return { customerId, consentChanges: await syncShopifyConsent(db, customerId, customer) };
}

/** Idempotent on the Shopify order id. */
export async function ingestShopifyOrder(db: Db, order: ShopifyOrder, { isDemo = false } = {}): Promise<{ ok: boolean; customerId: string | null }> {
  const synced = order.customer ? await ingestShopifyCustomer(db, order.customer) : { customerId: null };
  const { error } = await db.from('store_orders').upsert({
    shopify_order_id: order.shopifyOrderId, order_name: order.orderName, customer_id: synced.customerId, email: order.email,
    total_cents: order.totalCents, currency: order.currency, financial_status: order.financialStatus, line_count: order.lineCount,
    ordered_at: order.orderedAt, is_demo: isDemo,
  }, { onConflict: 'shopify_order_id' });
  if (error) {
    console.error(`[shopify] order ${order.shopifyOrderId} failed: ${error.message}`);
    return { ok: false, customerId: synced.customerId };
  }
  return { ok: true, customerId: synced.customerId };
}

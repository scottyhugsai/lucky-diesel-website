import 'server-only';
import { sendCatalogMessage } from '@/lib/marketing/community/catalog-send';
import { siteUrl } from '@/lib/site-url';
import type { createAdminClient } from '@/lib/supabase/admin';
import { getCatalog } from './catalog';
import { STOCK_ALERT_CONSENT_TEXT, type StockAlertRequest } from './stock-alert-request';

type Db = ReturnType<typeof createAdminClient>;

/** Postgres unique-violation: the email is already waiting on this handle. */
const DUPLICATE = '23505';

/**
 * Records a back-in-stock request. Links an existing customer by email so the
 * notice respects their unsubscribe. Returns true for a duplicate too, so the
 * public answer never reveals whether the email was already on the list.
 */
export async function joinStockAlert(db: Db, request: StockAlertRequest, ip: string | null): Promise<boolean> {
  const { data: customer } = await db.from('customers').select('id').eq('email', request.email).limit(1);
  const { error } = await db.from('stock_alerts').insert({
    handle: request.handle,
    product_title: request.productTitle,
    email: request.email,
    customer_id: customer?.[0]?.id ?? null,
    consent_text: STOCK_ALERT_CONSENT_TEXT,
    consent_ip: ip,
    status: 'pending',
  });
  if (!error || error.code === DUPLICATE) return true;
  console.error(`[store] stock alert insert failed: ${error.message}`);
  return false;
}

/** Emails pending "notify me" requests whose product is available again. One email per request. */
export async function runStockAlerts(db: Db): Promise<{ checked: number; notified: number }> {
  const { data: alerts, error } = await db.from('stock_alerts').select('id, handle, product_title, email, customer_id').eq('status', 'pending').order('created_at').limit(300);
  if (error) throw new Error(`stock alerts unavailable: ${error.message}`);
  if (!alerts?.length) return { checked: 0, notified: 0 };
  const { products, ok } = await getCatalog();
  if (!ok) return { checked: alerts.length, notified: 0 };
  const available = new Map(products.filter((p) => p.available).map((p) => [p.handle, p]));

  let notified = 0;
  for (const alert of alerts) {
    const product = available.get(alert.handle);
    if (!product) continue;
    const outcome = await sendCatalogMessage(db, {
      key: 'store_back_in_stock', subjectType: 'stock_alert', subjectId: alert.id, dedupeKey: `back_in_stock:${alert.id}`,
      recipient: { email: alert.email, phone: null, customerId: alert.customer_id, isCustomer: true },
      vars: { product_title: product.title, product_link: `${siteUrl()}/store/products/${product.handle}` },
    });
    if (outcome === 'disabled' || outcome === 'failed') continue;
    // Sent, already sent, or blocked by an unsubscribe: either way this request is finished.
    const status = outcome === 'skipped' ? 'cancelled' : 'notified';
    await db.from('stock_alerts').update({ status, notified_at: new Date().toISOString() }).eq('id', alert.id);
    if (status === 'notified') notified += 1;
  }
  return { checked: alerts.length, notified };
}

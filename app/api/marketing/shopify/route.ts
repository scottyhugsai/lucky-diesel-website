import { NextResponse } from 'next/server';
import { clientIp, createThrottle } from '@/lib/marketing/core/requests';
import { ingestShopifyCustomer, ingestShopifyOrder } from '@/lib/store/shopify-sync';
import { isShopifyTopic, parseShopifyCustomer, parseShopifyOrder, verifyShopifyHmac } from '@/lib/store/shopify-webhook';
import { createAdminClient } from '@/lib/supabase/admin';

const MAX_BODY = 512_000;
const throttled = createThrottle(60_000, 120);

/**
 * Shopify webhook: orders/create, orders/paid, customers/create, customers/update.
 * Every payload must carry a valid `X-Shopify-Hmac-Sha256`; without
 * SHOPIFY_WEBHOOK_SECRET nothing is processed. Answers 2xx once handled,
 * because Shopify retries any other status.
 */
export async function POST(request: Request) {
  if (throttled(clientIp(request) ?? 'unknown')) return NextResponse.json({ ok: false, error: 'Too many requests.' }, { status: 429 });

  const secret = process.env.SHOPIFY_WEBHOOK_SECRET?.trim();
  if (!secret) return NextResponse.json({ ok: false, error: 'Store not connected.' }, { status: 503 });

  const topic = request.headers.get('x-shopify-topic');
  const raw = await request.text().catch(() => '');
  if (!raw || raw.length > MAX_BODY) return NextResponse.json({ ok: false, error: 'Bad request.' }, { status: 400 });
  if (!verifyShopifyHmac(raw, request.headers.get('x-shopify-hmac-sha256'), secret)) {
    return NextResponse.json({ ok: false, error: 'Bad signature.' }, { status: 401 });
  }
  // Signature checked first: an unsupported topic is acknowledged so Shopify stops retrying.
  if (!isShopifyTopic(topic)) return NextResponse.json({ ok: true, handled: false }, { status: 202 });

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: 'Bad request.' }, { status: 400 });
  }

  const db = createAdminClient();
  if (topic === 'orders/create' || topic === 'orders/paid') {
    const order = parseShopifyOrder(payload);
    if (!order) return NextResponse.json({ ok: true, handled: false });
    const { ok } = await ingestShopifyOrder(db, order);
    return NextResponse.json({ ok }, { status: ok ? 200 : 500 });
  }

  const customer = parseShopifyCustomer(payload);
  if (!customer) return NextResponse.json({ ok: true, handled: false });
  const { customerId } = await ingestShopifyCustomer(db, customer);
  return NextResponse.json({ ok: customerId !== null }, { status: customerId ? 200 : 500 });
}

import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { recordPayment } from '@/lib/domain/payments';

const TOLERANCE_SECONDS = 300;

/** Verifies Stripe's `Stripe-Signature` header (v1 HMAC-SHA256) without the SDK. */
function verifySignature(payload: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(',').map((part) => part.split('=') as [string, string]));
  const timestamp = Number(parts.t);
  if (!timestamp || Math.abs(Date.now() / 1000 - timestamp) > TOLERANCE_SECONDS) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  const signatures = header.split(',').filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
  return signatures.some((sig) => sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected)));
}

interface CheckoutSessionEvent {
  type: string;
  data: { object: { payment_status?: string; payment_intent?: string | null; metadata?: { invoice_id?: string } } };
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: 'webhook not configured' }, { status: 503 });

  const payload = await request.text();
  if (!verifySignature(payload, request.headers.get('stripe-signature'), secret)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 });
  }

  const event = JSON.parse(payload) as CheckoutSessionEvent;
  if (event.type === 'checkout.session.completed' && event.data.object.payment_status === 'paid') {
    const invoiceId = event.data.object.metadata?.invoice_id;
    if (invoiceId) {
      const result = await recordPayment(invoiceId, 'card', { stripePaymentIntentId: event.data.object.payment_intent ?? undefined });
      if (!result.ok) {
        console.error(`[stripe] could not record payment for ${invoiceId}: ${result.error}`);
        return NextResponse.json({ error: result.error }, { status: 500 });
      }
    }
  }
  return NextResponse.json({ received: true });
}

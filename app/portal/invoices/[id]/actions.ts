'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { recordPayment } from '@/lib/domain/payments';
import { siteUrl } from '@/lib/site-url';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export interface PayState {
  error?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The invoice, if it belongs to the signed-in customer and is still open. */
async function ownedOpenInvoice(formData: FormData): Promise<{ invoice: { id: string; number: number; total_cents: number }; userId: string } | { error: string }> {
  const viewer = await requireRole('client');
  const invoiceId = String(formData.get('invoiceId') ?? '');
  if (!viewer.customerId || !UUID.test(invoiceId)) return { error: 'We couldn’t find that invoice on your account.' };
  const supabase = await createClient();
  const { data: invoice } = await supabase.from('invoices').select('id, number, status, total_cents, customer_id').eq('id', invoiceId).maybeSingle();
  if (!invoice || invoice.customer_id !== viewer.customerId) return { error: 'We couldn’t find that invoice on your account.' };
  if (invoice.status === 'paid') return { error: 'This invoice is already paid.' };
  if (invoice.status !== 'open' || invoice.total_cents <= 0) return { error: 'This invoice can’t be paid online. Call the shop.' };
  return { invoice, userId: viewer.userId };
}

/** Demo checkout: only available while Stripe isn't configured. No card data is sent or stored. */
export async function payInvoiceDemo(_previous: PayState, formData: FormData): Promise<PayState> {
  if (process.env.STRIPE_SECRET_KEY) return { error: 'Card payments are live. Use the secure checkout.' };
  const owned = await ownedOpenInvoice(formData);
  if ('error' in owned) return owned;
  const result = await recordPayment(owned.invoice.id, 'demo', { actorId: owned.userId });
  if (!result.ok) return { error: result.error };
  revalidatePath(`/portal/invoices/${owned.invoice.id}`);
  revalidatePath('/portal/invoices');
  revalidatePath('/portal');
  return {};
}

/** Real card payment: hands off to Stripe Checkout; the webhook records the payment. */
export async function startStripeCheckout(_previous: PayState, formData: FormData): Promise<PayState> {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return { error: 'Online card payments aren’t set up yet.' };
  const owned = await ownedOpenInvoice(formData);
  if ('error' in owned) return owned;
  const { invoice } = owned;
  const back = `${siteUrl()}/portal/invoices/${invoice.id}`;

  const body = new URLSearchParams({
    mode: 'payment',
    success_url: `${back}?checkout=success`,
    cancel_url: `${back}?checkout=cancelled`,
    client_reference_id: invoice.id,
    'metadata[invoice_id]': invoice.id,
    'payment_intent_data[metadata][invoice_id]': invoice.id,
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': String(invoice.total_cents),
    'line_items[0][price_data][product_data][name]': `Lucky Diesel invoice #${invoice.number}`,
  });

  let url: string | null = null;
  try {
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      cache: 'no-store',
    });
    const session = (await response.json()) as { id?: string; url?: string; error?: { message?: string } };
    if (!response.ok || !session.id || !session.url) {
      console.error(`[portal] stripe checkout failed for invoice ${invoice.id}: ${session.error?.message ?? response.status}`);
      return { error: 'Checkout is unavailable right now. Please try again or call the shop.' };
    }
    await createAdminClient().from('invoices').update({ stripe_checkout_session_id: session.id }).eq('id', invoice.id);
    url = session.url;
  } catch (error) {
    console.error(`[portal] stripe checkout error for invoice ${invoice.id}: ${error instanceof Error ? error.message : 'unknown'}`);
    return { error: 'Checkout is unavailable right now. Please try again or call the shop.' };
  }
  redirect(url);
}

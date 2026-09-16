'use client';

import { useActionState } from 'react';
import { Lock } from 'lucide-react';
import { payInvoiceDemo, startStripeCheckout, type PayState } from '@/app/portal/invoices/[id]/actions';
import { SubmitButton } from '@/components/app/SubmitButton';
import { fieldClass, labelClass } from '@/components/app/ui';
import { money } from '@/lib/format';

interface PayPanelProps {
  invoiceId: string;
  totalCents: number;
  stripeEnabled: boolean;
  cardholder: string;
}

export function PayPanel({ invoiceId, totalCents, stripeEnabled, cardholder }: PayPanelProps) {
  return stripeEnabled ? <StripePay invoiceId={invoiceId} totalCents={totalCents} /> : <DemoCheckout invoiceId={invoiceId} totalCents={totalCents} cardholder={cardholder} />;
}

function StripePay({ invoiceId, totalCents }: { invoiceId: string; totalCents: number }) {
  const [state, action] = useActionState<PayState, FormData>(startStripeCheckout, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <SubmitButton pendingLabel="Opening secure checkout…" className="h-12 w-full text-base">
        <Lock className="size-4" aria-hidden="true" /> Pay {money(totalCents)}
      </SubmitButton>
      <p className="text-center text-xs text-steel">Secure card checkout by Stripe.</p>
      <p role="alert" aria-live="assertive" className="text-sm text-danger">{state.error}</p>
    </form>
  );
}

function DemoCheckout({ invoiceId, totalCents, cardholder }: { invoiceId: string; totalCents: number; cardholder: string }) {
  const [state, action] = useActionState<PayState, FormData>(payInvoiceDemo, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <p className="flex items-center gap-2 rounded-sm border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm font-semibold text-amber-200">
        <span className="rounded-[2px] bg-amber-300 px-1.5 py-0.5 text-[0.65rem] font-black uppercase tracking-wider text-carbon">Test mode</span>
        Demo checkout — no card is charged.
      </p>

      <div aria-hidden="true" className="relative aspect-[1.6/1] w-full max-w-sm overflow-hidden rounded-lg border border-chalk/10 bg-[linear-gradient(135deg,#1c2220_0%,#0a0c0b_60%,#0f8a2a_140%)] p-5 shadow-[0_24px_60px_-24px_rgb(31_191_63/0.45)]">
        <div className="speed-stripes absolute -right-6 top-0 h-full w-24 opacity-20" />
        <div className="relative flex h-full flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="h-7 w-10 rounded-[4px] bg-[linear-gradient(135deg,#d9c27a,#8f7a3a)]" />
            <span className="display text-lg not-italic"><span className="text-clover">Lucky</span> Pay</span>
          </div>
          <p className="font-mono text-lg tracking-[0.18em] text-chalk sm:text-xl">4242 4242 4242 4242</p>
          <div className="flex justify-between text-xs uppercase tracking-widest text-chalk/70">
            <span className="truncate">{cardholder || 'Cardholder'}</span>
            <span>12/34</span>
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        <div>
          <label htmlFor="card-number" className={labelClass}>Card number</label>
          <input id="card-number" defaultValue="4242 4242 4242 4242" inputMode="numeric" autoComplete="off" className={`${fieldClass} font-mono`} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label htmlFor="card-exp" className={labelClass}>Expiry</label>
            <input id="card-exp" defaultValue="12/34" autoComplete="off" className={`${fieldClass} font-mono`} />
          </div>
          <div>
            <label htmlFor="card-cvc" className={labelClass}>CVC</label>
            <input id="card-cvc" defaultValue="123" inputMode="numeric" autoComplete="off" className={`${fieldClass} font-mono`} />
          </div>
          <div>
            <label htmlFor="card-zip" className={labelClass}>ZIP</label>
            <input id="card-zip" defaultValue="29401" inputMode="numeric" autoComplete="off" className={`${fieldClass} font-mono`} />
          </div>
        </div>
      </div>
      <SubmitButton pendingLabel="Processing…" className="h-12 w-full text-base">
        <Lock className="size-4" aria-hidden="true" /> Pay {money(totalCents)}
      </SubmitButton>
      <p className="text-xs text-steel">Card fields are for show and never leave this page.</p>
      <p role="alert" aria-live="assertive" className="text-sm text-danger">{state.error}</p>
    </form>
  );
}

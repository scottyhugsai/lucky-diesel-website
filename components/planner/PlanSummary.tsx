'use client';

import Link from 'next/link';
import { ArrowUpRight, ShoppingCart, Wrench } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '@/components/store/CartProvider';
import { money } from '@/lib/format';
import type { CartLine } from '@/lib/store/cart';
import { QuoteRequest } from './QuoteRequest';
import type { Plan } from './recommend';
import type { PlannerState } from './state';
import { BTN_GHOST, BTN_PRIMARY, SURFACE } from './ui';

interface PlanSummaryProps {
  state: PlannerState;
  plan: Plan;
}

export function PlanSummary({ state, plan }: PlanSummaryProps) {
  const { addMany } = useStore();
  const [isQuoteOpen, setQuoteOpen] = useState(false);
  const picks = plan.stages.flatMap((s) => s.picks);

  const addBuild = () => {
    const lines: CartLine[] = picks.map((p) => ({
      variantId: p.variant.id,
      handle: p.product.handle,
      title: p.product.title,
      variantTitle: p.variant.title,
      priceCents: p.variant.priceCents,
      image: p.variant.image ?? p.product.image?.src ?? null,
      quantity: 1,
    }));
    addMany(lines);
  };

  return (
    <aside aria-labelledby="plan-total" className={`${SURFACE} grid gap-5 p-5 lg:sticky lg:top-28`}>
      <div aria-live="polite" aria-atomic="true">
        <h2 id="plan-total" className="kicker">Parts subtotal</h2>
        <p className="display mt-2 text-6xl tabular-nums [[data-design=v2]_&]:text-5xl">{money(plan.subtotalCents, { whole: true })}</p>
        <p className="mt-2 text-sm text-chalk/70">
          {picks.length} part{picks.length === 1 ? '' : 's'} · Install labor quoted by the shop
        </p>
        {plan.overBudgetCents > 0 && (
          <p className="mt-2 text-sm font-semibold text-danger">{money(plan.overBudgetCents, { whole: true })} over your budget</p>
        )}
      </div>

      <div className="grid gap-2.5">
        <button type="button" onClick={addBuild} disabled={!picks.length} className={`${BTN_PRIMARY} w-full`}>
          <ShoppingCart className="size-5" aria-hidden="true" /> Add build to cart
        </button>
        <button
          type="button"
          onClick={() => setQuoteOpen((open) => !open)}
          aria-expanded={isQuoteOpen}
          aria-controls="plan-quote"
          className={`${BTN_GHOST} w-full`}
        >
          <Wrench className="size-4 text-clover" aria-hidden="true" /> Get an install quote
        </button>
      </div>

      {isQuoteOpen && (
        <div id="plan-quote" className="border-t border-line pt-5">
          <QuoteRequest state={state} plan={plan} />
        </div>
      )}

      <Link href="/builds" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-chalk/80 hover:text-clover">
        See real builds <ArrowUpRight className="size-4" aria-hidden="true" />
      </Link>
    </aside>
  );
}

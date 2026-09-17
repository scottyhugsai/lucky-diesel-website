'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Lock, Minus, Plus, Trash2 } from 'lucide-react';
import { money } from '@/lib/format';
import { BUSINESS } from '@/lib/site';
import { MAX_QUANTITY, checkoutUrl } from '@/lib/store/cart';
import { useStore } from './CartProvider';
import { BTN_GHOST, BTN_PRIMARY, PILL, TILE } from './styles';

/** Cart lines, subtotal and checkout. Shared by the drawer and /store/cart. */
export function CartContents({ onNavigate }: { onNavigate?: () => void }) {
  const { lines, subtotalCents, update, remove } = useStore();
  const href = checkoutUrl(BUSINESS.store, lines);

  if (!lines.length) {
    return (
      <div className="py-10 text-center">
        <p className="display text-3xl not-italic [[data-design=v2]_&]:text-2xl">Your cart is empty.</p>
        <p className="mt-2 text-chalk/70">Find parts for your truck.</p>
        <div className="mt-6 flex flex-col gap-2">
          <Link href="/store" onClick={onNavigate} className={BTN_PRIMARY}>Shop the store</Link>
          <Link href="/build-planner" onClick={onNavigate} className={BTN_GHOST}>Plan a build</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <ul className="divide-y divide-line">
        {lines.map((line) => (
          <li key={line.variantId} className="flex gap-3 py-4">
            <div className={`relative size-20 shrink-0 overflow-hidden bg-white ${TILE} [[data-design=v2]_&]:rounded-xl`}>
              {line.image && <Image src={line.image} alt="" fill sizes="80px" className="object-contain p-1" />}
            </div>
            <div className="min-w-0 flex-1">
              <Link href={`/store/products/${line.handle}`} onClick={onNavigate} className="line-clamp-2 text-sm font-semibold hover:text-clover">{line.title}</Link>
              {line.variantTitle && <p className="mt-0.5 text-xs text-steel">{line.variantTitle}</p>}
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className={`flex items-center border border-line ${PILL}`} role="group" aria-label={`Quantity for ${line.title}`}>
                  <button type="button" onClick={() => update(line.variantId, line.quantity - 1)} aria-label="Decrease quantity" className="grid size-11 place-items-center"><Minus className="size-3.5" aria-hidden="true" /></button>
                  <span className="w-6 text-center text-sm font-semibold tabular-nums">{line.quantity}</span>
                  <button type="button" onClick={() => update(line.variantId, line.quantity + 1)} disabled={line.quantity >= MAX_QUANTITY} aria-label="Increase quantity" className="grid size-11 place-items-center disabled:opacity-40"><Plus className="size-3.5" aria-hidden="true" /></button>
                </div>
                <p className="font-semibold tabular-nums">{money(line.priceCents * line.quantity)}</p>
              </div>
            </div>
            <button type="button" onClick={() => remove(line.variantId)} aria-label={`Remove ${line.title}`} className="grid size-11 shrink-0 place-items-center text-steel hover:text-danger"><Trash2 className="size-4" aria-hidden="true" /></button>
          </li>
        ))}
      </ul>

      <div className="mt-auto border-t border-line pt-5">
        <div className="flex items-baseline justify-between">
          <span className="font-semibold">Subtotal</span>
          <span className="text-2xl font-bold tabular-nums">{money(subtotalCents)}</span>
        </div>
        <p className="mt-1 text-sm text-steel">Taxes &amp; shipping calculated at checkout.</p>
        {href && (
          <a href={href} className={`${BTN_PRIMARY} mt-5 w-full`}>
            <Lock className="size-4" aria-hidden="true" /> Checkout
          </a>
        )}
        <p className="mt-3 text-center text-xs text-steel">Secure checkout with Shop Pay on luckydiesel.com.</p>
      </div>
    </div>
  );
}

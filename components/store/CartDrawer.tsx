'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { CartContents } from './CartContents';
import { useStore } from './CartProvider';

/**
 * Slide-over cart. A modal <dialog> gives us the focus trap, Esc-to-close and inert
 * background natively; `isCartOpen` in the store stays the source of truth.
 */
export function CartDrawer() {
  const { isCartOpen, closeCart, count } = useStore();
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (isCartOpen && !node.open) node.showModal();
    if (!isCartOpen && node.open) node.close();
  }, [isCartOpen]);

  return (
    <>
      <p className="sr-only" aria-live="polite">{count > 0 ? `Cart has ${count} item${count === 1 ? '' : 's'}` : ''}</p>
      <dialog
        ref={dialog}
        aria-modal="true"
        aria-labelledby="cart-drawer-title"
        onClose={closeCart}
        onClick={(event) => event.target === event.currentTarget && closeCart()}
        className="fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-none w-full max-w-md translate-x-full bg-carbon-2 p-0 text-chalk transition-[translate,overlay,display] duration-300 ease-out transition-discrete backdrop:bg-black/60 open:translate-x-0 starting:open:translate-x-full sm:border-l sm:border-line [[data-design=v2]_&]:sm:rounded-l-3xl"
      >
        <div className="flex h-full flex-col px-5 pb-6" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
          <div className="flex items-center justify-between border-b border-line pb-3">
            <h2 id="cart-drawer-title" className="display text-3xl not-italic [[data-design=v2]_&]:text-2xl">
              Cart <span className="text-steel tabular-nums">({count})</span>
            </h2>
            <button type="button" onClick={closeCart} aria-label="Close cart" autoFocus className="grid size-11 place-items-center rounded-full border border-line hover:border-clover">
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <CartContents onNavigate={closeCart} />
          </div>
          {count > 0 && (
            <Link href="/store/cart" onClick={closeCart} className="mt-2 flex min-h-11 items-center justify-center text-sm font-semibold text-chalk/70 hover:text-clover">View full cart</Link>
          )}
        </div>
      </dialog>
    </>
  );
}

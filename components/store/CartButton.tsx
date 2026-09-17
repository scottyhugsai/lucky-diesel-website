'use client';

import { ShoppingBag } from 'lucide-react';
import { useStore } from './CartProvider';

/** Header cart icon with item count. Opens the cart drawer. (Store build may restyle; keep the export.) */
export function CartButton({ className = '' }: { className?: string }) {
  const { count, openCart } = useStore();
  return (
    <button type="button" onClick={openCart} aria-label={`Cart, ${count} item${count === 1 ? '' : 's'}`} className={`relative grid size-10 place-items-center rounded-full hover:text-clover ${className}`}>
      <ShoppingBag className="size-5" aria-hidden="true" />
      {count > 0 && <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-clover px-1 text-[0.65rem] font-bold text-carbon tabular-nums">{count}</span>}
    </button>
  );
}

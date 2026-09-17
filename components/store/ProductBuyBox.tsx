'use client';

import { useState } from 'react';
import { Minus, Plus, ShoppingBag } from 'lucide-react';
import { money } from '@/lib/format';
import { MAX_QUANTITY } from '@/lib/store/cart';
import type { StoreProduct } from '@/lib/store/normalize';
import { useStore } from './CartProvider';
import { findVariant, initialSelection, selectValue, valueState } from './variants';
import { BTN_PRIMARY, PILL } from './styles';

type BuyProduct = Pick<StoreProduct, 'handle' | 'title' | 'options' | 'variants' | 'images'>;

/** Price, variant picker, quantity and Add to cart. */
export function ProductBuyBox({ product }: { product: BuyProduct }) {
  const { add } = useStore();
  const [selection, setSelection] = useState(() => initialSelection(product.variants));
  const [quantity, setQuantity] = useState(1);
  const variant = product.options.length ? findVariant(product.variants, selection) : (product.variants[0] ?? null);
  const canBuy = Boolean(variant?.available);

  const addToCart = () => {
    if (!variant || !canBuy) return;
    add({
      variantId: variant.id,
      handle: product.handle,
      title: product.title,
      variantTitle: variant.title,
      priceCents: variant.priceCents,
      image: variant.image ?? product.images[0]?.src ?? null,
      quantity,
    });
    setQuantity(1);
  };

  return (
    <div>
      <p className="flex items-baseline gap-3 text-3xl font-bold tabular-nums" aria-live="polite">
        {variant ? money(variant.priceCents) : 'Unavailable'}
        {variant?.compareAtCents && variant.compareAtCents > variant.priceCents && (
          <s className="text-lg font-normal text-steel">{money(variant.compareAtCents)}</s>
        )}
      </p>

      {product.options.map((option, optionIndex) => (
        <fieldset key={option.name} className="mt-6">
          <legend className="text-sm font-semibold text-chalk/80">
            {option.name}: <span className="text-chalk">{selection[optionIndex]}</span>
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {option.values.map((value) => {
              const state = valueState(product.variants, selection, optionIndex, value);
              const isOn = selection[optionIndex] === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={isOn}
                  disabled={state === 'missing' && !isOn}
                  onClick={() => setSelection((current) => selectValue(product.variants, current, optionIndex, value))}
                  className={`min-h-11 border px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:border-dashed disabled:text-steel/60 ${PILL} ${
                    isOn ? 'border-clover bg-clover/15 text-clover' : 'border-line hover:border-chalk/40'
                  } ${state === 'soldout' ? 'line-through decoration-steel' : ''}`}
                >
                  {value}
                  {state === 'soldout' && <span className="sr-only"> (sold out)</span>}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}

      <div className="mt-6 flex gap-3">
        <div className={`flex items-center border border-line ${PILL}`} role="group" aria-label="Quantity">
          <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1} aria-label="Decrease quantity" className="grid size-12 place-items-center disabled:opacity-40"><Minus className="size-4" aria-hidden="true" /></button>
          <output className="w-8 text-center font-semibold tabular-nums" aria-live="polite">{quantity}</output>
          <button type="button" onClick={() => setQuantity((q) => Math.min(MAX_QUANTITY, q + 1))} disabled={quantity >= MAX_QUANTITY} aria-label="Increase quantity" className="grid size-12 place-items-center disabled:opacity-40"><Plus className="size-4" aria-hidden="true" /></button>
        </div>
        <button type="button" onClick={addToCart} disabled={!canBuy} className={`${BTN_PRIMARY} flex-1 disabled:cursor-not-allowed disabled:opacity-50`}>
          <ShoppingBag className="size-5" aria-hidden="true" /> {canBuy ? 'Add to cart' : 'Sold out'}
        </button>
      </div>
    </div>
  );
}

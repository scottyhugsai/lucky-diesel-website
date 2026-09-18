import { describe, expect, test } from 'vitest';
import { addToCart, cartCount, cartSubtotalCents, checkoutUrl, parseStoredCart, removeFromCart, setQuantity, type CartLine } from './cart';

const turbo: CartLine = { variantId: 111, handle: 'turbo', title: 'DDP 66mm Turbo', variantTitle: null, priceCents: 279500, image: null, quantity: 1 };
const tee: CartLine = { variantId: 222, handle: 'tee', title: 'Lucky Tee', variantTitle: 'L', priceCents: 2500, image: null, quantity: 2 };

describe('cart', () => {
  test('adds new lines and merges repeats of the same variant', () => {
    const once = addToCart([], turbo);
    const twice = addToCart(once, { ...turbo, quantity: 2 });
    expect(twice).toHaveLength(1);
    expect(twice[0]!.quantity).toBe(3);
    expect(once[0]!.quantity).toBe(1);
  });

  test('caps quantity and removes lines set to zero', () => {
    expect(setQuantity([turbo], 111, 500)[0]!.quantity).toBe(20);
    expect(setQuantity([turbo], 111, 0)).toEqual([]);
    expect(removeFromCart([turbo, tee], 111)).toEqual([tee]);
  });

  test('totals and counts', () => {
    expect(cartSubtotalCents([turbo, tee])).toBe(284500);
    expect(cartCount([turbo, tee])).toBe(3);
  });

  test('builds a Shopify cart permalink that goes straight to checkout', () => {
    expect(checkoutUrl('https://luckydiesel.com', [turbo, tee])).toBe('https://luckydiesel.com/cart/111:1,222:2');
  });

  test('refuses an empty cart', () => {
    expect(checkoutUrl('https://luckydiesel.com', [])).toBeNull();
  });
});

describe('sample parts can never reach a real checkout', () => {
  const demoLine: CartLine = { variantId: -101, handle: 'sample-turbo', title: 'Sample turbo', variantTitle: null, priceCents: 0, image: null, quantity: 1 };
  const realLine: CartLine = { variantId: 111, handle: 'turbo', title: 'Turbo', variantTitle: null, priceCents: 220000, image: null, quantity: 1 };

  test('a cart holding a sample part produces no checkout link at all', () => {
    expect(checkoutUrl('https://luckydiesel.com', [demoLine])).toBeNull();
    // Not even alongside a real part: a partial checkout would be worse than none.
    expect(checkoutUrl('https://luckydiesel.com', [realLine, demoLine])).toBeNull();
  });

  test('addToCart refuses a sample part', () => {
    expect(addToCart([realLine], demoLine)).toEqual([realLine]);
  });

  test('a sample line restored from localStorage is dropped', () => {
    expect(parseStoredCart([demoLine, realLine])).toEqual([realLine]);
  });

  test('zero and fractional ids are rejected too', () => {
    expect(checkoutUrl('https://luckydiesel.com', [{ ...realLine, variantId: 0 }])).toBeNull();
    expect(checkoutUrl('https://luckydiesel.com', [{ ...realLine, variantId: 1.5 }])).toBeNull();
  });
});

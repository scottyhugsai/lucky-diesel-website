'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  addToCart, cartCount, cartSubtotalCents, parseStoredCart, removeFromCart, setQuantity, type CartLine,
} from '@/lib/store/cart';
import type { TruckSelection } from '@/lib/store/normalize';

const CART_KEY = 'ld_cart_v1';
const TRUCK_KEY = 'ld_truck_v1';

interface StoreState {
  lines: CartLine[];
  count: number;
  subtotalCents: number;
  isCartOpen: boolean;
  /** Visitor's saved truck, used for fitment everywhere in the store and planner. */
  truck: TruckSelection | null;
  add: (line: CartLine) => void;
  addMany: (lines: CartLine[]) => void;
  update: (variantId: number, quantity: number) => void;
  remove: (variantId: number) => void;
  clear: () => void;
  openCart: () => void;
  closeCart: () => void;
  setTruck: (truck: TruckSelection | null) => void;
}

const StoreContext = createContext<StoreState | null>(null);

function read<T>(key: string, parse: (value: unknown) => T, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? parse(JSON.parse(raw)) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private browsing / storage blocked: the cart still works for this page view.
  }
}

function parseTruck(value: unknown): TruckSelection | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (v.platform !== 'duramax' && v.platform !== 'powerstroke' && v.platform !== 'cummins') return null;
  return { platform: v.platform, generationCollection: typeof v.generationCollection === 'string' ? v.generationCollection : null };
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [truck, setTruckState] = useState<TruckSelection | null>(null);
  const [isCartOpen, setCartOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Browser-only storage has to be read after mount to avoid a hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLines(read(CART_KEY, parseStoredCart, []));
    setTruckState(read(TRUCK_KEY, parseTruck, null));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) write(CART_KEY, lines);
  }, [lines, hydrated]);

  const setTruck = useCallback((next: TruckSelection | null) => {
    setTruckState(next);
    write(TRUCK_KEY, next);
  }, []);

  const value = useMemo<StoreState>(() => ({
    lines,
    count: cartCount(lines),
    subtotalCents: cartSubtotalCents(lines),
    isCartOpen,
    truck,
    add: (line) => { setLines((current) => addToCart(current, line)); setCartOpen(true); },
    addMany: (many) => { setLines((current) => many.reduce(addToCart, current)); setCartOpen(true); },
    update: (variantId, quantity) => setLines((current) => setQuantity(current, variantId, quantity)),
    remove: (variantId) => setLines((current) => removeFromCart(current, variantId)),
    clear: () => setLines([]),
    openCart: () => setCartOpen(true),
    closeCart: () => setCartOpen(false),
    setTruck,
  }), [lines, isCartOpen, truck, setTruck]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreState {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be used inside <CartProvider>');
  return context;
}

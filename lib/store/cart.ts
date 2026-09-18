/** Pure cart operations. The cart lives in the browser; checkout hands off to Shopify. */

export interface CartLine {
  variantId: number;
  handle: string;
  title: string;
  variantTitle: string | null;
  priceCents: number;
  image: string | null;
  quantity: number;
}

export const MAX_QUANTITY = 20;

/**
 * Shopify variant ids are always positive integers. Sample catalogue entries
 * carry negative ids precisely so they can never form a valid cart permalink —
 * a made-up positive id could collide with a real variant and drop someone
 * else's product into a real checkout.
 */
export function isRealVariantId(variantId: number): boolean {
  return Number.isInteger(variantId) && variantId > 0;
}

const clamp = (quantity: number) => Math.max(0, Math.min(MAX_QUANTITY, Math.floor(quantity)));

export function addToCart(lines: readonly CartLine[], line: CartLine): CartLine[] {
  if (!isRealVariantId(line.variantId)) return [...lines];
  const existing = lines.find((l) => l.variantId === line.variantId);
  if (!existing) return [...lines, { ...line, quantity: clamp(line.quantity) || 1 }];
  return lines.map((l) => (l.variantId === line.variantId ? { ...l, quantity: clamp(l.quantity + line.quantity) } : l));
}

export function setQuantity(lines: readonly CartLine[], variantId: number, quantity: number): CartLine[] {
  const next = clamp(quantity);
  if (next === 0) return removeFromCart(lines, variantId);
  return lines.map((l) => (l.variantId === variantId ? { ...l, quantity: next } : l));
}

export function removeFromCart(lines: readonly CartLine[], variantId: number): CartLine[] {
  return lines.filter((l) => l.variantId !== variantId);
}

export function cartSubtotalCents(lines: readonly CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.priceCents * l.quantity, 0);
}

export function cartCount(lines: readonly CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0);
}

/** Shopify cart permalink: /cart/<variant>:<qty>,… lands the shopper in checkout with those items. */
export function checkoutUrl(storeOrigin: string, lines: readonly CartLine[]): string | null {
  const wanted = lines.filter((l) => l.quantity > 0);
  // One unbuyable line voids the whole link: a silent partial checkout is worse.
  if (wanted.some((l) => !isRealVariantId(l.variantId))) return null;
  const items = wanted.map((l) => `${l.variantId}:${l.quantity}`);
  if (!items.length) return null;
  return `${storeOrigin.replace(/\/$/, '')}/cart/${items.join(',')}`;
}

/** Validates a cart read back from localStorage, dropping anything malformed. */
export function parseStoredCart(value: unknown): CartLine[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): CartLine[] => {
    if (typeof item !== 'object' || item === null) return [];
    const l = item as Record<string, unknown>;
    if (typeof l.variantId !== 'number' || !isRealVariantId(l.variantId)) return [];
    if (typeof l.title !== 'string' || typeof l.handle !== 'string') return [];
    if (typeof l.priceCents !== 'number' || typeof l.quantity !== 'number') return [];
    const quantity = clamp(l.quantity);
    if (!quantity) return [];
    return [{
      variantId: l.variantId,
      handle: l.handle,
      title: l.title,
      variantTitle: typeof l.variantTitle === 'string' ? l.variantTitle : null,
      priceCents: l.priceCents,
      image: typeof l.image === 'string' ? l.image : null,
      quantity,
    }];
  });
}

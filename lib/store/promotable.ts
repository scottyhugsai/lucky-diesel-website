import { checkClaims } from '@/lib/marketing/core/compliance';
import type { StoreProduct } from './normalize';

/** Everything a shopper reads on the card and page, option values included —
 *  that is where a "Race Pipe" choice hides. */
export function promotableText(product: StoreProduct): string {
  return [
    product.title,
    product.summary,
    ...product.tags,
    ...product.intro,
    ...product.bullets.flatMap((bullet) => [bullet.label ?? '', bullet.text]),
    ...product.options.flatMap((option) => [option.name, ...option.values]),
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * Whether a part may appear in a promotional slot — a homepage row, a featured
 * shelf. The store's own listing pages still show everything the owner sells;
 * this only governs what the site actively pushes.
 *
 * It runs the listing through the same claims checker that gates generated
 * marketing copy, so a product whose options offer a race pipe is never the
 * face of the shop, whatever its category says.
 *
 * Note this deliberately does *not* exclude "unverified" parts. Unverified
 * means the owner has not filed CARB paperwork yet, which is true of nearly
 * every performance part — excluding them would leave a diesel shop promoting
 * merch. CARB status is surfaced on the product page instead.
 */
export function isSafeToPromote(product: StoreProduct): boolean {
  if (product.offRoadOnly) return false;
  if (!product.purchasable) return false;
  return checkClaims(promotableText(product)).risk !== 'fail';
}

export function safeToPromote(products: readonly StoreProduct[]): StoreProduct[] {
  return products.filter(isSafeToPromote);
}

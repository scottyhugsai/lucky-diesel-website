import { isSafeToPromote } from '@/lib/store/promotable';
import type { StoreProduct } from '@/lib/store/normalize';

const dollars = (cents: number) => (cents / 100).toFixed(2);

/**
 * schema.org Product for a store page. Serialize with `<` escaped before
 * injecting. Returns null for a sample listing: it has no price and is not for
 * sale, and publishing a zero-price offer would be a false claim to search
 * engines.
 *
 * It also returns null for anything the claims checker refuses to promote.
 * This markup is not decoration — it is a machine-readable offer for sale,
 * addressed to search engines and to whatever reads the catalogue after them.
 * The listing pages may still show everything the owner stocks, but the site
 * should not *publish an offer* for a configuration it would not put its name
 * behind. The case that matters is a kit whose option values are "Race Pipe"
 * and "EGR Kit": nothing in its title or tags gives it away, `offRoadOnly` is
 * derived from tags it does not carry, and it is purchasable — so every other
 * gate passes it. `isSafeToPromote` reads the option values, which is the only
 * reason it is caught at all.
 */
export function productJsonLd(product: StoreProduct, url: string, seller: string, merchant: Record<string, unknown> = {}) {
  if (!product.purchasable) return null;
  if (!isSafeToPromote(product)) return null;
  const availability = `https://schema.org/${product.available ? 'InStock' : 'OutOfStock'}`;
  const offers = product.priceMaxCents > product.priceMinCents
    ? { '@type': 'AggregateOffer', priceCurrency: 'USD', lowPrice: dollars(product.priceMinCents), highPrice: dollars(product.priceMaxCents), offerCount: product.variants.length, availability, url, ...merchant }
    : { '@type': 'Offer', priceCurrency: 'USD', price: dollars(product.priceMinCents), availability, url, seller: { '@type': 'Organization', name: seller }, ...merchant };
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    image: product.images.map((image) => image.src),
    description: product.summary || undefined,
    sku: String(product.variants[0]?.id ?? product.id),
    brand: { '@type': 'Brand', name: product.vendor },
    offers,
  };
}

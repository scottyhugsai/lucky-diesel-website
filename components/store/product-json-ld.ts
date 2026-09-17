import type { StoreProduct } from '@/lib/store/normalize';

const dollars = (cents: number) => (cents / 100).toFixed(2);

/** schema.org Product for a store page. Serialize with `<` escaped before injecting. */
export function productJsonLd(product: StoreProduct, url: string, seller: string) {
  const availability = `https://schema.org/${product.available ? 'InStock' : 'OutOfStock'}`;
  const offers = product.priceMaxCents > product.priceMinCents
    ? { '@type': 'AggregateOffer', priceCurrency: 'USD', lowPrice: dollars(product.priceMinCents), highPrice: dollars(product.priceMaxCents), offerCount: product.variants.length, availability, url }
    : { '@type': 'Offer', priceCurrency: 'USD', price: dollars(product.priceMinCents), availability, url, seller: { '@type': 'Organization', name: seller } };
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

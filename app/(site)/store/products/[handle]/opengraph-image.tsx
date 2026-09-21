import { notFound } from 'next/navigation';
import { priceLabel } from '@/components/store/listing';
import { ogAlt, ogImage, size, contentType } from '@/lib/og';
import { getProduct } from '@/lib/store/catalog';

export { size, contentType };
export const alt = ogAlt('Diesel part');

/**
 * The card a customer actually sees, because a part link is the thing this shop
 * texts and DMs most. A sample listing says so on its own card rather than
 * arriving in a message looking like stock.
 */
export default async function Image({ params }: { params: Promise<{ handle: string }> }) {
  const product = await getProduct((await params).handle);
  if (!product) notFound();
  const sample = product.source === 'demo';
  return ogImage({
    eyebrow: sample ? 'Sample listing' : product.vendor,
    title: product.title,
    subtitle: sample ? 'An example of what we can source. Ask us for a quote.' : priceLabel(product),
    image: product.images[0]?.src,
  });
}

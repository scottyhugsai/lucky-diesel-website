import { ogAlt, ogImage, size, contentType } from '@/lib/og';

export { size, contentType };
export const alt = ogAlt('Shop notes');

export default function Image() {
  return ogImage({ eyebrow: 'From the shop', title: 'Shop notes', subtitle: 'What we find on real trucks, and how to keep yours out of the bay.' });
}

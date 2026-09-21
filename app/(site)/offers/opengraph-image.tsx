import { ogAlt, ogImage, size, contentType } from '@/lib/og';

export { size, contentType };
export const alt = ogAlt('Current offers');

export default function Image() {
  return ogImage({ eyebrow: 'Offers', title: 'What is on right now', subtitle: 'Current offers from the shop.' });
}

import { ogAlt, ogImage, size, contentType } from '@/lib/og';

export { size, contentType };
export const alt = ogAlt('All diesel parts');

export default function Image() {
  return ogImage({ eyebrow: 'Store', title: 'Every part', subtitle: 'Filter by your truck and see only what fits it.' });
}

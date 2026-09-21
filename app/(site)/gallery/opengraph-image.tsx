import { ogAlt, ogImage, size, contentType } from '@/lib/og';

export { size, contentType };
export const alt = ogAlt('Build gallery');

export default function Image() {
  return ogImage({ eyebrow: 'Gallery', title: 'Out of the bay', subtitle: 'Work we have finished, photographed in the shop.' });
}

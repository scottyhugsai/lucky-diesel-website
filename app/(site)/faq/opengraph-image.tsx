import { ogAlt, ogImage, size, contentType } from '@/lib/og';

export { size, contentType };
export const alt = ogAlt('Diesel repair FAQ');

export default function Image() {
  return ogImage({ eyebrow: 'FAQ', title: 'Straight answers', subtitle: 'The questions we get asked most, without the runaround.' });
}

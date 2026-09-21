import { ogAlt, ogImage, size, contentType } from '@/lib/og';

export { size, contentType };
export const alt = ogAlt('Truck fitment finder');

export default function Image() {
  return ogImage({ eyebrow: 'What fits', title: 'What fits your truck', subtitle: 'Four taps and we tell you what we can do with it.' });
}

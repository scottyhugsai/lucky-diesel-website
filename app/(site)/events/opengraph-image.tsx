import { ogAlt, ogImage, size, contentType } from '@/lib/og';

export { size, contentType };
export const alt = ogAlt('Dyno days and events');

export default function Image() {
  return ogImage({ eyebrow: 'Events', title: 'Dyno days', subtitle: 'Bring the truck. Get real numbers.' });
}

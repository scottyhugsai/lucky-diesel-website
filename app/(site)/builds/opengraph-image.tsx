import { ogAlt, ogImage, size, contentType } from '@/lib/og';

export { size, contentType };
export const alt = ogAlt('Diesel builds and dyno results');

export default function Image() {
  return ogImage({ eyebrow: 'Builds', title: 'Builds and dyno', subtitle: 'Real trucks, the parts that went on and what they made.' });
}

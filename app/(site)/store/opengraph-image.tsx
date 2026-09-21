import { ogAlt, ogImage, size, contentType } from '@/lib/og';

export { size, contentType };
export const alt = ogAlt('Diesel parts store');

export default function Image() {
  return ogImage({ eyebrow: 'Store', title: 'Parts we run', subtitle: 'Turbos, fuel, tuning and exhaust, shipped fast or fitted here.' });
}

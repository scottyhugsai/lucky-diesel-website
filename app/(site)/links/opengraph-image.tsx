import { ogAlt, ogImage, size, contentType } from '@/lib/og';

export { size, contentType };
export const alt = ogAlt('Links');

export default function Image() {
  return ogImage({ eyebrow: 'Charleston', title: 'Lucky Diesel', subtitle: 'Diesel repair, parts and tuning. Pick what you need.' });
}

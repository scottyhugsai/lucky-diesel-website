import { ogAlt, ogImage, size, contentType } from '@/lib/og';

export { size, contentType };
export const alt = ogAlt('Book diesel service');

export default function Image() {
  return ogImage({ eyebrow: 'Book', title: 'Get it in the bay', subtitle: 'Pick a time that works. Written estimate before any work.' });
}

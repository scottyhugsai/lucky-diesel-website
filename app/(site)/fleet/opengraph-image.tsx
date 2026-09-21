import { ogAlt, ogImage, size, contentType } from '@/lib/og';

export { size, contentType };
export const alt = ogAlt('Fleet diesel service');

export default function Image() {
  return ogImage({ eyebrow: 'Fleet', title: 'Fleet and commercial', subtitle: 'Keep the trucks that earn working.' });
}

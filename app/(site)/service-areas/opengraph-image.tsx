import { ogAlt, ogImage, size, contentType } from '@/lib/og';

export { size, contentType };
export const alt = ogAlt('Service areas');

export default function Image() {
  return ogImage({ eyebrow: 'Service areas', title: 'Trucks from around us', subtitle: 'The towns we see diesel trucks from most.' });
}

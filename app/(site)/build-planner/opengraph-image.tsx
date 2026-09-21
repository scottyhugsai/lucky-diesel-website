import { ogAlt, ogImage, size, contentType } from '@/lib/og';

export { size, contentType };
export const alt = ogAlt('Diesel build planner');

export default function Image() {
  return ogImage({ eyebrow: 'Plan', title: 'Plan the build', subtitle: 'Pick the goal, see the parts and where the money goes.' });
}

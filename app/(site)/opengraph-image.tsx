import { ogAlt, ogImage, size, contentType } from '@/lib/og';
import { BUSINESS } from '@/lib/site';

export { size, contentType };
export const alt = ogAlt('Diesel tuning, parts and repair');

export default function Image() {
  return ogImage({
    eyebrow: 'Diesel performance',
    title: 'What are you running?',
    subtitle: `Tuning, turbos, fuel and repair for Duramax, Powerstroke and Cummins in ${BUSINESS.city}.`,
  });
}

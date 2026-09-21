import { notFound } from 'next/navigation';
import { ogAlt, ogImage, size, contentType } from '@/lib/og';
import { PLATFORMS } from '@/lib/site';

export { size, contentType };
export const alt = ogAlt('Diesel platform');

export default async function Image({ params }: { params: Promise<{ platform: string }> }) {
  const { platform: platformId } = await params;
  const platform = PLATFORMS.find((entry) => entry.id === platformId);
  if (!platform) notFound();
  return ogImage({ eyebrow: platform.make, title: platform.name, subtitle: platform.tagline });
}

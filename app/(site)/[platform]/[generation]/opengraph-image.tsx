import { notFound } from 'next/navigation';
import { generationCollectionFor, generationInfo } from '@/components/store/listing';
import { ogAlt, ogImage, size, contentType } from '@/lib/og';
import { PLATFORMS } from '@/lib/site';
import type { PlatformId } from '@/lib/store/normalize';
import { trucksForGeneration } from '@/lib/vehicles';

export { size, contentType };
export const alt = ogAlt('Engine generation');

export default async function Image({ params }: { params: Promise<{ platform: string; generation: string }> }) {
  const { platform: platformId, generation } = await params;
  const platform = PLATFORMS.find((entry) => entry.id === platformId);
  const collection = platform ? generationCollectionFor(platform.id as PlatformId, generation) : null;
  const info = collection ? generationInfo(collection) : null;
  if (!platform || !collection || !info) notFound();
  const trucks = trucksForGeneration(collection);
  return ogImage({
    eyebrow: `${platform.make} · ${platform.name}`,
    title: info.name,
    subtitle: trucks.length ? `Fitted to ${trucks.map((t) => t.name).slice(0, 3).join(', ')}.` : undefined,
  });
}

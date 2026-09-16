import type { MetadataRoute } from 'next';
import { PLATFORMS } from '@/lib/site';
import { siteUrl } from '@/lib/site-url';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return [
    { url: `${base}/`, changeFrequency: 'weekly', priority: 1 },
    ...PLATFORMS.map((platform) => ({ url: `${base}/${platform.id}`, changeFrequency: 'monthly' as const, priority: 0.8 })),
    { url: `${base}/builds`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${base}/emissions-policy`, changeFrequency: 'yearly', priority: 0.3 },
  ];
}

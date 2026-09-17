import type { MetadataRoute } from 'next';
import { loadAreaPages, loadFaqItems, loadPosts } from '@/lib/marketing/content/seo-public';
import { PLATFORMS } from '@/lib/site';
import { siteUrl } from '@/lib/site-url';

export const revalidate = 3600;

/** Approved content only: blog, FAQ and service-area URLs appear once something is published. */
async function contentEntries(base: string): Promise<MetadataRoute.Sitemap> {
  try {
    const [posts, areas, faq] = await Promise.all([loadPosts(), loadAreaPages(), loadFaqItems()]);
    return [
      ...(posts.length ? [{ url: `${base}/blog`, changeFrequency: 'weekly' as const, priority: 0.6 }] : []),
      ...posts.map((p) => ({ url: `${base}/blog/${p.slug}`, lastModified: p.updatedAt, changeFrequency: 'monthly' as const, priority: 0.5 })),
      ...(areas.length ? [{ url: `${base}/service-areas`, changeFrequency: 'monthly' as const, priority: 0.6 }] : []),
      ...areas.map((a) => ({ url: `${base}/service-areas/${a.area}`, lastModified: a.updatedAt, changeFrequency: 'monthly' as const, priority: 0.6 })),
      ...(faq.length ? [{ url: `${base}/faq`, changeFrequency: 'monthly' as const, priority: 0.5 }] : []),
    ];
  } catch (error) {
    console.error(`[sitemap] content entries skipped: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  return [
    { url: `${base}/`, changeFrequency: 'weekly', priority: 1 },
    ...PLATFORMS.map((platform) => ({ url: `${base}/${platform.id}`, changeFrequency: 'monthly' as const, priority: 0.8 })),
    { url: `${base}/book`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/store`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/build-planner`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/builds`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${base}/gallery`, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${base}/emissions-policy`, changeFrequency: 'yearly', priority: 0.3 },
    ...(await contentEntries(base)),
  ];
}

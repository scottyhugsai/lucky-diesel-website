import type { MetadataRoute } from 'next';
import { loadAreaPages, loadFaqItems, loadPosts } from '@/lib/marketing/content/seo-public';
import { getBuildStats } from '@/components/v3/data';
import { generationSlug } from '@/components/store/listing';
import { PLATFORMS } from '@/lib/site';
import type { PlatformId } from '@/lib/store/normalize';
import { trucksForGeneration } from '@/lib/vehicles';
import { siteUrl } from '@/lib/site-url';

export const revalidate = 3600;

/**
 * Approved content only: blog, FAQ, service-area and build URLs appear once
 * something real is published.
 *
 * /builds is gated on a build that is not a sample. Every row on it today is
 * badged "Example", and submitting a page of labelled examples asks a crawler
 * to index a placeholder.
 */
async function contentEntries(base: string): Promise<MetadataRoute.Sitemap> {
  try {
    const [posts, areas, faq, stats] = await Promise.all([loadPosts(), loadAreaPages(), loadFaqItems(), getBuildStats()]);
    return [
      ...(posts.length ? [{ url: `${base}/blog`, changeFrequency: 'weekly' as const, priority: 0.6 }] : []),
      ...posts.map((p) => ({ url: `${base}/blog/${p.slug}`, lastModified: p.updatedAt, changeFrequency: 'monthly' as const, priority: 0.5 })),
      ...(areas.length ? [{ url: `${base}/service-areas`, changeFrequency: 'monthly' as const, priority: 0.6 }] : []),
      ...areas.map((a) => ({ url: `${base}/service-areas/${a.area}`, lastModified: a.updatedAt, changeFrequency: 'monthly' as const, priority: 0.6 })),
      ...(faq.length ? [{ url: `${base}/faq`, changeFrequency: 'monthly' as const, priority: 0.5 }] : []),
      ...(stats.trucks > 0 ? [{ url: `${base}/builds`, changeFrequency: 'weekly' as const, priority: 0.7 }] : []),
      ...stats.builds.filter((b) => !b.isSample).map((b) => ({ url: `${base}/builds/${b.slug}`, changeFrequency: 'monthly' as const, priority: 0.5 })),
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
    // One URL per engine generation the site can actually describe. Before
    // these existed the whole engine-code layer lived behind `?platform=&gen=`,
    // which robots.ts disallows — nineteen of the most searched terms in this
    // trade had no crawlable page at all.
    ...PLATFORMS.flatMap((platform) =>
      platform.generationCollections
        .filter((collection) => trucksForGeneration(collection).length > 0)
        .map((collection) => ({
          url: `${base}/${platform.id}/${generationSlug(platform.id as PlatformId, collection)}`,
          changeFrequency: 'monthly' as const,
          priority: 0.7,
        })),
    ),
    { url: `${base}/book`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/store`, changeFrequency: 'daily', priority: 0.9 },
    // The parts listing itself. Individual product URLs stay out until the
    // luckydiesel.com host question is settled — that Shopify store already
    // sitemaps the same 76 products, and submitting ours too would enter this
    // site into a duplicate-content race against the shop's own storefront.
    { url: `${base}/store/products`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/build-planner`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/gallery`, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${base}/emissions-policy`, changeFrequency: 'yearly', priority: 0.3 },
    ...(await contentEntries(base)),
  ];
}

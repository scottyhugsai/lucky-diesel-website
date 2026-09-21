import 'server-only';
import type { Metadata } from 'next';
import { getSiteContent } from './read';
import { str } from './values';

/**
 * Search and share metadata for a page, with the owner's overrides applied.
 *
 * `images` is set only when there is an image to set. An explicit value here
 * outranks the route's `opengraph-image.tsx`, so passing a hardcoded fallback
 * silently replaces the generated share card — which is how one photo of a
 * business card ended up representing every page on the site. The order is:
 * the owner's choice in /admin/site, then the generated card. `fallbackImage`
 * remains for a page whose own picture genuinely beats both.
 */
export async function seoMetadata(pageId: string, canonical: string, fallbackImage?: string): Promise<Metadata> {
  const content = await getSiteContent();
  const values = content.block(`seo.${pageId}`);
  const title = str(values, 'title');
  const description = str(values, 'description');
  const image = str(values, 'ogImage') || fallbackImage;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, ...(image ? { images: [{ url: image }] } : {}) },
  };
}

import 'server-only';
import type { Metadata } from 'next';
import { getSiteContent } from './read';
import { str } from './values';

/**
 * Search and share metadata for a page, with the owner's overrides applied.
 * `fallbackImage` lets a page offer its own picture (the gallery's first photo,
 * say) when nothing has been chosen in the admin.
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

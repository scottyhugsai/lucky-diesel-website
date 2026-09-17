import { jsonLd } from '@/lib/marketing/content/seo';

/** One JSON-LD script. `<` is escaped so page content can't close the tag. */
export function JsonLd({ data }: { data: Record<string, unknown> | null }) {
  if (!data) return null;
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(data) }} />;
}

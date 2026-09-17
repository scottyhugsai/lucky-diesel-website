import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLandingPage } from '@/lib/marketing/content/landing-service';
import { Blocks } from './Blocks';
import { MagnetForm } from './MagnetForm';

interface LandingPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}

async function load({ params, searchParams }: LandingPageProps) {
  const [{ slug }, { preview }] = await Promise.all([params, searchParams]);
  return getLandingPage(slug, preview === '1');
}

export async function generateMetadata(props: LandingPageProps): Promise<Metadata> {
  const page = await load(props);
  if (!page) return { robots: { index: false } };
  return {
    title: `${page.title} | Lucky Diesel`,
    description: page.description ?? undefined,
    alternates: { canonical: `/l/${page.slug}` },
    // Drafts, previews and sample demo pages must never be indexed.
    robots: page.isPreview || page.isSample || page.offerExpired ? { index: false, follow: false } : undefined,
  };
}

export default async function LandingPage(props: LandingPageProps) {
  const page = await load(props);
  if (!page) notFound();
  return (
    <article className="pb-24 pt-28 sm:pt-36">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6">
        {page.isPreview && <p role="note" className="rounded-sm border border-danger/60 px-4 py-2 text-sm text-danger">Draft preview: not published, not indexed.</p>}
        {page.isSample && <p className="text-sm text-steel">Sample offer shown for the website preview.</p>}
        <Blocks blocks={page.blocks} offer={page.offer} offerExpired={page.offerExpired} />
        {page.leadMagnet && (
          <section aria-labelledby="magnet-heading" className="grid gap-4 rounded-md border border-line p-6 sm:p-8">
            <p className="kicker">Free checklist</p>
            <h2 id="magnet-heading" className="display text-3xl">{page.leadMagnet.title}</h2>
            <MagnetForm slug={page.leadMagnet.slug} title={page.leadMagnet.title} landingSlug={page.slug} />
          </section>
        )}
      </div>
    </article>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Camera } from 'lucide-react';
import { FilterChips } from '@/components/gallery/FilterChips';
import { GalleryCta } from '@/components/gallery/GalleryCta';
import { JustifiedGrid } from '@/components/gallery/JustifiedGrid';
import { LightboxProvider } from '@/components/gallery/LightboxProvider';
import { applyFilters, loadPublishedPhotos, parseFilters } from '@/components/gallery/data';
import { TruckSubmitForm } from '@/components/marketing-public/TruckSubmitForm';
import { BUSINESS } from '@/lib/site';

const TITLE = `Gallery | Lucky Diesel ${BUSINESS.city}`;
const DESCRIPTION = 'Duramax, Powerstroke and Cummins trucks, parts and dyno days from the Lucky Diesel shop in Charleston, SC.';

export async function generateMetadata(): Promise<Metadata> {
  const { photos } = await loadPublishedPhotos();
  const cover = photos[0];
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: '/gallery' },
    openGraph: {
      title: TITLE,
      description: DESCRIPTION,
      images: cover ? [{ url: cover.src, width: cover.width, height: cover.height, alt: cover.title }] : undefined,
    },
  };
}

export default async function GalleryPage({ searchParams }: PageProps<'/gallery'>) {
  const [params, { photos, failed }] = await Promise.all([searchParams, loadPublishedPhotos()]);
  const filters = parseFilters(params);
  const visible = applyFilters(photos, filters);
  const filtered = Boolean(filters.category || filters.platform);

  return (
    <div className="pb-28 pt-28 sm:pt-40">
      <header className="mx-auto max-w-7xl px-4 sm:px-6">
        <p className="kicker">Straight off the shop floor</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
          <h1 className="display text-[length:var(--text-display)]">Gallery</h1>
          <p className="max-w-sm text-chalk/65 sm:pb-2 sm:text-lg">Trucks we’ve built, parts we trust, days on the dyno.</p>
        </div>
      </header>

      {photos.length > 0 && (
        <div className="mx-auto mt-8 max-w-7xl px-4 sm:mt-12 sm:px-6">
          <FilterChips photos={photos} filters={filters} />
        </div>
      )}

      <section aria-label="Photos" className="mx-auto mt-6 max-w-7xl px-4 sm:mt-8 sm:px-6">
        {failed && <p role="alert" className="mb-6 text-danger">The gallery couldn’t load right now. Try again in a minute.</p>}
        {visible.length > 0 ? (
          <LightboxProvider photos={visible}>
            <JustifiedGrid photos={visible} />
          </LightboxProvider>
        ) : (
          !failed && <EmptyGallery filtered={filtered} />
        )}
      </section>

      <section aria-labelledby="submit-truck" className="mx-auto mt-16 max-w-3xl px-4 sm:px-6">
        <div className="rounded-md border border-line bg-carbon-2 p-5 sm:p-7 [[data-design=v2]_&]:rounded-3xl [[data-design=v3]_&]:rounded-lg">
          <p className="kicker">Truck of the week</p>
          <h2 id="submit-truck" className="display mt-2 text-3xl sm:text-4xl">Send us your truck</h2>
          <p className="mt-2 mb-5 text-chalk/70">Ours or not — if it’s clean, it might end up on the feed.</p>
          <TruckSubmitForm />
        </div>
      </section>

      <GalleryCta />
    </div>
  );
}

function EmptyGallery({ filtered }: { filtered: boolean }) {
  return (
    <div className="mx-auto flex max-w-7xl flex-col items-start gap-4 border border-dashed border-line px-6 py-14 sm:items-center sm:text-center [[data-design=v2]_&]:rounded-3xl [[data-design=v2]_&]:border-solid [[data-design=v2]_&]:bg-carbon-2">
      <Camera className="size-8 text-clover" aria-hidden="true" />
      <p className="display text-3xl">{filtered ? 'Nothing in this mix yet' : 'Photos are on the way'}</p>
      {filtered ? (
        <Link href="/gallery" scroll={false} className="inline-flex h-11 items-center gap-2 font-semibold text-clover hover:underline">
          Show every photo <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      ) : (
        <p className="text-chalk/65">Follow the shop on Instagram in the meantime.</p>
      )}
    </div>
  );
}

import { ArrowUpRight } from 'lucide-react';
import { EmptyState, PageHeader, buttonClass } from '@/components/app/ui';
import { AdminItemCard } from '@/components/gallery/admin/AdminItemCard';
import { Uploader } from '@/components/gallery/admin/Uploader';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Gallery | Lucky Diesel admin' };

export default async function AdminGalleryPage() {
  await requireRole('admin');
  const supabase = await createClient();
  const [{ data: items, error }, { data: builds }] = await Promise.all([
    supabase.from('gallery_items').select('*').order('sort', { ascending: true }).order('created_at', { ascending: false }),
    supabase.from('builds').select('id, title').order('title'),
  ]);
  const all = items ?? [];
  const live = all.filter((item) => item.published).length;

  return (
    <>
      <PageHeader
        kicker="Website"
        title="Gallery"
        description={`${live} live · ${all.length - live} hidden. First in the list shows first on the site.`}
        actions={
          <a href="/gallery" target="_blank" rel="noopener noreferrer" className={buttonClass('secondary')}>
            View gallery <ArrowUpRight className="size-4" aria-hidden="true" />
          </a>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)] xl:items-start">
        <div className="xl:sticky xl:top-6">
          <Uploader />
        </div>
        <section aria-label="Gallery photos" className="min-w-0">
          {error && <p role="alert" className="mb-4 text-sm text-danger">Couldn’t load the gallery: {error.message}</p>}
          {all.length === 0 && !error ? (
            <EmptyState title="No photos yet">Add your first photos with the uploader.</EmptyState>
          ) : (
            <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {all.map((item, index) => (
                <AdminItemCard key={item.id} item={item} builds={builds ?? []} isFirst={index === 0} isLast={index === all.length - 1} />
              ))}
            </ol>
          )}
        </section>
      </div>
    </>
  );
}

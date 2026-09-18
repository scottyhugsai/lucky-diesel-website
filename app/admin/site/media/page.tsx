import Image from 'next/image';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import { SiteUploader } from '@/components/admin/site/SiteUploader';
import { Card, EmptyState, PageHeader, fieldClass, labelClass } from '@/components/app/ui';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { deleteSiteMedia, renameSiteMedia } from './actions';

export const metadata = { title: 'Media | Lucky Diesel admin' };

export default async function SiteMediaPage() {
  await requireRole('admin');
  const supabase = await createClient();
  const { data: media, error } = await supabase.from('site_media').select('*').order('created_at', { ascending: false });
  const items = media ?? [];

  return (
    <>
      <PageHeader
        kicker="Website"
        title="Media"
        description="Photos you can drop into any part of the site. Deleting one leaves an empty space wherever it was used."
      />
      <div className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)] xl:items-start">
        <div className="xl:sticky xl:top-6">
          <Card title="Add photos"><SiteUploader /></Card>
        </div>
        <section aria-label="Photo library" className="min-w-0">
          {error && <p role="alert" className="mb-4 text-sm text-danger">Couldn’t load the library: {error.message}</p>}
          {items.length === 0 && !error ? (
            <EmptyState title="No photos yet">Upload the shop photos you want to use on the website.</EmptyState>
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {items.map((item) => (
                <li key={item.id} className="overflow-hidden rounded-md border border-line bg-carbon-2">
                  <div className="relative aspect-[4/3] w-full bg-carbon">
                    <Image src={item.url} alt={item.alt_text ?? item.title} fill sizes="(min-width: 1536px) 20rem, (min-width: 640px) 45vw, 100vw" className="object-cover" />
                  </div>
                  <div className="p-3">
                    <ActionForm action={renameSiteMedia} aria-label={`Edit ${item.title}`}>
                      <input type="hidden" name="id" value={item.id} />
                      <label className={labelClass} htmlFor={`title-${item.id}`}>Name</label>
                      <input id={`title-${item.id}`} name="title" defaultValue={item.title} className={fieldClass} maxLength={120} />
                      <label className={`${labelClass} mt-2`} htmlFor={`alt-${item.id}`}>Description for screen readers</label>
                      <input id={`alt-${item.id}`} name="alt_text" defaultValue={item.alt_text ?? ''} className={fieldClass} maxLength={200} />
                      <div className="mt-3 flex gap-2">
                        <PendingButton variant="secondary" size="sm">Save</PendingButton>
                      </div>
                    </ActionForm>
                    <ActionForm action={deleteSiteMedia} feedback="below" confirm={`Delete “${item.title}”? Anywhere it is used will show no photo.`}>
                      <input type="hidden" name="id" value={item.id} />
                      <div className="mt-2"><PendingButton variant="ghost" size="sm">Delete</PendingButton></div>
                    </ActionForm>
                    <p className="mt-2 text-xs tabular-nums text-steel">{item.width}×{item.height}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

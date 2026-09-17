import Image from 'next/image';
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Trash2 } from 'lucide-react';
import { deleteGalleryItem, moveGalleryItem, setGalleryPublished, updateGalleryItem } from '@/app/admin/gallery/actions';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import { Badge, fieldClass, labelClass } from '@/components/app/ui';
import type { Tables } from '@/lib/db/database.types';
import { PLATFORMS } from '@/lib/site';
import { GALLERY_CATEGORIES, LIMITS, categoryLabel } from '../constants';

export type AdminGalleryItem = Tables<'gallery_items'>;
export interface BuildOption { id: string; title: string }

interface AdminItemCardProps {
  item: AdminGalleryItem;
  builds: BuildOption[];
  isFirst: boolean;
  isLast: boolean;
}

export function AdminItemCard({ item, builds, isFirst, isLast }: AdminItemCardProps) {
  const platform = PLATFORMS.find((p) => p.id === item.platform)?.name;
  return (
    <li className={`flex flex-col overflow-hidden rounded-md border bg-carbon-2 ${item.published ? 'border-line' : 'border-dashed border-chalk/20'}`}>
      <div className="relative aspect-[4/3] bg-carbon">
        <Image src={item.image_url} alt={item.title} fill sizes="(min-width: 1280px) 22rem, (min-width: 640px) 45vw, 100vw" className={`object-contain ${item.published ? '' : 'opacity-50'}`} />
        <div className="absolute left-2 top-2 flex flex-wrap gap-1.5">
          {!item.published && <Badge tone="warn">Hidden</Badge>}
          {item.is_sample && <Badge>Example</Badge>}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{item.title}</p>
          <p className="truncate text-sm text-chalk/55">{[categoryLabel(item.category), platform, item.vehicle_label].filter(Boolean).join(' · ')}</p>
          {item.caption && <p className="mt-1 line-clamp-2 text-sm text-chalk/70">{item.caption}</p>}
        </div>

        <div className="mt-auto flex flex-wrap items-start gap-2">
          <ActionForm action={setGalleryPublished} className="contents">
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="published" value={item.published ? 'false' : 'true'} />
            <PendingButton variant="secondary" size="sm" className="h-11 min-w-11">
              {item.published ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
              {item.published ? 'Hide' : 'Publish'}
            </PendingButton>
          </ActionForm>
          <ActionForm action={moveGalleryItem} className="flex gap-1" feedback="none">
            <input type="hidden" name="id" value={item.id} />
            <PendingButton variant="ghost" size="sm" name="direction" value="up" disabled={isFirst} className="size-11 px-0" aria-label={`Move ${item.title} earlier`}>
              <ArrowUp className="size-4" aria-hidden="true" />
            </PendingButton>
            <PendingButton variant="ghost" size="sm" name="direction" value="down" disabled={isLast} className="size-11 px-0" aria-label={`Move ${item.title} later`}>
              <ArrowDown className="size-4" aria-hidden="true" />
            </PendingButton>
          </ActionForm>
          <ActionForm action={deleteGalleryItem} confirm={`Delete “${item.title}”? This can’t be undone.`} className="ml-auto">
            <input type="hidden" name="id" value={item.id} />
            <PendingButton variant="danger" size="sm" className="size-11 px-0" aria-label={`Delete ${item.title}`}>
              <Trash2 className="size-4" aria-hidden="true" />
            </PendingButton>
          </ActionForm>
        </div>

        <details className="group rounded-sm border border-line">
          <summary className="flex h-11 cursor-pointer list-none items-center gap-2 px-3 text-sm font-semibold text-chalk/80 hover:text-chalk [&::-webkit-details-marker]:hidden">
            <Pencil className="size-4" aria-hidden="true" /> Edit details
          </summary>
          <EditFields item={item} builds={builds} />
        </details>
      </div>
    </li>
  );
}

function EditFields({ item, builds }: { item: AdminGalleryItem; builds: BuildOption[] }) {
  const id = (name: string) => `${name}-${item.id}`;
  return (
    <ActionForm action={updateGalleryItem} className="grid gap-3 border-t border-line p-3" aria-label={`Edit ${item.title}`}>
      <input type="hidden" name="id" value={item.id} />
      <div>
        <label htmlFor={id('title')} className={labelClass}>Title</label>
        <input id={id('title')} name="title" defaultValue={item.title} required maxLength={LIMITS.title} className={fieldClass} />
      </div>
      <div>
        <label htmlFor={id('caption')} className={labelClass}>Caption</label>
        <textarea id={id('caption')} name="caption" defaultValue={item.caption ?? ''} maxLength={LIMITS.caption} rows={2} className={`${fieldClass} h-auto py-2`} />
      </div>
      <div>
        <label htmlFor={id('alt')} className={labelClass}>Alt text</label>
        <input id={id('alt')} name="alt_text" defaultValue={item.alt_text ?? ''} maxLength={LIMITS.alt} placeholder="Blue L5P Duramax on the shop dyno" className={fieldClass} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={id('category')} className={labelClass}>Category</label>
          <select id={id('category')} name="category" defaultValue={item.category} className={fieldClass}>
            {GALLERY_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={id('platform')} className={labelClass}>Platform</label>
          <select id={id('platform')} name="platform" defaultValue={item.platform ?? ''} className={fieldClass}>
            <option value="">None</option>
            {PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor={id('vehicle')} className={labelClass}>Vehicle</label>
        <input id={id('vehicle')} name="vehicle_label" defaultValue={item.vehicle_label ?? ''} maxLength={LIMITS.vehicle} placeholder="2021 Silverado 2500 L5P" className={fieldClass} />
      </div>
      <div>
        <label htmlFor={id('build')} className={labelClass}>Linked build</label>
        <select id={id('build')} name="build_id" defaultValue={item.build_id ?? ''} className={fieldClass}>
          <option value="">None</option>
          {builds.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
        </select>
      </div>
      <label className="flex h-11 items-center gap-2 text-sm font-semibold text-chalk/85">
        <input type="checkbox" name="published" defaultChecked={item.published} className="size-5" /> Published
      </label>
      <PendingButton size="sm" className="h-11">Save changes</PendingButton>
    </ActionForm>
  );
}

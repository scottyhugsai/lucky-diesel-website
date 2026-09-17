'use server';

import { revalidatePath } from 'next/cache';
import { type ActionState, InputError, checkbox, guard, oneOf, requiredText, requiredUuid, text, uuid } from '@/components/admin/core/parse';
import { CATEGORY_IDS, GALLERY_BUCKET, GALLERY_PLATFORM_IDS, LIMITS, UPLOAD_PATH_RE } from '@/components/gallery/constants';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

const SORT_STEP = 10;

function refresh() {
  revalidatePath('/gallery');
  revalidatePath('/admin/gallery');
}

function platformFrom(form: FormData): string | null {
  const raw = form.get('platform');
  if (raw === null || raw === '') return null;
  return oneOf(form, 'platform', GALLERY_PLATFORM_IDS, 'platform');
}

export interface UploadedPhoto {
  path: string;
  title: string;
  width: number;
  height: number;
}

function validUpload(input: unknown): UploadedPhoto {
  if (typeof input !== 'object' || input === null) throw new InputError('Upload details are missing.');
  const { path, title, width, height } = input as Record<string, unknown>;
  if (typeof path !== 'string' || !UPLOAD_PATH_RE.test(path)) throw new InputError('Upload path is not valid.');
  const cleanTitle = typeof title === 'string' ? title.trim().slice(0, LIMITS.title) : '';
  const dimension = (n: unknown) => typeof n === 'number' && Number.isInteger(n) && n > 0 && n <= LIMITS.maxDimension;
  if (!dimension(width) || !dimension(height)) throw new InputError('Photo dimensions are not valid.');
  return { path, title: cleanTitle || 'Untitled photo', width: width as number, height: height as number };
}

/** Records photos the browser already streamed into the bucket. */
export async function addGalleryUploads(uploads: unknown, category: unknown, published: unknown): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    if (!Array.isArray(uploads) || uploads.length === 0 || uploads.length > LIMITS.batch) throw new InputError(`Add between 1 and ${LIMITS.batch} photos at a time.`);
    if (typeof category !== 'string' || !(CATEGORY_IDS as readonly string[]).includes(category)) throw new InputError('Pick a valid category.');
    const items = uploads.map(validUpload);

    const supabase = await createClient();
    const { data: first } = await supabase.from('gallery_items').select('sort').order('sort', { ascending: true }).limit(1).maybeSingle();
    const startSort = (first?.sort ?? 0) - SORT_STEP * items.length;
    const rows = items.map((item, i) => ({
      title: item.title,
      category,
      image_url: supabase.storage.from(GALLERY_BUCKET).getPublicUrl(item.path).data.publicUrl,
      storage_path: item.path,
      width: item.width,
      height: item.height,
      sort: startSort + i * SORT_STEP,
      published: published === true,
    }));
    const { error } = await supabase.from('gallery_items').insert(rows);
    if (error) throw new Error(error.message);
    refresh();
    return { notice: `${rows.length} photo${rows.length === 1 ? '' : 's'} added${published === true ? '' : ' as hidden'}.` };
  });
}

export async function updateGalleryItem(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const id = requiredUuid(form, 'id', 'Photo');
    const patch = {
      title: requiredText(form, 'title', 'Title', LIMITS.title),
      caption: text(form, 'caption', { max: LIMITS.caption, label: 'Caption' }),
      category: oneOf(form, 'category', CATEGORY_IDS, 'category'),
      platform: platformFrom(form),
      vehicle_label: text(form, 'vehicle_label', { max: LIMITS.vehicle, label: 'Vehicle' }),
      build_id: uuid(form, 'build_id', { required: false, label: 'Build' }),
      published: checkbox(form, 'published'),
    };
    const supabase = await createClient();
    const { data, error } = await supabase.from('gallery_items').update(patch).eq('id', id).select('id').maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new InputError('That photo no longer exists.');
    refresh();
    return { notice: 'Saved.' };
  });
}

export async function setGalleryPublished(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const id = requiredUuid(form, 'id', 'Photo');
    const published = oneOf(form, 'published', ['true', 'false'] as const, 'state') === 'true';
    const supabase = await createClient();
    const { data, error } = await supabase.from('gallery_items').update({ published }).eq('id', id).select('id').maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new InputError('That photo no longer exists.');
    refresh();
    return { notice: published ? 'Live on the site.' : 'Hidden.' };
  });
}

/** Swaps a photo with its neighbour, then rewrites `sort` in even steps so ties can't recur. */
export async function moveGalleryItem(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const id = requiredUuid(form, 'id', 'Photo');
    const direction = oneOf(form, 'direction', ['up', 'down'] as const, 'direction');
    const supabase = await createClient();
    const { data: all, error } = await supabase.from('gallery_items').select('id, sort').order('sort').order('created_at', { ascending: false });
    if (error) throw new Error(error.message);

    const order = (all ?? []).map((row) => row.id);
    const from = order.indexOf(id);
    const to = direction === 'up' ? from - 1 : from + 1;
    if (from === -1) throw new InputError('That photo no longer exists.');
    if (to < 0 || to >= order.length) return {};
    const reordered = order.map((value, i) => (i === from ? order[to]! : i === to ? order[from]! : value));

    const current = new Map((all ?? []).map((row) => [row.id, row.sort]));
    const updates = reordered
      .map((rowId, i) => ({ rowId, sort: (i + 1) * SORT_STEP }))
      .filter(({ rowId, sort }) => current.get(rowId) !== sort)
      .map(({ rowId, sort }) => supabase.from('gallery_items').update({ sort }).eq('id', rowId));
    const results = await Promise.all(updates);
    const failed = results.find((r) => r.error);
    if (failed?.error) throw new Error(failed.error.message);
    refresh();
    return {};
  });
}

export async function deleteGalleryItem(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const id = requiredUuid(form, 'id', 'Photo');
    const supabase = await createClient();
    const { data, error } = await supabase.from('gallery_items').delete().eq('id', id).select('storage_path').maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new InputError('That photo was already deleted.');
    refresh();
    if (data.storage_path) {
      const { data: removed, error: storageError } = await supabase.storage.from(GALLERY_BUCKET).remove([data.storage_path]);
      // Storage reports a policy-blocked delete as success with nothing removed.
      if (storageError || !removed?.length) {
        return { error: `Photo removed from the gallery, but its file couldn’t be deleted${storageError ? `: ${storageError.message}` : '.'}` };
      }
    }
    return { notice: 'Deleted.' };
  });
}

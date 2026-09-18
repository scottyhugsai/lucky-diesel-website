'use server';

import { revalidatePath } from 'next/cache';
import { type ActionState, InputError, guard, requiredText, requiredUuid, text } from '@/components/admin/core/parse';
import { GALLERY_BUCKET } from '@/components/gallery/constants';
import { requireRole } from '@/lib/auth';
import { audit } from '@/lib/site-content/write';
import { createClient } from '@/lib/supabase/server';

/** The only storage paths this area will record. Site photos live beside the gallery's. */
export const SITE_UPLOAD_PATH_RE = /^site\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;
const MAX_DIMENSION = 20_000;
const MAX_BATCH = 20;

export interface UploadedSiteMedia {
  path: string;
  title: string;
  width: number;
  height: number;
  bytes: number;
}

function validUpload(input: unknown): UploadedSiteMedia {
  if (typeof input !== 'object' || input === null) throw new InputError('Upload details are missing.');
  const { path, title, width, height, bytes } = input as Record<string, unknown>;
  if (typeof path !== 'string' || !SITE_UPLOAD_PATH_RE.test(path)) throw new InputError('Upload path is not valid.');
  const dimension = (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= MAX_DIMENSION;
  if (!dimension(width) || !dimension(height)) throw new InputError('Photo dimensions are not valid.');
  const clean = typeof title === 'string' ? title.trim().slice(0, 120) : '';
  return {
    path,
    title: clean || 'Untitled photo',
    width: width as number,
    height: height as number,
    bytes: typeof bytes === 'number' && bytes > 0 ? Math.round(bytes) : 0,
  };
}

/** Records photos the browser already streamed into the bucket. */
export async function addSiteMedia(uploads: unknown): Promise<ActionState> {
  const viewer = await requireRole('admin');
  return guard(async () => {
    if (!Array.isArray(uploads) || uploads.length === 0 || uploads.length > MAX_BATCH) {
      throw new InputError(`Add between 1 and ${MAX_BATCH} photos at a time.`);
    }
    const items = uploads.map(validUpload);
    const supabase = await createClient();
    const rows = items.map((item) => ({
      title: item.title,
      url: supabase.storage.from(GALLERY_BUCKET).getPublicUrl(item.path).data.publicUrl,
      storage_path: item.path,
      width: item.width,
      height: item.height,
      bytes: item.bytes || null,
      created_by: viewer.userId,
    }));
    const { error } = await supabase.from('site_media').insert(rows);
    if (error) throw new Error(error.message);
    await audit(supabase, viewer, {
      action: 'upload',
      entity: 'media',
      entityKey: `${rows.length} photo${rows.length === 1 ? '' : 's'}`,
      summary: items.map((item) => item.title).join(', '),
    });
    revalidatePath('/admin/site', 'layout');
    return { notice: `${rows.length} photo${rows.length === 1 ? '' : 's'} added.` };
  });
}

export async function renameSiteMedia(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const id = requiredUuid(form, 'id', 'Photo');
    const patch = {
      title: requiredText(form, 'title', 'Title', 120),
      alt_text: text(form, 'alt_text', { max: 200, label: 'Description' }),
    };
    const supabase = await createClient();
    const { data, error } = await supabase.from('site_media').update(patch).eq('id', id).select('id').maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new InputError('That photo no longer exists.');
    revalidatePath('/admin/site', 'layout');
    return { notice: 'Saved.' };
  });
}

export async function deleteSiteMedia(_prev: ActionState, form: FormData): Promise<ActionState> {
  const viewer = await requireRole('admin');
  return guard(async () => {
    const id = requiredUuid(form, 'id', 'Photo');
    const supabase = await createClient();
    const { data, error } = await supabase.from('site_media').delete().eq('id', id).select('title, storage_path').maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new InputError('That photo was already deleted.');
    await audit(supabase, viewer, { action: 'delete', entity: 'media', entityKey: data.title, summary: 'Photo deleted' });
    revalidatePath('/admin/site', 'layout');

    const { data: removed, error: storageError } = await supabase.storage.from(GALLERY_BUCKET).remove([data.storage_path]);
    // Storage reports a policy-blocked delete as a success with nothing removed.
    if (storageError || !removed?.length) {
      return { error: `Photo removed from the library, but its file couldn’t be deleted${storageError ? `: ${storageError.message}` : '.'}` };
    }
    return { notice: 'Deleted. Anywhere it was used now shows no photo.' };
  });
}

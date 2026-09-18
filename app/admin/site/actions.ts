'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { type ActionState, InputError, guard, oneOf, requiredText } from '@/components/admin/core/parse';
import { requireRole } from '@/lib/auth';
import { DESIGNS } from '@/lib/design';
import { changedFields } from '@/lib/site-content/diff';
import type { BlockDef, BlockValues } from '@/lib/site-content/fields';
import { PREVIEW_COOKIE } from '@/lib/site-content/read';
import { blockDef } from '@/lib/site-content/registry';
import { ContentError, validateBlock } from '@/lib/site-content/validate';
import { discardDraft, publishBlock, revertToShipped, saveDraft } from '@/lib/site-content/write';
import { createClient } from '@/lib/supabase/server';

const SCOPES = ['all', ...DESIGNS] as const;

/** ContentError is the owner's typo; InputError is what the form knows how to show. */
function asInputError(caught: unknown): never {
  if (caught instanceof ContentError) throw new InputError(caught.message);
  throw caught;
}

function refresh(): void {
  revalidatePath('/', 'layout');
  revalidatePath('/admin/site', 'layout');
}

function defFrom(form: FormData): { def: BlockDef; design: string } {
  const key = requiredText(form, 'key', 'Block', 140);
  const def = blockDef(key);
  if (!def) throw new InputError('That part of the site cannot be edited.');
  return { def, design: oneOf(form, 'design', SCOPES, 'design') };
}

/** FormData → a plain record, with list fields read back from their ordered hidden input. */
function readFields(def: BlockDef, form: FormData): Record<string, unknown> {
  const input: Record<string, unknown> = {};
  for (const field of def.fields) {
    if (field.kind === 'list') {
      const raw = form.get(field.name);
      input[field.name] = typeof raw === 'string' && raw.trim() ? raw.split(',').map((value) => value.trim()) : [];
      continue;
    }
    input[field.name] = form.get(field.name);
  }
  return input;
}

export async function saveBlockAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const viewer = await requireRole('admin');
  return guard(async () => {
    const { def, design } = defFrom(form);
    const values = (() => {
      try {
        return validateBlock(def, readFields(def, form));
      } catch (caught) {
        return asInputError(caught);
      }
    })();
    const supabase = await createClient();
    await saveDraft(supabase, viewer, def, design, values);
    revalidatePath('/admin/site', 'layout');
    return { notice: 'Saved as a draft. Publish when you are ready.' };
  });
}

export async function publishBlockAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const viewer = await requireRole('admin');
  return guard(async () => {
    const { def, design } = defFrom(form);
    const supabase = await createClient();
    const published = await publishBlock(supabase, viewer, def, design);
    refresh();
    return { notice: published ? 'Live on the site.' : 'Nothing to publish — the draft matches what is live.' };
  });
}

/** One button for "make everything I have been editing live". */
export async function publishEverythingAction(): Promise<ActionState> {
  const viewer = await requireRole('admin');
  return guard(async () => {
    const supabase = await createClient();
    const { data, error } = await supabase.from('site_blocks').select('key, design');
    if (error) throw new Error(error.message);
    let count = 0;
    for (const row of data ?? []) {
      const def = blockDef(row.key);
      if (!def) continue;
      if (await publishBlock(supabase, viewer, def, row.design)) count += 1;
    }
    refresh();
    return { notice: count ? `${count} change${count === 1 ? '' : 's'} published.` : 'Everything was already live.' };
  });
}

export async function discardBlockAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const viewer = await requireRole('admin');
  return guard(async () => {
    const { def, design } = defFrom(form);
    const supabase = await createClient();
    await discardDraft(supabase, viewer, def, design);
    revalidatePath('/admin/site', 'layout');
    return { notice: 'Draft thrown away.' };
  });
}

export async function revertBlockAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const viewer = await requireRole('admin');
  return guard(async () => {
    const { def, design } = defFrom(form);
    const supabase = await createClient();
    await revertToShipped(supabase, viewer, def, design);
    refresh();
    return { notice: 'Reset to the copy the site shipped with.' };
  });
}

/** Preview is a cookie, but every read re-checks the admin role, so it grants nothing on its own. */
export async function setPreviewAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const on = oneOf(form, 'on', ['true', 'false'] as const, 'state') === 'true';
    const jar = await cookies();
    if (on) jar.set(PREVIEW_COOKIE, '1', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 8 });
    else jar.delete(PREVIEW_COOKIE);
    revalidatePath('/', 'layout');
    return { notice: on ? 'Preview on — you now see drafts on the site.' : 'Preview off.' };
  });
}

/** How many blocks have edits waiting, for the header badge. One query. */
export async function countPendingBlocks(): Promise<number> {
  await requireRole('admin');
  const supabase = await createClient();
  const { data, error } = await supabase.from('site_blocks').select('key, design, draft, published');
  if (error) return 0;
  return (data ?? []).filter((row) => {
    const def = blockDef(row.key);
    if (!def) return false;
    return changedFields(def, (row.published ?? null) as BlockValues | null, (row.draft ?? {}) as BlockValues).length > 0;
  }).length;
}

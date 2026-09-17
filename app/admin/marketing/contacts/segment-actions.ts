'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { fail, isUuid, ok, str, type ActionState } from '@/components/admin/ops/form';
import { requireRole } from '@/lib/auth';
import { parseSegmentRules } from '@/lib/marketing/core/segment-rules';
import { previewSegment, refreshSegment } from '@/lib/marketing/core/segments';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const BASE = '/admin/marketing/contacts/segments';

export interface PreviewResult {
  count: number | null;
  sample: string[];
  error: string | null;
}

/** Live count for the rule builder. Nothing is saved. */
export async function previewSegmentAction(rulesJson: string): Promise<PreviewResult> {
  await requireRole('admin');
  if (typeof rulesJson !== 'string' || rulesJson.length > 20_000) return { count: null, sample: [], error: 'Rules are too large.' };
  let raw: unknown;
  try {
    raw = JSON.parse(rulesJson);
  } catch {
    return { count: null, sample: [], error: 'Rules are not valid.' };
  }
  const parsed = parseSegmentRules(raw);
  if (!parsed.ok) return { count: null, sample: [], error: parsed.error };
  if (!parsed.rules.conditions.length) return { count: 0, sample: [], error: null };
  const db = createAdminClient();
  try {
    const { count, customerIds } = await previewSegment(parsed.rules, db);
    const { data } = customerIds.length ? await db.from('customers').select('full_name').in('id', customerIds.slice(0, 5)) : { data: [] };
    return { count, sample: (data ?? []).map((c) => c.full_name), error: null };
  } catch (caught) {
    return { count: null, sample: [], error: caught instanceof Error ? caught.message : 'Preview failed.' };
  }
}

export async function saveSegmentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireRole('admin');
  const id = str(formData, 'id');
  if (id && !isUuid(id)) return fail('Unknown segment.');
  const name = str(formData, 'name');
  if (!name || name.length > 80) return fail('Name the segment (max 80 characters).');
  const description = str(formData, 'description').slice(0, 300) || null;
  let raw: unknown;
  try {
    raw = JSON.parse(str(formData, 'rules'));
  } catch {
    return fail('Rules are not valid.');
  }
  const parsed = parseSegmentRules(raw);
  if (!parsed.ok) return fail(parsed.error);
  if (!parsed.rules.conditions.length) return fail('Add at least one rule.');

  const supabase = await createClient();
  const rules = JSON.parse(JSON.stringify(parsed.rules));
  const saved = id
    ? await supabase.from('segments').update({ name, description, rules }).eq('id', id).select('id').single()
    : await supabase.from('segments').insert({ name, description, rules, created_by: viewer.userId }).select('id').single();
  if (saved.error || !saved.data) return fail(`Could not save: ${saved.error?.message ?? 'unknown error'}`);

  const refreshed = await refreshSegment(saved.data.id, createAdminClient());
  revalidatePath(BASE);
  revalidatePath('/admin/marketing/campaigns/new');
  const note = refreshed.ok ? `Saved. ${refreshed.count} people match.` : `Saved. Refresh failed: ${refreshed.error}`;
  if (!id) redirect(`${BASE}/${saved.data.id}?notice=${encodeURIComponent(note)}`);
  revalidatePath(`${BASE}/${id}`);
  return ok(note);
}

export async function refreshSegmentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('admin');
  const id = str(formData, 'id');
  if (!isUuid(id)) return fail('Unknown segment.');
  const result = await refreshSegment(id, createAdminClient());
  if (!result.ok) return fail(result.error);
  revalidatePath(BASE);
  revalidatePath(`${BASE}/${id}`);
  return ok(`Refreshed. ${result.count} people match.`);
}

export async function deleteSegmentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('admin');
  const id = str(formData, 'id');
  if (!isUuid(id)) return fail('Unknown segment.');
  const supabase = await createClient();
  const { count } = await supabase.from('campaigns').select('id', { count: 'exact', head: true }).eq('segment_id', id).in('status', ['scheduled', 'sending', 'active']);
  if (count) return fail('A live campaign uses this segment. Pause it first.');
  const { error } = await supabase.from('segments').delete().eq('id', id);
  if (error) return fail('Could not delete.');
  revalidatePath(BASE);
  redirect(BASE);
}

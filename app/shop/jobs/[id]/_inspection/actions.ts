'use server';

import { revalidatePath } from 'next/cache';
import { checked, fail, isUuid, num, ok, oneOf, text, type ActionState } from '@/app/shop/_lib/form';
import { INSPECTION_CATEGORIES, RATINGS, mediaPathPattern } from '@/app/shop/_lib/inspection';
import { emit } from '@/lib/automations/engine';
import { requireRole } from '@/lib/auth';
import { changeWorkOrderStatus } from '@/lib/domain/work-orders';
import { createClient } from '@/lib/supabase/server';

type Db = Awaited<ReturnType<typeof createClient>>;
const UNIQUE_VIOLATION = '23505';

function refreshJob(workOrderId: string) {
  revalidatePath(`/shop/jobs/${workOrderId}`);
  revalidatePath('/shop');
}

/** The job's inspection if it is still editable, else a user-facing error. */
async function draftInspection(db: Db, workOrderId: string): Promise<{ id: string } | { error: string }> {
  const { data } = await db.from('inspections').select('id, status').eq('work_order_id', workOrderId).maybeSingle();
  if (!data) return { error: 'Start the inspection first.' };
  if (data.status === 'sent') return { error: 'This inspection was already sent to the customer.' };
  return { id: data.id };
}

async function itemOnJob(db: Db, workOrderId: string, itemId: unknown): Promise<{ id: string; draft: boolean } | null> {
  if (!isUuid(itemId)) return null;
  const { data } = await db.from('inspection_items').select('id, inspections!inner(work_order_id, status)').eq('id', itemId).maybeSingle();
  if (!data || data.inspections.work_order_id !== workOrderId) return null;
  return { id: data.id, draft: data.inspections.status === 'draft' };
}

export async function startInspection(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireRole('employee', 'admin');
  const workOrderId = formData.get('workOrderId');
  if (!isUuid(workOrderId)) return fail('That job link is broken.');

  const db = await createClient();
  const { error } = await db.from('inspections').insert({ work_order_id: workOrderId, tech_id: viewer.userId });
  if (error && error.code !== UNIQUE_VIOLATION) return fail('Couldn’t start the inspection. Try again.');

  refreshJob(workOrderId);
  return ok('Inspection started. Add what you find.');
}

export async function addInspectionItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('employee', 'admin');
  const workOrderId = formData.get('workOrderId');
  if (!isUuid(workOrderId)) return fail('That job link is broken.');
  const category = oneOf(formData, 'category', INSPECTION_CATEGORIES);
  const rating = oneOf(formData, 'rating', RATINGS);
  const label = text(formData, 'label', { max: 120, required: true });
  const notes = text(formData, 'notes', { max: 1000 });
  if (!category) return fail('Pick a category.');
  if (!label.value) return fail(label.error === 'required' ? 'Name what you inspected.' : `Label ${label.error}.`);
  if (notes.error) return fail(`Notes ${notes.error}.`);
  if (!rating) return fail('Rate it green, yellow or red.');

  const db = await createClient();
  const inspection = await draftInspection(db, workOrderId);
  if ('error' in inspection) return fail(inspection.error);

  const { count } = await db.from('inspection_items').select('id', { count: 'exact', head: true }).eq('inspection_id', inspection.id);
  const { error } = await db
    .from('inspection_items')
    .insert({ inspection_id: inspection.id, category, label: label.value, notes: notes.value, rating, sort: count ?? 0 });
  if (error) return fail('Couldn’t add the item. Try again.');

  refreshJob(workOrderId);
  return ok(`Added “${label.value}”.`);
}

export async function setItemRating(workOrderId: string, itemId: string, rating: string): Promise<ActionState> {
  await requireRole('employee', 'admin');
  if (!isUuid(workOrderId) || !(RATINGS as readonly string[]).includes(rating)) return fail('Pick green, yellow or red.');
  const db = await createClient();
  const item = await itemOnJob(db, workOrderId, itemId);
  if (!item) return fail('Item not found.');
  if (!item.draft) return fail('Already sent — ratings are locked.');

  const { error } = await db.from('inspection_items').update({ rating: rating as (typeof RATINGS)[number] }).eq('id', item.id);
  if (error) return fail('Couldn’t save the rating.');
  refreshJob(workOrderId);
  return ok('Rating saved.');
}

export async function deleteInspectionItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('employee', 'admin');
  const workOrderId = formData.get('workOrderId');
  if (!isUuid(workOrderId)) return fail('That job link is broken.');
  const db = await createClient();
  const item = await itemOnJob(db, workOrderId, formData.get('itemId'));
  if (!item) return fail('Item not found.');
  if (!item.draft) return fail('Already sent — items can’t be removed.');

  const { error } = await db.from('inspection_items').delete().eq('id', item.id);
  if (error) return fail('Couldn’t remove the item.');
  refreshJob(workOrderId);
  return ok('Item removed.');
}

export async function attachMedia(input: { workOrderId: string; itemId: string; path: string; kind: string }): Promise<ActionState> {
  const viewer = await requireRole('employee', 'admin');
  const { workOrderId, itemId, path, kind } = input;
  if (!isUuid(workOrderId) || typeof path !== 'string' || !mediaPathPattern(workOrderId).test(path)) return fail('Upload path is invalid.');
  if (kind !== 'photo' && kind !== 'video') return fail('Only photos and videos can be attached.');

  const db = await createClient();
  const item = await itemOnJob(db, workOrderId, itemId);
  if (!item) return fail('Item not found.');

  const { error } = await db
    .from('media')
    .insert({ work_order_id: workOrderId, inspection_item_id: item.id, path, kind, bucket: 'media', uploaded_by: viewer.userId });
  if (error) return fail('Uploaded, but couldn’t attach it to the item. Try again.');
  refreshJob(workOrderId);
  return ok(kind === 'video' ? 'Video attached.' : 'Photo attached.');
}

export async function addRecommendedLine(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('employee', 'admin');
  const workOrderId = formData.get('workOrderId');
  if (!isUuid(workOrderId)) return fail('That job link is broken.');
  const kind = oneOf(formData, 'kind', ['part', 'labor'] as const);
  const description = text(formData, 'description', { max: 200, required: true });
  const quantity = num(formData, 'quantity', { min: 0.01, max: 999 });
  const price = num(formData, 'price', { min: 0, max: 100_000 });
  if (!kind) return fail('Choose part or labor.');
  if (!description.value) return fail(description.error === 'required' ? 'Describe the work.' : `Description ${description.error}.`);
  if (quantity.error || quantity.value === null) return fail(kind === 'labor' ? 'Enter hours (0.01–999).' : 'Enter a quantity (0.01–999).');
  if (price.error || price.value === null) return fail('Enter a price between $0 and $100,000.');

  const db = await createClient();
  const item = await itemOnJob(db, workOrderId, formData.get('itemId'));
  if (!item) return fail('Item not found.');

  const { data: last } = await db.from('line_items').select('sort').eq('work_order_id', workOrderId).order('sort', { ascending: false }).limit(1).maybeSingle();
  const { error } = await db.from('line_items').insert({
    work_order_id: workOrderId,
    inspection_item_id: item.id,
    kind,
    description: description.value,
    quantity: Math.round(quantity.value * 100) / 100,
    unit_price_cents: Math.round(price.value * 100),
    taxable: checked(formData, 'taxable'),
    recommended: true,
    approval: 'pending',
    sort: (last?.sort ?? 0) + 1,
  });
  if (error) return fail('Couldn’t add the line. Try again.');

  refreshJob(workOrderId);
  return ok('Recommended work added to the estimate.');
}

export async function sendInspection(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireRole('employee', 'admin');
  const workOrderId = formData.get('workOrderId');
  if (!isUuid(workOrderId)) return fail('That job link is broken.');
  const summary = text(formData, 'summary', { max: 1000 });
  if (summary.error) return fail(`Summary ${summary.error}.`);

  const db = await createClient();
  const inspection = await draftInspection(db, workOrderId);
  if ('error' in inspection) return fail(inspection.error);
  const { count } = await db.from('inspection_items').select('id', { count: 'exact', head: true }).eq('inspection_id', inspection.id);
  if (!count) return fail('Add at least one item before sending.');

  const { error } = await db
    .from('inspections')
    .update({ status: 'sent', sent_at: new Date().toISOString(), summary: summary.value, tech_id: viewer.userId })
    .eq('id', inspection.id);
  if (error) return fail('Couldn’t send the inspection. Try again.');

  const { data: job } = await db.from('work_orders').select('status').eq('id', workOrderId).maybeSingle();
  if (job?.status === 'estimate') {
    const moved = await changeWorkOrderStatus(workOrderId, 'awaiting_approval', viewer.userId, 'Inspection sent to customer');
    if (!moved.ok) return fail(`Sent, but the job status didn’t update: ${moved.error}`);
  }
  await emit({ name: 'inspection.sent', subjectType: 'work_order', subjectId: workOrderId });

  refreshJob(workOrderId);
  return ok('Sent. The customer is getting a text and email with the approval link.');
}

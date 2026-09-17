'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { parseCampaignDraft, parseSteps } from '@/components/admin/marketing/core-ui/campaign-input';
import { insertCampaign, replaceSteps } from '@/components/admin/marketing/core-ui/campaign-write';
import { fail, isUuid, ok, str, type ActionState } from '@/components/admin/ops/form';
import { requireRole } from '@/lib/auth';
import { dateTime } from '@/lib/format';
import { pauseCampaign, scheduleCampaign, windowFor } from '@/lib/marketing/core/campaigns';
import { isWithinWindow, nextSendTime } from '@/lib/marketing/core/policy';
import { getMarketingSettings } from '@/lib/marketing/core/settings';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { shopOffsetMinutes } from '@/components/admin/core/parse';

const BASE = '/admin/marketing/campaigns';

function refresh(id?: string) {
  revalidatePath('/admin/marketing');
  revalidatePath(BASE);
  if (id) revalidatePath(`${BASE}/${id}`);
}

/** `datetime-local` in shop time → Date, or null when blank/invalid. */
function shopDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const asUtc = new Date(`${value}:00Z`);
  if (Number.isNaN(asUtc.getTime())) return null;
  return new Date(asUtc.getTime() - shopOffsetMinutes(asUtc) * 60_000);
}

/** Status changes swap the controls, so show the result as a page notice instead of inline. */
function backWith(id: string, state: ActionState): ActionState {
  if (state.error) return state;
  redirect(`${BASE}/${id}?notice=${encodeURIComponent(state.notice ?? 'Saved.')}`);
}

/** Schedules through core and explains when quiet hours or the send window move the time. */
async function scheduleWithNote(id: string, at: Date): Promise<ActionState> {
  const db = createAdminClient();
  const result = await scheduleCampaign(id, at, db);
  if (!result.ok) {
    const detail = result.issues?.length ? ` ${result.issues.map((i) => `“${i.match}”: ${i.reason}`).join(' ')}` : '';
    return fail(`${result.error}${detail}`);
  }
  const [{ data: campaign }, settings] = await Promise.all([
    db.from('campaigns').select('send_window_start_hour, send_window_end_hour').eq('id', id).single(),
    getMarketingSettings(db),
  ]);
  const window = campaign ? windowFor(campaign, settings) : null;
  const moved = window && !isWithinWindow(at, window) ? nextSendTime(at, window) : null;
  refresh(id);
  if (result.data.status === 'active') return ok('Campaign is live. New people enroll automatically.');
  return ok(moved ? `Scheduled. Quiet hours move it to ${dateTime(moved)}.` : `Scheduled for ${dateTime(at)}.`);
}

export async function createCampaignAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireRole('admin');
  const parsed = parseCampaignDraft(str(formData, 'payload'));
  if (!parsed.ok) return fail(parsed.error);
  const intent = str(formData, 'intent') === 'schedule' ? 'schedule' : 'draft';
  const when = str(formData, 'scheduled_at');
  const at = when ? shopDate(when) : new Date();
  if (!at) return fail('Pick a valid send time.');
  if (intent === 'schedule' && at.getTime() < Date.now() - 5 * 60_000) return fail('Pick a time in the future.');

  const supabase = await createClient();
  const created = await insertCampaign(supabase, parsed.value, viewer.userId);
  if ('error' in created) return fail(`Could not save: ${created.error}`);

  let note = 'Draft saved.';
  if (intent === 'schedule') {
    const scheduled = await scheduleWithNote(created.id, at);
    if (scheduled.error) note = `Saved as draft. ${scheduled.error}`;
    else note = scheduled.notice ?? note;
  }
  refresh(created.id);
  redirect(`${BASE}/${created.id}?notice=${encodeURIComponent(note)}`);
}

export async function scheduleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('admin');
  const id = str(formData, 'id');
  if (!isUuid(id)) return fail('Unknown campaign.');
  const when = str(formData, 'scheduled_at');
  const at = when ? shopDate(when) : new Date();
  if (!at) return fail('Pick a valid send time.');
  if (at.getTime() < Date.now() - 5 * 60_000) return fail('Pick a time in the future.');
  return backWith(id, await scheduleWithNote(id, at));
}

export async function pauseAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('admin');
  const id = str(formData, 'id');
  if (!isUuid(id)) return fail('Unknown campaign.');
  const result = await pauseCampaign(id, createAdminClient());
  if (!result.ok) return fail(result.error);
  refresh(id);
  return backWith(id, ok('Paused. Nothing more sends until you resume.'));
}

export async function resumeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('admin');
  const id = str(formData, 'id');
  if (!isUuid(id)) return fail('Unknown campaign.');
  const supabase = await createClient();
  const { data } = await supabase.from('campaigns').select('status, scheduled_at').eq('id', id).maybeSingle();
  if (!data) return fail('Campaign not found.');
  if (data.status !== 'paused') return fail('Only paused campaigns can resume.');
  const planned = data.scheduled_at ? new Date(data.scheduled_at) : new Date();
  return backWith(id, await scheduleWithNote(id, planned.getTime() > Date.now() ? planned : new Date()));
}

export async function archiveAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('admin');
  const id = str(formData, 'id');
  if (!isUuid(id)) return fail('Unknown campaign.');
  const supabase = await createClient();
  const { error } = await supabase.from('campaigns').update({ status: 'archived' }).eq('id', id).in('status', ['draft', 'paused', 'sent']);
  if (error) return fail('Could not archive. Pause it first.');
  refresh(id);
  return backWith(id, ok('Archived.'));
}

export async function saveStepsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('admin');
  const id = str(formData, 'id');
  if (!isUuid(id)) return fail('Unknown campaign.');
  const supabase = await createClient();
  const { data: campaign } = await supabase.from('campaigns').select('status, channel, kind, ab_test_percent').eq('id', id).maybeSingle();
  if (!campaign) return fail('Campaign not found.');
  if (!['draft', 'paused'].includes(campaign.status)) return fail('Pause the campaign before editing.');
  if (campaign.channel !== 'email' && campaign.channel !== 'sms') return fail('Unsupported channel.');

  let raw: unknown;
  try {
    raw = JSON.parse(str(formData, 'steps'));
  } catch {
    return fail('Steps are not valid.');
  }
  const steps = parseSteps(raw, campaign.channel, campaign.kind);
  if (!steps.ok) return fail(steps.error);
  const exitOn = formData.getAll('exit_on').filter((v): v is string => ['booked', 'replied', 'unsubscribed'].includes(String(v)));

  const saved = await replaceSteps(supabase, id, steps.value);
  if ('error' in saved) return fail(`Could not save: ${saved.error}`);
  const hasB = steps.value.some((s) => s.variant === 'B');
  const abPercent = hasB ? campaign.ab_test_percent || (campaign.kind === 'broadcast' ? 20 : 100) : 0;
  const { error } = await supabase.from('campaigns')
    .update({ ab_test_percent: abPercent, ...(campaign.kind !== 'broadcast' ? { exit_on: exitOn } : {}) }).eq('id', id);
  if (error) return fail('Steps saved, settings failed.');
  refresh(id);
  return ok('Steps saved.');
}

export async function saveAudienceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('admin');
  const id = str(formData, 'id');
  const segmentId = str(formData, 'segment_id');
  if (!isUuid(id)) return fail('Unknown campaign.');
  if (segmentId && !isUuid(segmentId)) return fail('Pick a valid segment.');
  const name = str(formData, 'name');
  if (!name || name.length > 120) return fail('Name the campaign (max 120 characters).');
  const supabase = await createClient();
  const { data, error } = await supabase.from('campaigns').update({ segment_id: segmentId || null, name })
    .eq('id', id).in('status', ['draft', 'paused']).select('id');
  if (error) return fail('Could not save.');
  if (!data?.length) return fail('Pause the campaign before changing its audience.');
  refresh(id);
  return ok('Saved.');
}

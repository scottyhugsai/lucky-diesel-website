'use server';

import { revalidatePath } from 'next/cache';
import { fail, numberIn, ok, oneOf, str, type ActionState } from '@/components/admin/ops/form';
import { requireRole } from '@/lib/auth';
import { CHECKLISTS, findChecklist, periodKey } from '@/lib/marketing/content/checklists';
import { toJson } from '@/lib/marketing/content/db';
import { refreshSenderDns } from '@/lib/marketing/content/health-service';
import { BUSINESS_TYPES, MAX_SAMPLES, PROFILE_TEXT_KEYS, TENDLC_USE_CASES, validateProfile, type TendlcProfile } from '@/lib/marketing/content/tendlc';
import { BUSINESS } from '@/lib/site';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const PATH = '/admin/marketing/settings';
const MAX_CAP_USD = 5000;
const MAX_FIELD = 1024;

/** Monthly AI spend cap. 0 keeps every generator on templates. */
export async function saveAiCapAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('admin');
  const cap = numberIn(formData, 'ai_monthly_cap_usd', 0, MAX_CAP_USD);
  if (cap === null) return fail(`Cap must be $0–$${MAX_CAP_USD}.`);
  const supabase = await createClient();
  const { error } = await supabase.from('marketing_settings').update({ ai_monthly_cap_usd: cap }).eq('id', 1);
  if (error) return fail('Could not save the cap.');
  revalidatePath(PATH);
  revalidatePath('/admin/marketing/content/connections');
  return ok(cap === 0 ? 'AI paused. Drafts use templates.' : `Cap set to $${cap.toFixed(2)} a month.`);
}

/** 10DLC brand + campaign answers, ready to paste into the carrier form. */
export async function saveTendlcAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('admin');
  const useCase = oneOf(formData.get('useCase'), TENDLC_USE_CASES);
  const businessType = oneOf(formData.get('businessType'), BUSINESS_TYPES);
  if (!useCase || !businessType) return fail('Pick a business type and use case.');

  const profile = { useCase, businessType } as TendlcProfile;
  for (const key of PROFILE_TEXT_KEYS) {
    const value = str(formData, key);
    if (value.length > MAX_FIELD) return fail('One of the fields is too long.');
    profile[key] = value;
  }
  profile.businessType = businessType;
  profile.samples = str(formData, 'samples').split('\n').map((s) => s.trim()).filter(Boolean).slice(0, MAX_SAMPLES);
  if (profile.samples.some((s) => s.length > 320)) return fail('Samples must be under 320 characters.');

  const supabase = await createClient();
  const { error } = await supabase.from('marketing_settings').update({ tendlc_profile: toJson(profile) }).eq('id', 1);
  if (error) return fail('Could not save.');
  revalidatePath(PATH);
  const issues = validateProfile(profile, BUSINESS.name);
  return ok(issues.length ? `Saved. ${issues.length} thing${issues.length === 1 ? '' : 's'} still to fix.` : 'Saved. The packet is ready to submit.');
}

/** Re-runs the SPF / DKIM / DMARC lookups for the sending domain. */
export async function checkSenderDnsAction(): Promise<ActionState> {
  await requireRole('admin');
  try {
    const cache = await refreshSenderDns(createAdminClient());
    revalidatePath(PATH);
    if (!cache.domain) return fail('Add a sender email in Sending rules first.');
    const bad = cache.checks.filter((c) => c.state !== 'pass').length;
    return ok(bad ? `${bad} record${bad === 1 ? '' : 's'} need attention.` : 'SPF, DKIM and DMARC all pass.');
  } catch {
    return fail('Lookup failed. Try again in a minute.');
  }
}

/** Ticks or unticks one checklist item for the current period. */
export async function toggleChecklistAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireRole('admin');
  const kind = oneOf(formData.get('checklist'), CHECKLISTS.map((c) => c.kind));
  const list = kind ? findChecklist(kind) : null;
  if (!list) return fail('Unknown checklist.');
  const item = str(formData, 'item');
  if (!list.items.some((i) => i.id === item)) return fail('Unknown item.');
  const period = periodKey(list.kind);
  const done = str(formData, 'done') === 'true';

  const supabase = await createClient();
  if (done) {
    const { error } = await supabase.from('ops_checklist_ticks').delete().match({ checklist: list.kind, period, item });
    if (error) return fail('Could not update.');
  } else {
    const { error } = await supabase.from('ops_checklist_ticks').upsert({ checklist: list.kind, period, item, done_by: viewer.userId, done_at: new Date().toISOString() }, { onConflict: 'checklist,period,item' });
    if (error) return fail('Could not update.');
  }
  revalidatePath('/admin/marketing');
  return ok(done ? 'Unchecked.' : 'Done.');
}

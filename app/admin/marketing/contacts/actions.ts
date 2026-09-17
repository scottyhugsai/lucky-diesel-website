'use server';

import { revalidatePath } from 'next/cache';
import { fail, isUuid, ok, oneOf, str, type ActionState } from '@/components/admin/ops/form';
import { requireRole } from '@/lib/auth';
import { enrollCustomer } from '@/lib/marketing/core/campaigns';
import { recordConsent } from '@/lib/marketing/core/consent';
import { ensureReferralCode } from '@/lib/marketing/core/referrals';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const BASE = '/admin/marketing/contacts';
const TAG = /^[a-z0-9][a-z0-9 _-]{0,31}$/;
const MAX_TAGS = 30;

function refresh(id?: string) {
  revalidatePath(BASE);
  if (id) revalidatePath(`${BASE}/${id}`);
}

export async function saveTagsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('admin');
  const id = str(formData, 'id');
  if (!isUuid(id)) return fail('Unknown contact.');
  const tags = [...new Set(str(formData, 'tags').split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))];
  if (tags.length > MAX_TAGS) return fail(`At most ${MAX_TAGS} tags.`);
  const bad = tags.find((t) => !TAG.test(t));
  if (bad) return fail(`“${bad.slice(0, 32)}” isn’t a valid tag. Use letters, numbers, spaces or dashes.`);
  const supabase = await createClient();
  const { error } = await supabase.from('customers').update({ tags }).eq('id', id);
  if (error) return fail('Could not save tags.');
  refresh(id);
  return ok('Tags saved.');
}

export async function addToCampaignAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('admin');
  const id = str(formData, 'id');
  const campaignId = str(formData, 'campaign_id');
  if (!isUuid(id) || !isUuid(campaignId)) return fail('Pick a campaign.');
  const db = createAdminClient();
  const { data: campaign } = await db.from('campaigns').select('kind, status, name').eq('id', campaignId).maybeSingle();
  if (!campaign) return fail('Campaign not found.');
  if (campaign.kind === 'broadcast') return fail('Broadcasts go to segments. Pick a drip or lifecycle campaign.');
  if (campaign.status !== 'active') return fail('Start that campaign first.');
  const enrolled = await enrollCustomer(campaignId, id, new Date(), db);
  if (!enrolled) return fail('Already enrolled, or the campaign has no steps.');
  refresh(id);
  return ok(`Added to ${campaign.name}.`);
}

export async function referralCodeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('admin');
  const id = str(formData, 'id');
  if (!isUuid(id)) return fail('Unknown contact.');
  const result = await ensureReferralCode(id, createAdminClient());
  if (!result.ok) return fail(result.error);
  refresh(id);
  return ok(`Referral code: ${result.code}`);
}

export async function recordConsentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('admin');
  const id = str(formData, 'id');
  if (!isUuid(id)) return fail('Unknown contact.');
  const channel = oneOf(formData.get('channel'), ['sms', 'email'] as const);
  const action = oneOf(formData.get('action'), ['granted', 'revoked'] as const);
  if (!channel || !action) return fail('Pick a channel and a choice.');
  const note = str(formData, 'note').slice(0, 300);
  if (action === 'granted' && !note) return fail('Note how they agreed (required for opt-ins).');

  const db = createAdminClient();
  const { data: customer } = await db.from('customers').select('email, phone').eq('id', id).maybeSingle();
  const address = channel === 'sms' ? customer?.phone : customer?.email;
  if (!address) return fail(`No ${channel === 'sms' ? 'phone' : 'email'} on file.`);
  const result = await recordConsent(db, {
    customerId: id, channel, purpose: 'marketing', action, method: 'owner', address, consentTextVersion: action === 'granted' ? 'owner-recorded' : null,
    evidence: { text: note || null },
  });
  if (!result.ok) return fail(result.error ?? 'Could not record consent.');
  refresh(id);
  revalidatePath('/admin/marketing/settings');
  return ok(action === 'granted' ? 'Opt-in recorded.' : 'Opt-out recorded and suppressed.');
}

export async function moveLeadStageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('admin');
  const leadId = str(formData, 'lead_id');
  const stageId = str(formData, 'stage_id');
  if (!isUuid(leadId) || !isUuid(stageId)) return fail('Pick a stage.');
  const supabase = await createClient();
  const { data: stage } = await supabase.from('pipeline_stages').select('name, is_lost').eq('id', stageId).maybeSingle();
  if (!stage) return fail('Stage not found.');
  const lostReason = str(formData, 'lost_reason').slice(0, 120);
  if (stage.is_lost && !lostReason) return fail('Pick why it was lost.');
  const { error } = await supabase.from('leads').update({ pipeline_stage_id: stageId, lost_reason: stage.is_lost ? lostReason : null }).eq('id', leadId);
  if (error) return fail('Could not move the lead.');
  revalidatePath(`${BASE}/pipeline`);
  return ok(`Moved to ${stage.name}.`);
}

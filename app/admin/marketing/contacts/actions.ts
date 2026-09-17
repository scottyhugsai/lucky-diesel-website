'use server';

import { revalidatePath } from 'next/cache';
import { checked, fail, isUuid, ok, oneOf, str, type ActionState } from '@/components/admin/ops/form';
import { requireRole } from '@/lib/auth';
import { enrollCustomer } from '@/lib/marketing/core/campaigns';
import { recordConsent } from '@/lib/marketing/core/consent';
import { anonymizeContact } from '@/lib/marketing/core/contact-privacy';
import { TRUCK_USAGES } from '@/lib/marketing/core/segment-rules';
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

/** Truck usage and sold state, from the contact page. */
export async function saveTruckAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('admin');
  const id = str(formData, 'id');
  const vehicleId = str(formData, 'vehicle_id');
  if (!isUuid(id) || !isUuid(vehicleId)) return fail('Unknown truck.');
  const usage = TRUCK_USAGES.filter((u) => formData.getAll('usage').includes(u));
  const sold = checked(formData, 'sold');
  const supabase = await createClient();
  const { data: vehicle } = await supabase.from('vehicles').select('sold_at').eq('id', vehicleId).eq('customer_id', id).maybeSingle();
  if (!vehicle) return fail('Truck not found.');
  const soldAt = sold ? (vehicle.sold_at ?? new Date().toISOString()) : null;
  const { error } = await supabase.from('vehicles').update({ usage, sold_at: soldAt }).eq('id', vehicleId).eq('customer_id', id);
  if (error) return fail('Could not save the truck.');
  if (sold && !vehicle.sold_at) {
    // Clear the inbound-SMS flag once the owner has handled it.
    const { data: customer } = await supabase.from('customers').select('tags').eq('id', id).maybeSingle();
    if (customer?.tags.includes('truck-sold')) await supabase.from('customers').update({ tags: customer.tags.filter((t) => t !== 'truck-sold') }).eq('id', id);
  }
  refresh(id);
  return ok(sold ? 'Marked sold. Truck reminders stop.' : 'Truck saved.');
}

/** Data-deletion request: wipes personal data, keeps a redacted consent ledger. */
export async function anonymizeContactAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireRole('admin');
  const id = str(formData, 'id');
  if (!isUuid(id)) return fail('Unknown contact.');
  if (str(formData, 'confirm').toUpperCase() !== 'ERASE') return fail('Type ERASE to confirm.');
  const result = await anonymizeContact(createAdminClient(), id, viewer.userId);
  if (!result.ok) return fail(result.error);
  refresh(id);
  return ok('Personal data erased.');
}

/** Settings: one opt-out revokes every purpose on that address. */
export async function saveRevokeAllAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('admin');
  const on = checked(formData, 'revoke_all');
  const supabase = await createClient();
  const { error } = await supabase.from('marketing_settings').upsert({ id: 1, revoke_all_on_opt_out: on }, { onConflict: 'id' });
  if (error) return fail('Could not save.');
  revalidatePath('/admin/marketing/settings');
  return ok(on ? 'Revoke-all is on.' : 'Revoke-all is off.');
}

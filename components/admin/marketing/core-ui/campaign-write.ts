import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { CampaignDraft, StepDraft } from './campaign-input';

type Supabase = Awaited<ReturnType<typeof createClient>>;

const DEFAULT_EXIT = ['booked', 'replied', 'unsubscribed'];

export function utmSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'campaign';
}

export async function insertCampaign(supabase: Supabase, draft: CampaignDraft, userId: string): Promise<{ id: string } | { error: string }> {
  const { data, error } = await supabase
    .from('campaigns')
    .insert({
      name: draft.name, kind: draft.kind, channel: draft.channel, segment_id: draft.segmentId, trigger_event: draft.triggerEvent,
      send_window_start_hour: draft.windowStart, send_window_end_hour: draft.windowEnd,
      ab_test_percent: draft.abPercent, ab_winner_metric: draft.abMetric, ab_decide_after_minutes: draft.abDecideAfterMinutes,
      exit_on: draft.kind === 'broadcast' ? DEFAULT_EXIT : draft.exitOn, seasonal_key: draft.seasonalKey,
      utm_campaign: utmSlug(draft.name), created_by: userId,
    })
    .select('id')
    .single();
  if (error || !data) return { error: error?.message ?? 'Could not save the campaign.' };
  const steps = await replaceSteps(supabase, data.id, draft.steps);
  return 'error' in steps ? steps : { id: data.id };
}

export async function replaceSteps(supabase: Supabase, campaignId: string, steps: StepDraft[]): Promise<{ ok: true } | { error: string }> {
  const { error: deleteError } = await supabase.from('campaign_steps').delete().eq('campaign_id', campaignId);
  if (deleteError) return { error: deleteError.message };
  const { error } = await supabase.from('campaign_steps').insert(
    steps.map((s) => ({ campaign_id: campaignId, step_order: s.order, variant: s.variant, delay_minutes: s.delayMinutes, subject: s.subject || null, body: s.body })),
  );
  return error ? { error: error.message } : { ok: true };
}

/** A starter draft with one step, used by seasonal templates and the assistant. */
export async function insertStarterDraft(
  supabase: Supabase,
  input: { name: string; channel: 'email' | 'sms'; subject: string; body: string; seasonalKey: string | null; segmentId: string | null },
  userId: string,
): Promise<{ id: string } | { error: string }> {
  return insertCampaign(supabase, {
    name: input.name, kind: 'broadcast', channel: input.channel, segmentId: input.segmentId, triggerEvent: null,
    steps: [{ order: 1, variant: 'A', delayMinutes: 0, subject: input.channel === 'email' ? input.subject : '', body: input.body }],
    abPercent: 0, abMetric: 'click', abDecideAfterMinutes: 240, windowStart: 9, windowEnd: 20, exitOn: DEFAULT_EXIT, seasonalKey: input.seasonalKey,
  }, userId);
}

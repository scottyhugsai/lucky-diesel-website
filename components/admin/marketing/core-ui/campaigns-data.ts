import 'server-only';
import type { Tables } from '@/lib/db/database.types';
import { getCampaignReport, type CampaignVariantReport } from '@/lib/marketing/core/analytics';
import { getMarketingSettings, type MarketingSettings } from '@/lib/marketing/core/settings';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { toShopInputValue } from '@/components/admin/core/parse';

export interface CampaignListRow {
  campaign: Tables<'campaigns'>;
  segmentName: string | null;
  audience: number;
  delivered: number;
  clicked: number;
  converted: number;
  revenueCents: number;
}

export async function loadCampaignList(status: string): Promise<{ rows: CampaignListRow[]; error: string | null }> {
  const supabase = await createClient();
  let query = supabase.from('campaigns').select('*, segments(name, member_count)').order('updated_at', { ascending: false });
  query = status === 'archived' ? query.eq('status', 'archived') : query.neq('status', 'archived');
  if (status && status !== 'archived') query = query.eq('status', status as Tables<'campaigns'>['status']);
  const [{ data: campaigns, error }, { data: sends }, { data: enrollments }] = await Promise.all([
    query,
    supabase.from('campaign_sends').select('campaign_id, status, clicked_at, converted_at, revenue_cents'),
    supabase.from('campaign_enrollments').select('campaign_id'),
  ]);
  if (error) return { rows: [], error: error.message };

  const rows = (campaigns ?? []).map(({ segments, ...campaign }): CampaignListRow => {
    const mine = (sends ?? []).filter((s) => s.campaign_id === campaign.id);
    const enrolled = (enrollments ?? []).filter((e) => e.campaign_id === campaign.id).length;
    return {
      campaign,
      segmentName: segments?.name ?? null,
      audience: campaign.kind === 'broadcast' ? mine.length || segments?.member_count || 0 : enrolled,
      delivered: mine.filter((s) => s.status === 'sent' || s.status === 'simulated').length,
      clicked: mine.filter((s) => s.clicked_at).length,
      converted: mine.filter((s) => s.converted_at).length,
      revenueCents: mine.reduce((sum, s) => sum + s.revenue_cents, 0),
    };
  });
  return { rows, error: null };
}

export interface CampaignDetail {
  campaign: Tables<'campaigns'>;
  steps: Tables<'campaign_steps'>[];
  segment: { id: string; name: string; member_count: number } | null;
  report: CampaignVariantReport[];
  enrollments: { active: number; completed: number; exited: number };
  settings: MarketingSettings;
  segments: { id: string; name: string; member_count: number }[];
}

export async function loadCampaignDetail(id: string): Promise<CampaignDetail | null> {
  const supabase = await createClient();
  const { data: campaign } = await supabase.from('campaigns').select('*').eq('id', id).maybeSingle();
  if (!campaign) return null;
  const db = createAdminClient();
  const [{ data: steps }, { data: segments }, { data: enrollments }, report, settings] = await Promise.all([
    supabase.from('campaign_steps').select('*').eq('campaign_id', id).order('step_order').order('variant'),
    supabase.from('segments').select('id, name, member_count').order('name'),
    supabase.from('campaign_enrollments').select('status').eq('campaign_id', id),
    getCampaignReport(id, db).catch(() => []),
    getMarketingSettings(db),
  ]);
  const count = (s: string) => (enrollments ?? []).filter((e) => e.status === s).length;
  return {
    campaign,
    steps: steps ?? [],
    segment: (segments ?? []).find((s) => s.id === campaign.segment_id) ?? null,
    report,
    enrollments: { active: count('active'), completed: count('completed'), exited: count('exited') },
    settings,
    segments: segments ?? [],
  };
}

export async function loadSegmentsForPicker(): Promise<{ id: string; name: string; member_count: number }[]> {
  const supabase = await createClient();
  const { data } = await supabase.from('segments').select('id, name, member_count').order('member_count', { ascending: false });
  return data ?? [];
}

const HOUR_MS = 3_600_000;

/** `datetime-local` default in shop time: tomorrow at 10am, or `hoursAhead` from now. */
export function defaultSendAt(hoursAhead?: number): string {
  if (hoursAhead !== undefined) return toShopInputValue(new Date(Date.now() + hoursAhead * HOUR_MS).toISOString());
  return `${toShopInputValue(new Date(Date.now() + 24 * HOUR_MS).toISOString()).slice(0, 10)}T10:00`;
}

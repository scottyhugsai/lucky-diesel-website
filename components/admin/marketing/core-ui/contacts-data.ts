import 'server-only';
import { NO_ENGAGEMENT, withEngagement, type EngagementSignals } from '@/lib/marketing/core/engagement';
import { DEFAULT_PIPELINE, type PipelineId } from '@/lib/marketing/core/pipelines';
import { ensurePipelineStages, loadEngagementSignals } from '@/lib/marketing/core/crm-data';
import { visitRhythm } from '@/lib/marketing/core/scoring';
import { predictWin, trainWinModel, winLossReport, type OutcomeLead, type WinLossReport } from '@/lib/marketing/core/win-model';
import { SERVICES } from '@/lib/site';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { sourceLabel } from './labels';

/** Service label for a stored service id. */
function serviceLabel(id: string | null): string {
  return SERVICES.find((s) => s.id === id)?.name ?? 'Other';
}

export interface ContactRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  stage: string;
  score: number;
  tags: string[];
  sms: 'yes' | 'no' | 'out';
  email_ok: boolean;
  source: string;
  ltvCents: number;
  lastPaidAt: string | null;
  isFleet: boolean;
  /** Overdue beyond 1.5× their usual visit gap. */
  atRisk: boolean;
  overdueRatio: number | null;
}

export interface ContactFilters {
  q: string;
  stage: string;
  consent: string;
  tag: string;
}

const LIMIT = 300;

export async function loadContacts(filters: ContactFilters): Promise<{ rows: ContactRow[]; total: number; tags: string[]; error: string | null }> {
  const supabase = await createClient();
  const [customers, invoices] = await Promise.all([
    supabase.from('customers').select('id, full_name, email, phone, tags, lifecycle_stage, lead_score, source, first_touch_source, last_touch_source, is_fleet, email_marketing_status, sms_marketing_consent_at, sms_marketing_opted_out_at, sms_opted_out_at').is('anonymized_at', null).order('lead_score', { ascending: false }).limit(2000),
    supabase.from('invoices').select('customer_id, total_cents, paid_at').eq('status', 'paid'),
  ]);
  if (customers.error) return { rows: [], total: 0, tags: [], error: customers.error.message };

  const ltv = new Map<string, { cents: number; last: string | null; visits: Date[] }>();
  for (const inv of invoices.data ?? []) {
    const entry = ltv.get(inv.customer_id) ?? { cents: 0, last: null, visits: [] };
    ltv.set(inv.customer_id, {
      cents: entry.cents + inv.total_cents, last: !entry.last || (inv.paid_at ?? '') > entry.last ? inv.paid_at : entry.last,
      visits: inv.paid_at ? [...entry.visits, new Date(inv.paid_at)] : entry.visits,
    });
  }
  const now = new Date();

  const all: ContactRow[] = (customers.data ?? []).map((c) => {
    const rhythm = visitRhythm(ltv.get(c.id)?.visits ?? [], now);
    return {
      id: c.id, name: c.full_name, email: c.email, phone: c.phone, stage: c.lifecycle_stage, score: c.lead_score, tags: c.tags,
      sms: c.sms_opted_out_at || c.sms_marketing_opted_out_at ? 'out' : c.sms_marketing_consent_at ? 'yes' : 'no',
      email_ok: Boolean(c.email) && c.email_marketing_status === 'subscribed',
      source: c.first_touch_source ?? c.last_touch_source ?? c.source,
      ltvCents: ltv.get(c.id)?.cents ?? 0, lastPaidAt: ltv.get(c.id)?.last ?? null, isFleet: c.is_fleet,
      atRisk: rhythm.atRisk, overdueRatio: rhythm.overdueRatio,
    };
  });

  const q = filters.q.toLowerCase();
  const digits = q.replace(/\D/g, '');
  const rows = all.filter((c) => {
    if (filters.stage === 'at_risk' ? !c.atRisk : filters.stage && c.stage !== filters.stage) return false;
    if (filters.tag && !c.tags.includes(filters.tag)) return false;
    if (filters.consent === 'sms' && c.sms !== 'yes') return false;
    if (filters.consent === 'email' && !c.email_ok) return false;
    if (filters.consent === 'none' && (c.sms === 'yes' || c.email_ok)) return false;
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || (c.email ?? '').toLowerCase().includes(q) || c.tags.some((t) => t.includes(q))
      || (digits.length >= 3 && (c.phone ?? '').replace(/\D/g, '').includes(digits));
  });
  const tags = [...new Set(all.flatMap((c) => c.tags))].sort();
  return { rows: rows.slice(0, LIMIT), total: rows.length, tags, error: null };
}

export interface PipelineCard {
  id: string;
  name: string;
  service: string | null;
  platform: string | null;
  score: number;
  createdAt: string;
  stageId: string | null;
  source: string;
  dealValueCents: number;
  /** 0–1 from the trained model, or null until there are enough outcomes. */
  winChance: number | null;
  engagement: EngagementSignals;
}

export interface PipelineData {
  pipeline: PipelineId;
  stages: { id: string; key: string; name: string; weight: number; isWon: boolean; isLost: boolean }[];
  cards: PipelineCard[];
  report: WinLossReport;
}

export async function loadPipeline(pipeline: PipelineId = DEFAULT_PIPELINE): Promise<PipelineData> {
  const db = createAdminClient();
  const [stageRows, leads] = await Promise.all([
    ensurePipelineStages(db, pipeline),
    db.from('leads')
      .select('id, full_name, service_id, service_label, platform, platform_label, lead_score, created_at, contacted_at, pipeline_stage_id, source, status, lost_reason, deal_value_cents')
      .order('lead_score', { ascending: false })
      .limit(400),
  ]);
  const stageById = new Map(stageRows.map((s) => [s.id, s]));
  const rows = leads.data ?? [];
  const signals = await loadEngagementSignals(db, new Date());

  const outcomes: OutcomeLead[] = rows.map((l) => ({
    status: stageById.get(l.pipeline_stage_id ?? '')?.isWon ? 'won' : stageById.get(l.pipeline_stage_id ?? '')?.isLost ? 'lost' : l.status,
    source: l.source,
    serviceId: l.service_id,
    platform: l.platform,
    lostReason: l.lost_reason,
    stageName: stageById.get(l.pipeline_stage_id ?? '')?.name ?? null,
    dealValueCents: l.deal_value_cents,
    createdAt: new Date(l.created_at),
    contactedAt: l.contacted_at ? new Date(l.contacted_at) : null,
  }));
  const model = trainWinModel(outcomes);

  return {
    pipeline,
    stages: stageRows.map((s) => ({ id: s.id, key: s.key, name: s.name, weight: s.weight, isWon: s.isWon, isLost: s.isLost })),
    cards: rows.map((l) => {
      const engagement = signals.get(l.id) ?? NO_ENGAGEMENT;
      return {
        id: l.id,
        name: l.full_name,
        service: l.service_label,
        platform: l.platform_label,
        score: withEngagement(l.lead_score, l.status, engagement),
        createdAt: l.created_at,
        stageId: l.pipeline_stage_id,
        source: l.source,
        dealValueCents: l.deal_value_cents,
        winChance: predictWin(model, { source: l.source, serviceId: l.service_id, platform: l.platform }),
        engagement,
      };
    }),
    report: winLossReport(outcomes, { service: (id) => serviceLabel(id), source: (s) => sourceLabel(s) }),
  };
}

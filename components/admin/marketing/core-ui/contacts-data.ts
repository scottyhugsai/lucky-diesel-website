import 'server-only';
import { createClient } from '@/lib/supabase/server';

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
    supabase.from('customers').select('id, full_name, email, phone, tags, lifecycle_stage, lead_score, source, first_touch_source, last_touch_source, is_fleet, email_marketing_status, sms_marketing_consent_at, sms_marketing_opted_out_at, sms_opted_out_at').order('lead_score', { ascending: false }).limit(2000),
    supabase.from('invoices').select('customer_id, total_cents, paid_at').eq('status', 'paid'),
  ]);
  if (customers.error) return { rows: [], total: 0, tags: [], error: customers.error.message };

  const ltv = new Map<string, { cents: number; last: string | null }>();
  for (const inv of invoices.data ?? []) {
    const entry = ltv.get(inv.customer_id) ?? { cents: 0, last: null };
    ltv.set(inv.customer_id, { cents: entry.cents + inv.total_cents, last: !entry.last || (inv.paid_at ?? '') > entry.last ? inv.paid_at : entry.last });
  }

  const all: ContactRow[] = (customers.data ?? []).map((c) => ({
    id: c.id, name: c.full_name, email: c.email, phone: c.phone, stage: c.lifecycle_stage, score: c.lead_score, tags: c.tags,
    sms: c.sms_opted_out_at || c.sms_marketing_opted_out_at ? 'out' : c.sms_marketing_consent_at ? 'yes' : 'no',
    email_ok: Boolean(c.email) && c.email_marketing_status === 'subscribed',
    source: c.first_touch_source ?? c.last_touch_source ?? c.source,
    ltvCents: ltv.get(c.id)?.cents ?? 0, lastPaidAt: ltv.get(c.id)?.last ?? null, isFleet: c.is_fleet,
  }));

  const q = filters.q.toLowerCase();
  const digits = q.replace(/\D/g, '');
  const rows = all.filter((c) => {
    if (filters.stage && c.stage !== filters.stage) return false;
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
}

export async function loadPipeline(): Promise<{ stages: { id: string; key: string; name: string; weight: number; isWon: boolean; isLost: boolean }[]; cards: PipelineCard[] }> {
  const supabase = await createClient();
  const [stages, leads] = await Promise.all([
    supabase.from('pipeline_stages').select('id, key, name, sort, score_weight, is_won, is_lost').eq('pipeline', 'leads').order('sort'),
    supabase.from('leads').select('id, full_name, service_label, platform_label, lead_score, created_at, pipeline_stage_id, source, status').order('lead_score', { ascending: false }).limit(300),
  ]);
  return {
    stages: (stages.data ?? []).map((s) => ({ id: s.id, key: s.key, name: s.name, weight: s.score_weight, isWon: s.is_won, isLost: s.is_lost })),
    cards: (leads.data ?? []).map((l) => ({
      id: l.id, name: l.full_name, service: l.service_label, platform: l.platform_label, score: l.lead_score, createdAt: l.created_at, stageId: l.pipeline_stage_id, source: l.source,
    })),
  };
}

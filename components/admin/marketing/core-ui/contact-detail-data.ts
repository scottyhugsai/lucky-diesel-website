import 'server-only';
import type { Tables } from '@/lib/db/database.types';
import { visitRhythm, type VisitRhythm } from '@/lib/marketing/core/scoring';
import { createClient } from '@/lib/supabase/server';

export type TimelineKind = 'touch' | 'message' | 'campaign' | 'conversion' | 'consent';

export interface TimelineEntry {
  id: string;
  kind: TimelineKind;
  at: string;
  title: string;
  detail: string | null;
  tone: 'neutral' | 'good' | 'warn' | 'bad' | 'info';
}

export interface ContactDetail {
  customer: Tables<'customers'>;
  timeline: TimelineEntry[];
  consent: Tables<'contact_consent_events'>[];
  referral: { code: string; uses: number } | null;
  referrals: number;
  ltvCents: number;
  paidVisits: number;
  campaigns: { id: string; name: string; kind: string; status: string }[];
  enrolledIds: string[];
  segments: { id: string; name: string }[];
  trucks: Pick<Tables<'vehicles'>, 'id' | 'year' | 'make' | 'model' | 'nickname' | 'platform' | 'usage' | 'sold_at'>[];
  rhythm: VisitRhythm;
}

const CONVERSION_LABEL: Record<string, string> = { lead: 'Became a lead', booking: 'Booked', job_paid: 'Paid a job', store_checkout_click: 'Store checkout click' };

export async function loadContactDetail(id: string): Promise<ContactDetail | null> {
  const supabase = await createClient();
  const { data: customer } = await supabase.from('customers').select('*').eq('id', id).maybeSingle();
  if (!customer) return null;

  const [touches, messages, sends, conversions, consent, referral, referrals, invoices, campaigns, enrollments, members, trucks] = await Promise.all([
    supabase.from('attribution_touches').select('id, source, medium, campaign, landing_path, touch_type, occurred_at').eq('customer_id', id).order('occurred_at', { ascending: false }).limit(50),
    supabase.from('messages').select('id, channel, direction, subject, body, status, created_at').eq('customer_id', id).order('created_at', { ascending: false }).limit(50),
    supabase.from('campaign_sends').select('id, status, variant, step_order, clicked_at, converted_at, sent_at, scheduled_for, campaigns(name)').eq('customer_id', id).order('scheduled_for', { ascending: false }).limit(50),
    supabase.from('conversion_events').select('id, kind, source, value_cents, occurred_at').eq('customer_id', id).order('occurred_at', { ascending: false }).limit(50),
    supabase.from('contact_consent_events').select('*').eq('customer_id', id).order('created_at', { ascending: false }).limit(100),
    supabase.from('referral_codes').select('code, uses').eq('customer_id', id).maybeSingle(),
    supabase.from('referrals').select('id', { count: 'exact', head: true }).eq('referrer_customer_id', id),
    supabase.from('invoices').select('total_cents, paid_at').eq('customer_id', id).eq('status', 'paid'),
    supabase.from('campaigns').select('id, name, kind, status').in('status', ['draft', 'active', 'paused', 'scheduled']).order('created_at', { ascending: false }),
    supabase.from('campaign_enrollments').select('campaign_id').eq('customer_id', id),
    supabase.from('segment_members').select('segments(id, name)').eq('customer_id', id),
    supabase.from('vehicles').select('id, year, make, model, nickname, platform, usage, sold_at').eq('customer_id', id).order('created_at'),
  ]);

  const timeline: TimelineEntry[] = [
    ...(touches.data ?? []).map((t): TimelineEntry => ({
      id: `t-${t.id}`, kind: 'touch', at: t.occurred_at, tone: 'info',
      title: `Visited from ${t.source}${t.campaign ? ` · ${t.campaign}` : ''}`, detail: t.landing_path,
    })),
    ...(messages.data ?? []).map((m): TimelineEntry => ({
      id: `m-${m.id}`, kind: 'message', at: m.created_at, tone: m.status === 'failed' ? 'bad' : m.status === 'skipped' ? 'warn' : 'neutral',
      title: `${m.direction === 'inbound' ? 'Replied by' : 'Sent'} ${m.channel === 'sms' ? 'text' : 'email'} · ${m.status}`,
      detail: (m.subject ?? m.body).slice(0, 140),
    })),
    ...(sends.data ?? []).map((s): TimelineEntry => ({
      id: `s-${s.id}`, kind: 'campaign', at: s.sent_at ?? s.scheduled_for, tone: s.converted_at ? 'good' : s.status === 'skipped' ? 'warn' : 'neutral',
      title: `${s.campaigns?.name ?? 'Campaign'} · step ${s.step_order}${s.variant ? ` ${s.variant}` : ''}`,
      detail: [s.status, s.clicked_at ? 'clicked' : null, s.converted_at ? 'converted' : null].filter(Boolean).join(' · '),
    })),
    ...(conversions.data ?? []).map((c): TimelineEntry => ({
      id: `c-${c.id}`, kind: 'conversion', at: c.occurred_at, tone: 'good',
      title: CONVERSION_LABEL[c.kind] ?? c.kind, detail: `${c.source}${c.value_cents ? ` · $${Math.round(c.value_cents / 100).toLocaleString('en-US')}` : ''}`,
    })),
    ...(consent.data ?? []).map((e): TimelineEntry => ({
      id: `k-${e.id}`, kind: 'consent', at: e.created_at, tone: e.action === 'granted' ? 'good' : 'bad',
      title: `${e.channel === 'sms' ? 'SMS' : 'Email'} ${e.purpose} ${e.action}`, detail: e.method,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return {
    customer,
    timeline,
    consent: consent.data ?? [],
    referral: referral.data ?? null,
    referrals: referrals.count ?? 0,
    ltvCents: (invoices.data ?? []).reduce((sum, i) => sum + i.total_cents, 0),
    paidVisits: invoices.data?.length ?? 0,
    campaigns: campaigns.data ?? [],
    enrolledIds: (enrollments.data ?? []).map((e) => e.campaign_id),
    segments: (members.data ?? []).flatMap((m) => (m.segments ? [m.segments] : [])),
    trucks: trucks.data ?? [],
    rhythm: visitRhythm((invoices.data ?? []).flatMap((i) => (i.paid_at ? [new Date(i.paid_at)] : [])), new Date()),
  };
}

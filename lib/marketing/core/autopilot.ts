import 'server-only';
import type { Json, TablesInsert } from '@/lib/db/database.types';
import { sendMessage } from '@/lib/messaging/send';
import { BUSINESS } from '@/lib/site';
import { createAdminClient } from '@/lib/supabase/admin';
import { recordConsent } from './consent';
import type { EmailBlock } from './email-blocks';
import { preferencesUrl, unsubscribeUrl } from './gate';
import { getMarketingSettings, type Db } from './settings';
import { newsletterKey, sunsetStep, type SunsetFacts } from './topics';

const CANDIDATES = 500;
const MAX_NOTICES = 50;
const MAX_ROWS = 5000;
const MARKETING_KEYS = 'automation_key.like.mkt_*,automation_key.like."campaign:*"';

// ─── Monthly newsletter autopilot ───────────────────────────────────────────

export interface NewsletterResult {
  key: string;
  created: boolean;
  reason?: string;
}

/** Shop-local date parts, so "first Tuesday" means the owner's Tuesday. */
function localParts(now: Date, timeZone: string): { day: number; weekday: string; month: string } {
  const parts = new Intl.DateTimeFormat('en-US', { day: 'numeric', weekday: 'short', month: 'long', timeZone }).formatToParts(now);
  const read = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return { day: Number(read('day')), weekday: read('weekday'), month: read('month') };
}

export function isFirstTuesday(now: Date, timeZone: string): boolean {
  const { day, weekday } = localParts(now, timeZone);
  return weekday === 'Tue' && day <= 7;
}

/**
 * On the first Tuesday of the month, drafts the newsletter from the newest
 * builds, upcoming events and the live offer. It lands as a draft in
 * /admin/marketing/campaigns — nothing sends until the owner schedules it.
 */
export async function draftMonthlyNewsletter(now = new Date(), db: Db = createAdminClient()): Promise<NewsletterResult> {
  const settings = await getMarketingSettings(db);
  const key = newsletterKey(now, settings.timeZone);
  if (!settings.newsletterAutopilot) return { key, created: false, reason: 'autopilot off' };
  if (!isFirstTuesday(now, settings.timeZone)) return { key, created: false, reason: 'not the first Tuesday' };

  const { data: existing } = await db.from('campaigns').select('id').eq('autopilot_key', key).limit(1);
  if (existing?.length) return { key, created: false, reason: 'already drafted' };

  const [builds, events, offers, segment] = await Promise.all([
    db.from('builds').select('slug, title').eq('published', true).eq('is_sample', false).order('created_at', { ascending: false }).limit(2),
    db.from('events').select('name, starts_at, slug').eq('published', true).gte('starts_at', now.toISOString()).order('starts_at').limit(2),
    db.from('offers').select('id, name').eq('active', true).eq('public', true).order('created_at', { ascending: false }).limit(1),
    db.from('segments').select('id').order('member_count', { ascending: false }).limit(1).maybeSingle(),
  ]);

  const month = localParts(now, settings.timeZone).month;
  const offer = offers.data?.[0] ?? null;
  const dayLabel = (iso: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: settings.timeZone }).format(new Date(iso));
  const blocks: EmailBlock[] = [
    ...(builds.data ?? []).map((b): EmailBlock => ({ type: 'build', slug: b.slug })),
    ...((events.data ?? []).length
      ? [{ type: 'heading' as const, text: 'On the calendar' }, { type: 'text' as const, text: (events.data ?? []).map((e) => `${dayLabel(e.starts_at)} — ${e.name}`).join('\n') }]
      : []),
    ...(offer ? [{ type: 'offer' as const }] : []),
    { type: 'button', label: 'Book a bay', url: '{{link}}' },
  ];

  const insert: TablesInsert<'campaigns'> = {
    name: `Newsletter — ${month} ${new Date(now).getUTCFullYear()}`,
    kind: 'broadcast', channel: 'email', status: 'draft', topic: 'newsletter', autopilot_key: key,
    segment_id: segment.data?.id ?? null, offer_id: offer?.id ?? null,
    send_window_start_hour: 9, send_window_end_hour: 20, utm_campaign: key,
  };
  const { data: campaign, error } = await db.from('campaigns').insert(insert).select('id').single();
  if (error || !campaign) return { key, created: false, reason: error?.message ?? 'insert failed' };

  const { error: stepError } = await db.from('campaign_steps').insert({
    campaign_id: campaign.id, step_order: 1, variant: 'A', delay_minutes: 0,
    subject: `What rolled through the shop in ${month}`,
    body: `Hey {{first_name}},\n\nHere's what we've been building this month${offer ? ', plus a code you can use' : ''}.`,
    blocks: blocks as unknown as Json,
  });
  if (stepError) return { key, created: false, reason: stepError.message };
  return { key, created: true };
}

// ─── Engagement sunset ──────────────────────────────────────────────────────

export interface SunsetSummary { checked: number; noticed: number; suppressed: number; reset: number }

const latest = (current: Date | null, candidate: string | null | undefined): Date | null => {
  if (!candidate) return current;
  const at = new Date(candidate);
  return !current || at > current ? at : current;
};

async function sunsetFacts(db: Db, ids: string[], notices: Map<string, string | null>): Promise<Map<string, SunsetFacts>> {
  const [inbound, sends, bookings] = await Promise.all([
    db.from('messages').select('customer_id, created_at').in('customer_id', ids).eq('direction', 'inbound').order('created_at', { ascending: false }).limit(MAX_ROWS),
    db.from('campaign_sends').select('customer_id, opened_at, clicked_at').in('customer_id', ids).or('opened_at.not.is.null,clicked_at.not.is.null').limit(MAX_ROWS),
    db.from('appointments').select('customer_id, created_at').in('customer_id', ids).limit(MAX_ROWS),
  ]);
  const facts = new Map<string, SunsetFacts>(ids.map((id) => [id, { firstMailedAt: null, lastEngagedAt: null, noticeAt: notices.get(id) ? new Date(notices.get(id)!) : null }]));
  const marketingEmails = await db.from('messages').select('customer_id, created_at').in('customer_id', ids)
    .eq('channel', 'email').eq('direction', 'outbound').in('status', ['sent', 'simulated']).or(MARKETING_KEYS).order('created_at').limit(MAX_ROWS);
  for (const row of marketingEmails.data ?? []) {
    const fact = row.customer_id ? facts.get(row.customer_id) : undefined;
    if (fact && !fact.firstMailedAt) fact.firstMailedAt = new Date(row.created_at);
  }
  for (const row of inbound.data ?? []) {
    const fact = row.customer_id ? facts.get(row.customer_id) : undefined;
    if (fact) fact.lastEngagedAt = latest(fact.lastEngagedAt, row.created_at);
  }
  for (const row of sends.data ?? []) {
    const fact = row.customer_id ? facts.get(row.customer_id) : undefined;
    if (fact) fact.lastEngagedAt = latest(latest(fact.lastEngagedAt, row.opened_at), row.clicked_at);
  }
  for (const row of bookings.data ?? []) {
    const fact = row.customer_id ? facts.get(row.customer_id) : undefined;
    if (fact) fact.lastEngagedAt = latest(fact.lastEngagedAt, row.created_at);
  }
  return facts;
}

/**
 * Stops mailing people who never engage: one "still want these?" email, then a
 * marketing suppression if they stay quiet. Any open, click, reply or booking
 * after the notice clears it. `sunset_days = 0` turns it off.
 */
export async function runEngagementSunset(now = new Date(), db: Db = createAdminClient()): Promise<SunsetSummary> {
  const summary: SunsetSummary = { checked: 0, noticed: 0, suppressed: 0, reset: 0 };
  const settings = await getMarketingSettings(db);
  if (settings.sunsetDays <= 0) return summary;

  const { data: customers } = await db.from('customers')
    .select('id, full_name, email, sunset_notice_at')
    .eq('email_marketing_status', 'subscribed').not('email', 'is', null).limit(CANDIDATES);
  if (!customers?.length) return summary;
  summary.checked = customers.length;

  const facts = await sunsetFacts(db, customers.map((c) => c.id), new Map(customers.map((c) => [c.id, c.sunset_notice_at])));
  for (const customer of customers) {
    const fact = facts.get(customer.id);
    if (!fact || !customer.email) continue;
    const step = sunsetStep(fact, now, settings.sunsetDays);
    if (step === 'reset') {
      await db.from('customers').update({ sunset_notice_at: null }).eq('id', customer.id);
      summary.reset += 1;
      continue;
    }
    if (step === 'suppress') {
      await recordConsent(db, {
        customerId: customer.id, channel: 'email', purpose: 'marketing', action: 'revoked', method: 'sunset', address: customer.email,
        evidence: { text: `No engagement in ${settings.sunsetDays} days` },
      });
      await db.from('customers').update({ sunset_notice_at: null }).eq('id', customer.id);
      summary.suppressed += 1;
      continue;
    }
    if (step !== 'notice' || summary.noticed >= MAX_NOTICES) continue;
    const result = await sendMessage({
      channel: 'email', to: customer.email, customerId: customer.id, purpose: 'marketing', automationKey: 'mkt_sunset_check',
      subject: 'Still want diesel tips from us?',
      body: `Hey there,\n\nWe haven't heard from you in a while, so we'll stop emailing unless you tell us otherwise.\n\nKeep them coming: ${preferencesUrl(customer.email, customer.id)}\n\nStop for good: ${unsubscribeUrl('email', customer.email, customer.id)}\n\n— ${BUSINESS.name}`,
    });
    if (result.status === 'sent' || result.status === 'simulated') {
      await db.from('customers').update({ sunset_notice_at: now.toISOString() }).eq('id', customer.id);
      summary.noticed += 1;
    }
  }
  return summary;
}

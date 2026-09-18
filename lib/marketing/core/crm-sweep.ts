import 'server-only';
import { ownerContacts, sendContentMessage, sendContentMessageToOwners, type ContentRecipient } from '@/lib/marketing/content/alerts';
import { dateOnly, firstName, vehicleLabel } from '@/lib/format';
import { siteUrl } from '@/lib/site-url';
import { createAdminClient } from '@/lib/supabase/admin';
import { allStages, getCrmSettings, staffAddresses } from './crm-data';
import { DEFAULT_PIPELINE } from './pipelines';
import { messagesByThread, toThreadMessage, type InboxMessage } from './inbox';
import type { Db } from './settings';
import { isStale, isUnanswered, lostNurtureDue, minutesWaiting, quoteNudgeDue, slaLevel, SLA_LOOKBACK_MS } from './speed';

/**
 * Speed-to-lead sweep: SLA escalation, unanswered texts, snoozes coming due,
 * hot leads, stale deals, quote expiry nudges and lost-reason nurture.
 * Every alert is claimed once in `crm_alerts`, so running often is safe.
 * Runs with the marketing cron and whenever the owner opens Inbox, Tasks or Pipeline.
 */

const DAY_MS = 86_400_000;
const CONTACTS = '/admin/marketing/contacts';

/** Lead status → stage key. Statuses the owner drives by hand are left alone. */
const STATUS_STAGE_KEY: Record<string, string | undefined> = { booked: 'booked', won: 'won', lost: 'lost' };

export interface CrmSweepReport {
  sla: number;
  stageMoves: number;
  unanswered: number;
  followUps: number;
  hot: number;
  stale: number;
  quoteNudges: number;
  nurture: number;
}

/** True the first time a kind + subject is claimed. */
export async function claimAlert(db: Db, kind: string, subjectKey: string, detail?: string): Promise<boolean> {
  const { data, error } = await db.from('crm_alerts')
    .upsert({ kind, subject_key: subjectKey.slice(0, 400), detail: detail?.slice(0, 300) ?? null }, { onConflict: 'kind,subject_key', ignoreDuplicates: true })
    .select('id');
  if (error) {
    console.error(`[crm] could not claim ${kind}: ${error.message}`);
    return false;
  }
  return Boolean(data?.length);
}

function leadLink(id: string): string {
  return `${siteUrl()}${CONTACTS}/pipeline/${id}`;
}

async function slaAlerts(db: Db, now: Date, owners: ContentRecipient[]): Promise<number> {
  const settings = await getCrmSettings(db);
  const { data: leads } = await db.from('leads').select('id, full_name, phone, service_label, platform_label, status, created_at, contacted_at')
    .eq('status', 'new').is('contacted_at', null).gte('created_at', new Date(now.getTime() - SLA_LOOKBACK_MS).toISOString()).limit(200);
  const backup: ContentRecipient = settings.backupPhone || settings.backupEmail
    ? { phone: settings.backupPhone, email: settings.backupEmail, customerId: null, isCustomer: false }
    : owners[0]!;
  let sent = 0;
  for (const lead of leads ?? []) {
    const level = slaLevel({ status: lead.status, createdAt: new Date(lead.created_at), contactedAt: null }, now, settings);
    const vars = { customer_name: lead.full_name, customer_phone: lead.phone, service: lead.service_label ?? 'service', vehicle: lead.platform_label ?? 'truck', minutes: minutesWaiting(new Date(lead.created_at), now), admin_link: leadLink(lead.id) };
    if (level >= 1 && (await claimAlert(db, 'sla_owner', lead.id))) {
      sent += (await sendContentMessageToOwners(db, 'crm_sla_alert', vars, owners)).sent;
    }
    if (level >= 2 && (await claimAlert(db, 'sla_backup', lead.id))) {
      sent += (await sendContentMessage(db, 'crm_sla_backup_alert', backup, vars)).sent;
    }
  }
  return sent;
}

async function unansweredAlerts(db: Db, now: Date, owners: ContentRecipient[], hours: number): Promise<number> {
  const since = new Date(now.getTime() - 7 * DAY_MS).toISOString();
  const [{ data: rows }, staff, { data: states }] = await Promise.all([
    db.from('messages').select('id, channel, direction, to_address, body, subject, status, automation_key, customer_id, created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(1500),
    staffAddresses(db),
    db.from('inbox_threads').select('channel, address, snoozed_until, closed_at'),
  ]);
  const messages: InboxMessage[] = (rows ?? []).map((m) => ({ id: m.id, channel: m.channel, direction: m.direction, address: m.to_address, body: m.body, subject: m.subject, status: m.status, automationKey: m.automation_key, customerId: m.customer_id, createdAt: m.created_at }));
  const muted = new Set((states ?? []).filter((s) => s.closed_at || (s.snoozed_until && Date.parse(s.snoozed_until) > now.getTime())).map((s) => `${s.channel}:${s.address}`));
  let sent = 0;
  for (const [key, list] of messagesByThread(messages, staff)) {
    if (muted.has(key) || !isUnanswered(list.map(toThreadMessage), now, hours)) continue;
    const lastInbound = list.findLast((m) => m.direction === 'inbound');
    if (!lastInbound || !(await claimAlert(db, 'unanswered', `${key}:${lastInbound.id}`))) continue;
    const name = (lastInbound.customerId && (await db.from('customers').select('full_name').eq('id', lastInbound.customerId).maybeSingle()).data?.full_name) || key.slice(key.indexOf(':') + 1);
    const vars = { customer_name: name, preview: lastInbound.body.replace(/\s+/g, ' ').slice(0, 80), hours, admin_link: `${siteUrl()}${CONTACTS}/inbox?t=${encodeURIComponent(key)}` };
    sent += (await sendContentMessageToOwners(db, 'crm_unanswered_alert', vars, owners)).sent;
  }
  return sent;
}

async function leadAlerts(db: Db, now: Date, owners: ContentRecipient[]): Promise<{ followUps: number; hot: number; stale: number }> {
  const settings = await getCrmSettings(db);
  const { data: leads } = await db.from('leads').select('id, full_name, phone, service_label, platform_label, status, lead_score, created_at, last_activity_at, snoozed_until')
    .in('status', ['new', 'contacted', 'booked']).gte('created_at', new Date(now.getTime() - 120 * DAY_MS).toISOString()).limit(1000);
  const result = { followUps: 0, hot: 0, stale: 0 };
  const staleNames: string[] = [];
  for (const lead of leads ?? []) {
    const vars = { customer_name: lead.full_name, customer_phone: lead.phone, service: lead.service_label ?? 'service', vehicle: lead.platform_label ?? 'truck', score: lead.lead_score, admin_link: leadLink(lead.id) };
    const snoozed = lead.snoozed_until ? new Date(lead.snoozed_until) : null;
    if (snoozed && snoozed.getTime() <= now.getTime() && now.getTime() - snoozed.getTime() < DAY_MS && (await claimAlert(db, 'follow_up_due', `${lead.id}:${lead.snoozed_until}`))) {
      result.followUps += (await sendContentMessageToOwners(db, 'crm_follow_up_due', vars, owners)).sent;
    }
    if (lead.status !== 'booked' && lead.lead_score >= settings.hotScore && now.getTime() - Date.parse(lead.created_at) < 14 * DAY_MS && (await claimAlert(db, 'hot_lead', lead.id))) {
      result.hot += (await sendContentMessageToOwners(db, 'crm_hot_lead_alert', vars, owners)).sent;
    }
    if (isStale({ status: lead.status, lastActivityAt: new Date(lead.last_activity_at), snoozedUntil: snoozed }, now, settings.staleHours) && (await claimAlert(db, 'stale', `${lead.id}:${lead.last_activity_at}`))) {
      staleNames.push(lead.full_name);
    }
  }
  if (staleNames.length) {
    const vars = { count: staleNames.length, names: staleNames.slice(0, 15).join(', '), hours: settings.staleHours, admin_link: `${siteUrl()}${CONTACTS}/tasks` };
    result.stale = (await sendContentMessageToOwners(db, 'crm_stale_deals_digest', vars, owners)).sent;
  }
  return result;
}

async function quoteNudges(db: Db, now: Date, nudgeDays: number): Promise<number> {
  const { data: jobs } = await db.from('work_orders').select('id, estimate_expires_at, customers(id, full_name, phone, email), vehicles(year, make, model, engine_code, nickname)')
    .eq('status', 'awaiting_approval').not('estimate_expires_at', 'is', null).gt('estimate_expires_at', now.toISOString()).limit(200);
  let sent = 0;
  for (const job of jobs ?? []) {
    const expires = new Date(job.estimate_expires_at!);
    if (!job.customers || !quoteNudgeDue(expires, now, nudgeDays) || !(await claimAlert(db, 'quote_nudge', job.id))) continue;
    const recipient: ContentRecipient = { phone: job.customers.phone, email: job.customers.email, customerId: job.customers.id, isCustomer: true };
    const vars = { first_name: firstName(job.customers.full_name), vehicle: vehicleLabel(job.vehicles), expires: dateOnly(expires), approval_link: `${siteUrl()}/portal/jobs/${job.id}` };
    sent += (await sendContentMessage(db, 'crm_quote_expiry_nudge', recipient, vars)).sent;
  }
  return sent;
}

async function lostNurture(db: Db, now: Date): Promise<number> {
  const { data: leads } = await db.from('leads').select('id, customer_id, full_name, phone, email, service_label, platform_label, lost_reason, last_activity_at')
    .eq('status', 'lost').not('lost_reason', 'is', null).not('customer_id', 'is', null).gte('last_activity_at', new Date(now.getTime() - 100 * DAY_MS).toISOString()).limit(500);
  let sent = 0;
  for (const lead of leads ?? []) {
    const key = lostNurtureDue(lead.lost_reason, new Date(lead.last_activity_at), now);
    if (!key || !(await claimAlert(db, 'lost_nurture', `${lead.id}:${key}`))) continue;
    const recipient: ContentRecipient = { phone: lead.phone, email: lead.email, customerId: lead.customer_id, isCustomer: true };
    sent += (await sendContentMessage(db, key, recipient, { first_name: firstName(lead.full_name), service: (lead.service_label ?? 'service').toLowerCase(), vehicle: lead.platform_label ?? 'your truck' })).sent;
  }
  return sent;
}

/**
 * Keeps the board honest: a lead whose status moved on (booked, won, lost) is
 * moved to the matching stage. Manual moves inside the same status are kept.
 */
async function syncStages(db: Db): Promise<number> {
  const stages = await allStages(db);
  const { data: leads } = await db.from('leads').select('id, status, pipeline_stage_id, pipeline_stages(pipeline, key)').limit(500);
  let moved = 0;
  for (const lead of leads ?? []) {
    const wanted = STATUS_STAGE_KEY[lead.status];
    if (!wanted) continue;
    const current = lead.pipeline_stages;
    if (current?.key === wanted) continue;
    const pipeline = current?.pipeline ?? DEFAULT_PIPELINE;
    const target = stages.find((s) => s.pipeline === pipeline && s.key === wanted);
    if (!target || target.id === lead.pipeline_stage_id) continue;
    const { error } = await db.from('leads').update({ pipeline_stage_id: target.id }).eq('id', lead.id);
    if (!error) moved += 1;
  }
  return moved;
}

export async function runCrmSweep(db: Db = createAdminClient(), now = new Date()): Promise<CrmSweepReport> {
  const [owners, settings] = await Promise.all([ownerContacts(db), getCrmSettings(db)]);
  const stageMoves = await syncStages(db);
  const sla = await slaAlerts(db, now, owners);
  const unanswered = await unansweredAlerts(db, now, owners, settings.unansweredHours);
  const leads = await leadAlerts(db, now, owners);
  const quotes = await quoteNudges(db, now, settings.quoteNudgeDays);
  const nurture = await lostNurture(db, now);
  return { sla, stageMoves, unanswered, ...leads, quoteNudges: quotes, nurture };
}

const SWEEP_EVERY_MS = 60_000;
let lastSweepAt = 0;

/** Page-load trigger: at most once a minute per server instance. Never throws. */
export async function sweepSoon(now = Date.now()): Promise<void> {
  if (now - lastSweepAt < SWEEP_EVERY_MS) return;
  lastSweepAt = now;
  try {
    await runCrmSweep();
  } catch (error) {
    console.error(`[crm] sweep failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

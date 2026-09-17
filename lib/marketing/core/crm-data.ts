import 'server-only';
import { normalizeAddress, normalizePhone } from './policy';
import { isPipelineId, missingStageRows, PIPELINES, type PipelineId } from './pipelines';
import type { Db } from './settings';
import { DEFAULT_CRM_RULES, type CrmRules, type ShopHours } from './speed';
import type { EngagementSignals } from './engagement';

/** Settings, stages and shared lookups for the Contacts inbox, tasks and pipeline. */

export interface CrmSettings extends CrmRules {
  backupPhone: string | null;
  backupEmail: string | null;
  quoteValidDays: number;
  autoReplyEnabled: boolean;
  autoReplyText: string;
}

export async function getCrmSettings(db: Db): Promise<CrmSettings> {
  const { data } = await db.from('crm_settings').select('*').eq('id', 1).maybeSingle();
  return {
    slaFirstMinutes: data?.sla_first_minutes ?? DEFAULT_CRM_RULES.slaFirstMinutes,
    slaBackupMinutes: data?.sla_backup_minutes ?? DEFAULT_CRM_RULES.slaBackupMinutes,
    hotScore: data?.hot_score ?? DEFAULT_CRM_RULES.hotScore,
    staleHours: data?.stale_hours ?? DEFAULT_CRM_RULES.staleHours,
    unansweredHours: data?.unanswered_hours ?? DEFAULT_CRM_RULES.unansweredHours,
    quoteNudgeDays: data?.quote_nudge_days ?? DEFAULT_CRM_RULES.quoteNudgeDays,
    quoteValidDays: data?.quote_valid_days ?? 14,
    backupPhone: data?.backup_phone ?? null,
    backupEmail: data?.backup_email ?? null,
    autoReplyEnabled: data?.auto_reply_enabled ?? true,
    autoReplyText: data?.auto_reply_text ?? 'Thanks for texting Lucky Diesel. We are closed right now and will reply first thing when we open.',
  };
}

export async function getShopHours(db: Db): Promise<ShopHours> {
  const [{ data: shop }, { data: marketing }] = await Promise.all([
    db.from('shop_settings').select('open_hour, close_hour, open_days').eq('id', 1).maybeSingle(),
    db.from('marketing_settings').select('time_zone').eq('id', 1).maybeSingle(),
  ]);
  return { openHour: shop?.open_hour ?? 8, closeHour: shop?.close_hour ?? 17, openDays: shop?.open_days ?? [1, 2, 3, 4, 5], timeZone: marketing?.time_zone ?? 'America/New_York' };
}

export interface StageRow {
  id: string;
  key: string;
  name: string;
  weight: number;
  isWon: boolean;
  isLost: boolean;
  pipeline: PipelineId;
}

/** Creates any missing default stages for a pipeline, so the board works without seed data. */
export async function ensurePipelineStages(db: Db, pipeline: PipelineId): Promise<StageRow[]> {
  const load = () => db.from('pipeline_stages').select('id, key, name, sort, score_weight, is_won, is_lost, pipeline').eq('pipeline', pipeline).order('sort');
  let { data } = await load();
  const missing = missingStageRows(pipeline, (data ?? []).map((s) => s.key));
  if (missing.length) {
    const { error } = await db.from('pipeline_stages').upsert(missing, { onConflict: 'pipeline,key', ignoreDuplicates: true });
    if (error) console.error(`[crm] could not create ${pipeline} stages: ${error.message}`);
    ({ data } = await load());
  }
  return (data ?? []).map((s) => ({ id: s.id, key: s.key, name: s.name, weight: s.score_weight, isWon: s.is_won, isLost: s.is_lost, pipeline: isPipelineId(s.pipeline) ? s.pipeline : 'leads' }));
}

export async function allStages(db: Db): Promise<StageRow[]> {
  const lists = await Promise.all(PIPELINES.map((p) => ensurePipelineStages(db, p.id)));
  return lists.flat();
}

/** Owner and team phones/emails, so staff alerts never show up as customer conversations. */
export async function staffAddresses(db: Db): Promise<Set<string>> {
  const [{ data: shop }, { data: team }] = await Promise.all([
    db.from('shop_settings').select('owner_email, owner_phone').eq('id', 1).maybeSingle(),
    db.from('profiles').select('email, phone').in('role', ['admin', 'employee']),
  ]);
  const set = new Set<string>();
  const add = (channel: 'sms' | 'email', value: string | null | undefined) => {
    if (value) set.add(normalizeAddress(channel, value));
  };
  add('email', shop?.owner_email);
  add('sms', shop?.owner_phone);
  for (const person of team ?? []) {
    add('email', person.email);
    add('sms', person.phone);
  }
  const crm = await getCrmSettings(db);
  add('sms', crm.backupPhone);
  add('email', crm.backupEmail);
  return set;
}

export async function teamMembers(db: Db): Promise<{ id: string; name: string }[]> {
  const { data } = await db.from('profiles').select('id, full_name').eq('role', 'admin').eq('active', true).order('full_name');
  return (data ?? []).map((p) => ({ id: p.id, name: p.full_name || 'Admin' }));
}

const DAY_MS = 86_400_000;

/** Engagement in the last 30 days per customer, from tracked visits, clicks and replies. */
export async function loadEngagementSignals(db: Db, now: Date): Promise<Map<string, EngagementSignals>> {
  const since = new Date(now.getTime() - 30 * DAY_MS).toISOString();
  const [touches, conversions, inbound, sends] = await Promise.all([
    db.from('attribution_touches').select('customer_id').gte('occurred_at', since).not('customer_id', 'is', null).limit(5000),
    db.from('conversion_events').select('customer_id').eq('kind', 'store_checkout_click').gte('occurred_at', since).not('customer_id', 'is', null).limit(5000),
    db.from('messages').select('customer_id').eq('direction', 'inbound').gte('created_at', since).not('customer_id', 'is', null).limit(5000),
    db.from('campaign_sends').select('customer_id').gte('clicked_at', since).not('customer_id', 'is', null).limit(5000),
  ]);
  const map = new Map<string, EngagementSignals>();
  const bump = (rows: { customer_id: string | null }[] | null, field: keyof EngagementSignals) => {
    for (const row of rows ?? []) {
      if (!row.customer_id) continue;
      const current = map.get(row.customer_id) ?? { touches: 0, checkoutClicks: 0, inboundMessages: 0, campaignClicks: 0 };
      map.set(row.customer_id, { ...current, [field]: current[field] + 1 });
    }
  };
  bump(touches.data, 'touches');
  bump(conversions.data, 'checkoutClicks');
  bump(inbound.data, 'inboundMessages');
  bump(sends.data, 'campaignClicks');
  return map;
}

/** Customer ids by phone tail / lower-case email, for naming inbox threads. */
export async function customersByAddress(db: Db, ids: readonly string[]): Promise<Map<string, { id: string; name: string; phone: string | null; email: string | null }>> {
  if (!ids.length) return new Map();
  const { data } = await db.from('customers').select('id, full_name, phone, email').in('id', [...new Set(ids)].slice(0, 500));
  return new Map((data ?? []).map((c) => [c.id, { id: c.id, name: c.full_name, phone: c.phone ? normalizePhone(c.phone) : null, email: c.email }]));
}

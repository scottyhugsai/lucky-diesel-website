import 'server-only';
import type { Enums, Json, TablesInsert } from '@/lib/db/database.types';
import { createAdminClient } from '@/lib/supabase/admin';
import { decodeAttributionCookie, normalizeSourceName, type AttributionCookie, type TouchData } from './attribution-touch';
import type { Db } from './settings';

type ConversionKind = Enums<'mkt_conversion_kind'>;
const DAY_MS = 86_400_000;
const CLICK_WINDOW_DAYS = { booking: 7, job_paid: 30 } as const;

function touchRow(touch: TouchData, ids: { anonymousId: string | null; customerId: string | null; leadId: string | null }, touchType: 'first' | 'last' | 'visit' | 'click'): TablesInsert<'attribution_touches'> {
  return {
    anonymous_id: ids.anonymousId, customer_id: ids.customerId, lead_id: ids.leadId, touch_type: touchType,
    source: touch.source, medium: touch.medium, campaign: touch.campaign ?? touch.ref, term: touch.term, content: touch.content,
    gclid: touch.gclid, gbraid: touch.gbraid, wbraid: touch.wbraid, fbclid: touch.fbclid, ttclid: touch.ttclid, msclkid: touch.msclkid,
    referrer: touch.referrer, landing_path: touch.landingPath, campaign_id: touch.campaignId, occurred_at: touch.at,
  };
}

export interface RecordTouchInput {
  touch: TouchData;
  touchType?: 'first' | 'last' | 'visit' | 'click';
  anonymousId?: string | null;
  customerId?: string | null;
  leadId?: string | null;
}

/** Stores one touch and keeps the customer's first/last touch pointers current. Returns the touch id. */
export async function recordTouch(input: RecordTouchInput, db: Db = createAdminClient()): Promise<string | null> {
  const ids = { anonymousId: input.anonymousId ?? null, customerId: input.customerId ?? null, leadId: input.leadId ?? null };
  const { data, error } = await db.from('attribution_touches').insert(touchRow(input.touch, ids, input.touchType ?? 'visit')).select('id').single();
  if (error || !data) {
    console.error(`[marketing] could not record touch: ${error?.message}`);
    return null;
  }
  if (ids.customerId) await refreshCustomerTouches(db, ids.customerId);
  return data.id;
}

async function refreshCustomerTouches(db: Db, customerId: string): Promise<void> {
  const { data: touches } = await db.from('attribution_touches').select('id, source, occurred_at').eq('customer_id', customerId).order('occurred_at');
  if (!touches?.length) return;
  const first = touches[0]!;
  const last = touches[touches.length - 1]!;
  await db.from('customers').update({ first_touch_id: first.id, first_touch_source: first.source, last_touch_id: last.id, last_touch_source: last.source }).eq('id', customerId);
}

/** Links a visitor cookie to a customer: stores its first/last touches once and remembers the visitor. */
export async function identifyVisitor(db: Db, cookie: AttributionCookie, customerId: string | null, leadId: string | null): Promise<void> {
  await db.from('tracking_visitors').upsert({ anonymous_id: cookie.aid, last_seen_at: new Date().toISOString(), ...(customerId ? { customer_id: customerId } : {}) }, { onConflict: 'anonymous_id' });
  const { data: existing } = await db.from('attribution_touches').select('id, occurred_at, customer_id, lead_id').eq('anonymous_id', cookie.aid);
  const known = new Set((existing ?? []).map((t) => t.occurred_at && new Date(t.occurred_at).toISOString()));
  const rows = [cookie.ft ? { touch: cookie.ft, type: 'first' as const } : null, cookie.lt && cookie.lt.at !== cookie.ft?.at ? { touch: cookie.lt, type: 'last' as const } : null]
    .filter((row): row is { touch: TouchData; type: 'first' | 'last' } => row !== null && !known.has(new Date(row.touch.at).toISOString()))
    .map((row) => touchRow(row.touch, { anonymousId: cookie.aid, customerId, leadId }, row.type));
  if (rows.length) await db.from('attribution_touches').insert(rows);
  // Earlier anonymous touches now belong to this person.
  if (customerId) await db.from('attribution_touches').update({ customer_id: customerId }).eq('anonymous_id', cookie.aid).is('customer_id', null);
  if (leadId) await db.from('attribution_touches').update({ lead_id: leadId }).eq('anonymous_id', cookie.aid).is('lead_id', null);
  if (customerId) await refreshCustomerTouches(db, customerId);
}

export interface AttributeConversionInput {
  kind: ConversionKind;
  customerId?: string | null;
  leadId?: string | null;
  appointmentId?: string | null;
  invoiceId?: string | null;
  valueCents?: number;
  /** Raw `ld_attr` cookie value from the request, when available. */
  cookie?: string | null;
  occurredAt?: Date;
  /** Fallback when no touches exist, e.g. `customers.source`. */
  fallbackSource?: string | null;
  metadata?: Record<string, Json>;
  /** Distinguishes repeatable conversions (e.g. each checkout click). Defaults to the subject id. */
  eventId?: string;
}

function dedupeKeyFor(input: AttributeConversionInput): string {
  const subject = input.eventId ?? input.invoiceId ?? input.appointmentId ?? input.leadId ?? input.customerId ?? 'anonymous';
  return `${input.kind}:${subject}`;
}

/**
 * Records a conversion (lead, booking, paid job, store checkout click) with its
 * first- and last-touch source. Idempotent per kind + subject. Also credits the
 * most recent clicked campaign send (booking within 7 days, revenue within 30).
 */
export async function attributeConversion(input: AttributeConversionInput, db: Db = createAdminClient()): Promise<{ id: string | null; source: string }> {
  const cookie = decodeAttributionCookie(input.cookie);
  const customerId = input.customerId ?? null;
  const leadId = input.leadId ?? null;
  if (cookie) await identifyVisitor(db, cookie, customerId, leadId);

  const occurredAt = input.occurredAt ?? new Date();
  const touches = (await loadTouches(db, { customerId, leadId, anonymousId: cookie?.aid ?? null }))
    .filter((t) => Date.parse(t.occurred_at) <= occurredAt.getTime());
  const first = touches[0] ?? null;
  const last = touches[touches.length - 1] ?? null;
  const fallback = normalizeSourceName(input.fallbackSource);

  const { data, error } = await db.from('conversion_events').upsert({
    kind: input.kind, customer_id: customerId, lead_id: leadId, appointment_id: input.appointmentId ?? null, invoice_id: input.invoiceId ?? null,
    anonymous_id: cookie?.aid ?? null, value_cents: Math.max(0, Math.round(input.valueCents ?? 0)),
    source: last?.source ?? fallback, first_source: first?.source ?? fallback, first_touch_id: first?.id ?? null, last_touch_id: last?.id ?? null,
    campaign_id: last?.campaign_id ?? null, dedupe_key: dedupeKeyFor(input), metadata: input.metadata ?? {}, occurred_at: occurredAt.toISOString(),
  }, { onConflict: 'dedupe_key', ignoreDuplicates: true }).select('id');
  if (error) console.error(`[marketing] conversion ${input.kind} failed: ${error.message}`);

  if (leadId && (first || last)) await db.from('leads').update({ first_touch_id: first?.id ?? null, last_touch_id: last?.id ?? null }).eq('id', leadId);
  const inserted = Boolean(data?.length);
  // Only on first insert, so re-running never double-counts revenue.
  if (inserted && customerId && (input.kind === 'booking' || input.kind === 'job_paid')) await creditCampaignSend(db, customerId, input.kind, occurredAt, input.valueCents ?? 0);
  return { id: data?.[0]?.id ?? null, source: last?.source ?? fallback };
}

async function loadTouches(db: Db, ids: { customerId: string | null; leadId: string | null; anonymousId: string | null }) {
  const columns = 'id, source, campaign_id, occurred_at';
  const lookups = [
    ids.customerId ? db.from('attribution_touches').select(columns).eq('customer_id', ids.customerId) : null,
    ids.leadId ? db.from('attribution_touches').select(columns).eq('lead_id', ids.leadId) : null,
    ids.anonymousId ? db.from('attribution_touches').select(columns).eq('anonymous_id', ids.anonymousId) : null,
  ].filter((q) => q !== null);
  const results = await Promise.all(lookups);
  const byId = new Map(results.flatMap((r) => r.data ?? []).map((t) => [t.id, t]));
  return [...byId.values()].sort((a, b) => Date.parse(a.occurred_at) - Date.parse(b.occurred_at));
}

async function creditCampaignSend(db: Db, customerId: string, kind: 'booking' | 'job_paid', at: Date, valueCents: number): Promise<void> {
  const since = new Date(at.getTime() - CLICK_WINDOW_DAYS[kind] * DAY_MS).toISOString();
  const { data: send } = await db
    .from('campaign_sends')
    .select('id, revenue_cents, converted_at')
    .eq('customer_id', customerId)
    .gte('clicked_at', since)
    .lte('clicked_at', at.toISOString())
    .order('clicked_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!send) return;
  const patch = kind === 'booking'
    ? { converted_at: send.converted_at ?? at.toISOString() }
    : { converted_at: send.converted_at ?? at.toISOString(), revenue_cents: send.revenue_cents + Math.max(0, Math.round(valueCents)) };
  await db.from('campaign_sends').update(patch).eq('id', send.id);
}

/**
 * Backfills conversions for leads, bookings and paid invoices created by code
 * that doesn't call `attributeConversion` yet. Safe to run daily.
 */
export async function syncConversions(db: Db, now = new Date(), lookbackDays = 120): Promise<number> {
  const since = new Date(now.getTime() - lookbackDays * DAY_MS).toISOString();
  const [leads, appointments, invoices, existing] = await Promise.all([
    db.from('leads').select('id, customer_id, source, created_at').gte('created_at', since),
    db.from('appointments').select('id, customer_id, created_at, status, customers(source)').gte('created_at', since).neq('status', 'cancelled'),
    db.from('invoices').select('id, customer_id, total_cents, paid_at, customers(source)').eq('status', 'paid').gte('paid_at', since),
    db.from('conversion_events').select('dedupe_key').gte('occurred_at', since),
  ]);
  const done = new Set((existing.data ?? []).map((e) => e.dedupe_key));
  let created = 0;
  const run = async (input: AttributeConversionInput) => {
    if (done.has(dedupeKeyFor(input))) return;
    await attributeConversion(input, db);
    created += 1;
  };
  for (const lead of leads.data ?? []) {
    await run({ kind: 'lead', leadId: lead.id, customerId: lead.customer_id, fallbackSource: lead.source, occurredAt: new Date(lead.created_at) });
  }
  for (const appt of appointments.data ?? []) {
    await run({ kind: 'booking', appointmentId: appt.id, customerId: appt.customer_id, fallbackSource: appt.customers?.source, occurredAt: new Date(appt.created_at) });
  }
  for (const invoice of invoices.data ?? []) {
    await run({ kind: 'job_paid', invoiceId: invoice.id, customerId: invoice.customer_id, valueCents: invoice.total_cents, fallbackSource: invoice.customers?.source, occurredAt: new Date(invoice.paid_at ?? now) });
  }
  return created;
}

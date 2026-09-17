import 'server-only';
import { emit } from '@/lib/automations/engine';
import { AUTOMATIONS } from '@/lib/automations/catalog';
import { vehicleLabel } from '@/lib/format';
import { siteUrl } from '@/lib/site-url';
import { createAdminClient } from '@/lib/supabase/admin';
import { planLifecycleEmits, type LifecycleInput } from './lifecycle-rules';
import { nextSendTime, quietHoursWindow } from './policy';
import { getMarketingSettings, type Db } from './settings';

const DAY_MS = 86_400_000;
const MAX_EMITS_PER_SWEEP = 300;

/** Inserts catalog automations missing from the `automations` table (never overwrites owner edits). */
export async function ensureCatalogAutomations(db: Db = createAdminClient()): Promise<number> {
  const { data: existing } = await db.from('automations').select('key, sort');
  const have = new Set((existing ?? []).map((a) => a.key));
  const nextSort = Math.max(0, ...(existing ?? []).map((a) => a.sort)) + 1;
  const missing = AUTOMATIONS.filter((a) => !have.has(a.key)).map((a, index) => ({
    key: a.key, name: a.name, description: a.description, trigger_event: a.triggerEvent, audience: a.audience, channels: a.channels,
    anchor: a.anchor, delay_minutes: a.delayMinutes, enabled: true, sort: nextSort + index,
    sms_template: a.sms ?? null, email_subject_template: a.emailSubject ?? null, email_body_template: a.emailBody ?? null,
  }));
  if (!missing.length) return 0;
  const { error } = await db.from('automations').upsert(missing, { onConflict: 'key', ignoreDuplicates: true });
  if (error) console.error(`[marketing] could not add catalog automations: ${error.message}`);
  return error ? 0 : missing.length;
}

async function optional<T>(query: PromiseLike<{ data: T[] | null; error: { message: string } | null }>, label: string): Promise<T[]> {
  const { data, error } = await query;
  // Tables owned by other areas (e.g. nps_responses) may not exist in every environment.
  if (error) console.error(`[marketing] sweep: ${label} unavailable: ${error.message}`);
  return data ?? [];
}

/** Customers with a portal login they never used, limited to those with a job in the last 10 days. */
async function neverSignedIn(db: Db, customers: { id: string; profile_id: string | null }[], jobs: { customer_id: string; created_at: string }[], now: Date): Promise<string[]> {
  const recent = new Set(jobs.filter((j) => now.getTime() - Date.parse(j.created_at) < 10 * DAY_MS).map((j) => j.customer_id));
  const candidates = customers.filter((c) => c.profile_id && recent.has(c.id));
  if (!candidates.length) return [];
  const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) {
    console.error(`[marketing] sweep: auth users unavailable: ${error.message}`);
    return [];
  }
  const never = new Set(data.users.filter((u) => !u.last_sign_in_at).map((u) => u.id));
  return candidates.filter((c) => never.has(c.profile_id!)).map((c) => c.id);
}

/** Loads the facts the lifecycle rules need with fixed, bounded queries. */
export async function loadLifecycleInput(db: Db, now: Date): Promise<LifecycleInput> {
  const settings = await getMarketingSettings(db);
  const twoYears = new Date(now.getTime() - 730 * DAY_MS).toISOString();
  const recent = new Date(now.getTime() - 60 * DAY_MS).toISOString();
  const [customers, invoices, vehicles, workOrders, tunes, leads, appointments, clicks, nps, events, registrations, fleets, lostLeads, buildItems] = await Promise.all([
    optional(db.from('customers').select('id, birthday, tags, fleet_account_id, profile_id'), 'customers'),
    optional(db.from('invoices').select('customer_id, paid_at').eq('status', 'paid').not('paid_at', 'is', null), 'invoices'),
    optional(db.from('vehicles').select('id, customer_id, mileage, mileage_updated_at, created_at, year, make, model, engine_code, generation, platform, nickname'), 'vehicles'),
    optional(db.from('work_orders').select('id, customer_id, vehicle_id, title, mileage_in, completed_at, created_at').neq('status', 'cancelled').gte('created_at', twoYears), 'work_orders'),
    optional(db.from('tune_records').select('id, vehicle_id, flashed_at, vehicles(customer_id)').gte('flashed_at', recent), 'tune_records'),
    optional(db.from('leads').select('id, customer_id, created_at, status, details').gte('created_at', recent).like('details', 'Build planner request%'), 'leads'),
    optional(db.from('appointments').select('customer_id, created_at, starts_at, status').gte('created_at', twoYears), 'appointments'),
    optional(db.from('conversion_events').select('id, customer_id, occurred_at').eq('kind', 'store_checkout_click').gte('occurred_at', recent).not('customer_id', 'is', null), 'checkout clicks'),
    optional(db.from('nps_responses').select('id, customer_id, score, responded_at').lte('score', 6).not('responded_at', 'is', null).not('customer_id', 'is', null), 'nps_responses'),
    optional(db.from('events').select('id, name, kind, starts_at').eq('published', true).gte('starts_at', now.toISOString()), 'events'),
    optional(db.from('event_registrations').select('event_id, customer_id').neq('status', 'cancelled'), 'event_registrations'),
    optional(db.from('fleet_accounts').select('id, contact_customer_id, pm_interval_miles, pm_interval_days').eq('active', true), 'fleet_accounts'),
    optional(db.from('leads').select('id, customer_id, created_at').eq('status', 'lost').gte('created_at', new Date(now.getTime() - 130 * DAY_MS).toISOString()), 'lost leads'),
    optional(db.from('build_items').select('id, vehicle_id, part_name, installed_at, warranty_until, vehicles(customer_id)'), 'build_items'),
  ]);
  const portalNeverSignedIn = await neverSignedIn(db, customers, workOrders, now);

  return {
    now, timeZone: settings.timeZone, winbackMonths: settings.winbackMonths, seasonal: settings.seasonal,
    customers: customers.map((c) => ({ id: c.id, birthday: c.birthday, tags: c.tags })),
    paidInvoices: invoices.map((i) => ({ customerId: i.customer_id, paidAt: new Date(i.paid_at!).toISOString() })),
    vehicles: vehicles.map((v) => ({ id: v.id, customerId: v.customer_id, mileage: v.mileage, createdAt: v.created_at, label: vehicleLabel(v), platform: v.platform, generation: v.generation, engineCode: v.engine_code, mileageUpdatedAt: v.mileage_updated_at })),
    workOrders: workOrders.map((w) => ({ id: w.id, customerId: w.customer_id, vehicleId: w.vehicle_id, title: w.title, mileageIn: w.mileage_in, at: new Date(w.completed_at ?? w.created_at).toISOString() })),
    tunes: tunes.flatMap((t) => (t.vehicles?.customer_id ? [{ id: t.id, customerId: t.vehicles.customer_id, vehicleId: t.vehicle_id, flashedAt: t.flashed_at }] : [])),
    plannerLeads: leads.map((l) => ({ id: l.id, customerId: l.customer_id, createdAt: l.created_at, status: l.status })),
    appointments: appointments.map((a) => ({ customerId: a.customer_id, createdAt: a.created_at, startsAt: a.starts_at, status: a.status })),
    checkoutClicks: clicks.map((c) => ({ id: c.id, customerId: c.customer_id!, occurredAt: c.occurred_at })),
    detractors: nps.map((n) => ({ id: n.id, customerId: n.customer_id!, respondedAt: n.responded_at! })),
    events: events.map((e) => ({ id: e.id, name: e.name, kind: e.kind, startsAt: e.starts_at, registeredCustomerIds: registrations.filter((r) => r.event_id === e.id && r.customer_id).map((r) => r.customer_id!) })),
    lostLeads: lostLeads.map((l) => ({ id: l.id, customerId: l.customer_id, createdAt: l.created_at })),
    buildItems: buildItems.flatMap((b) => (b.vehicles?.customer_id ? [{ id: b.id, vehicleId: b.vehicle_id, customerId: b.vehicles.customer_id, partName: b.part_name, installedAt: b.installed_at, warrantyUntil: b.warranty_until }] : [])),
    portalNeverSignedIn,
    siteBase: siteUrl(),
    fleets: fleets.map((f) => ({ id: f.id, contactCustomerId: f.contact_customer_id, pmIntervalMiles: f.pm_interval_miles, pmIntervalDays: f.pm_interval_days, memberCustomerIds: customers.filter((c) => c.fleet_account_id === f.id).map((c) => c.id) })),
  };
}

/**
 * Daily sweep: works out which lifecycle messages are due and emits them into
 * the automation engine (which dedupes and applies consent/caps/quiet hours).
 */
export async function runLifecycleSweep(now = new Date(), db: Db = createAdminClient()): Promise<{ planned: number; emitted: number; byEvent: Record<string, number> }> {
  const [input, settings] = await Promise.all([loadLifecycleInput(db, now), getMarketingSettings(db)]);
  const planned = planLifecycleEmits(input);
  // Outside 8am–9pm the runs are scheduled for the next opening instead of being skipped by the send gate.
  const occurredAt = nextSendTime(now, quietHoursWindow(settings.quietHoursStart, settings.quietHoursEnd, settings.timeZone));
  const byEvent: Record<string, number> = {};
  let emitted = 0;
  for (const item of planned.slice(0, MAX_EMITS_PER_SWEEP)) {
    const { scheduled } = await emit({ name: item.name, subjectType: 'customer', subjectId: item.customerId, discriminator: item.discriminator, context: item.context, occurredAt });
    if (scheduled > 0) {
      emitted += 1;
      byEvent[item.name] = (byEvent[item.name] ?? 0) + 1;
    }
  }
  return { planned: planned.length, emitted, byEvent };
}

import 'server-only';
import { emit } from '@/lib/automations/engine';
import { insertStarterDraft } from '@/components/admin/marketing/core-ui/campaign-write';
import { SHOP_TIME_ZONE, vehicleLabel } from '@/lib/format';
import { availableSlots } from '@/lib/scheduling/slots';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  LOCAL_EVENT_LEAD_DAYS, classifyNwsAlerts, localEventsNeedingDraft, openBayRecipients, parseNhtsaRecalls,
  recallLabel, recallModelCandidates, shouldFillBays, vehiclesOnOlderRevision, type RecallMatch,
} from './local-trigger-rules';
import { getMarketingSettings, type Db } from './settings';

const DAY_MS = 86_400_000;
const UA = { 'user-agent': 'LuckyDiesel/1.0 (shop marketing cron)', accept: 'application/json' };
/** Charleston, SC shop location — NWS alerts are fetched for this point. */
const SHOP_POINT = '32.8168,-79.9628';
const RECALL_REFRESH_DAYS = 30;
/** One NHTSA lookup per distinct year/make/model, a few per run. */
const RECALL_GROUPS_PER_RUN = 8;
const MAX_WEATHER_RECIPIENTS = 300;

export const localDay = (now: Date, timeZone = SHOP_TIME_ZONE) =>
  new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

async function getJson(url: string, timeoutMs = 12_000): Promise<unknown> {
  const response = await fetch(url, { headers: UA, signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/** Active customers (paid within two years) who still have a truck on file. */
async function activeCustomerIds(db: Db, now: Date, limit: number): Promise<string[]> {
  const since = new Date(now.getTime() - 730 * DAY_MS).toISOString();
  const { data } = await db.from('invoices').select('customer_id, paid_at').eq('status', 'paid').gte('paid_at', since).order('paid_at', { ascending: false }).limit(2000);
  const seen = new Set<string>();
  for (const row of data ?? []) if (row.customer_id) seen.add(row.customer_id);
  return [...seen].slice(0, limit);
}

// ─── Recalls (NHTSA, free, no key) ──────────────────────────────────────────

/** One NHTSA lookup, trying the full model then the first word. */
async function lookupRecalls(year: number, make: string, model: string): Promise<RecallMatch[]> {
  for (const candidate of recallModelCandidates(model)) {
    const url = `https://api.nhtsa.gov/recalls/recallsByVehicle?make=${encodeURIComponent(make)}&model=${encodeURIComponent(candidate)}&modelYear=${year}`;
    const matches = parseNhtsaRecalls(await getJson(url).catch(() => null));
    if (matches.length) return matches;
  }
  return [];
}

/**
 * Weekly: checks the free NHTSA recalls API by year/make/model, saves matches
 * and emits one notice per new recall. Recall work is free at a dealer, so the
 * email is information only.
 */
export async function syncVehicleRecalls(db: Db = createAdminClient(), now = new Date()): Promise<{ checked: number; found: number; emitted: number }> {
  const stale = new Date(now.getTime() - RECALL_REFRESH_DAYS * DAY_MS).toISOString();
  const { data: vehicles } = await db
    .from('vehicles')
    .select('id, customer_id, year, make, model, nickname, recalls_checked_at')
    .is('sold_at', null)
    .not('year', 'is', null)
    .not('make', 'is', null)
    .not('model', 'is', null)
    .or(`recalls_checked_at.is.null,recalls_checked_at.lt.${stale}`)
    .limit(400);

  const groups = new Map<string, typeof vehicles>();
  for (const vehicle of vehicles ?? []) {
    const key = `${vehicle.year}|${vehicle.make}|${vehicle.model}`.toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), vehicle]);
  }

  let checked = 0;
  let found = 0;
  let emitted = 0;
  for (const trucks of [...groups.values()].slice(0, RECALL_GROUPS_PER_RUN)) {
    const first = trucks?.[0];
    if (!first) continue;
    let matches: RecallMatch[] = [];
    try {
      matches = await lookupRecalls(first.year!, first.make!, first.model!);
    } catch (error) {
      console.error(`[marketing] NHTSA lookup failed: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    checked += 1;
    for (const vehicle of trucks!) {
      for (const match of matches) {
        const { data: row } = await db.from('vehicle_recalls').upsert({
          vehicle_id: vehicle.id, campaign_number: match.campaignNumber, component: match.component,
          summary: match.summary, remedy: match.remedy, report_date: match.reportDate,
        }, { onConflict: 'vehicle_id,campaign_number', ignoreDuplicates: true }).select('id').maybeSingle();
        if (!row) continue;
        found += 1;
        const { scheduled } = await emit({
          name: 'marketing.recall_open', subjectType: 'customer', subjectId: vehicle.customer_id,
          discriminator: `recall:${vehicle.id}:${match.campaignNumber}`,
          context: { vehicle_id: vehicle.id, due_service: recallLabel(match) },
        });
        if (scheduled > 0) emitted += 1;
      }
      await db.from('vehicles').update({ recalls_checked_at: now.toISOString() }).eq('id', vehicle.id);
    }
  }
  return { checked, found, emitted };
}

// ─── Weather (NWS, free, no key) ────────────────────────────────────────────

/** Freeze and storm-watch alerts for the shop's point become one send per alert. */
export async function runWeatherTriggers(db: Db = createAdminClient(), now = new Date()): Promise<{ alerts: number; emitted: number; skipped?: string }> {
  const settings = await getMarketingSettings(db);
  if (settings.seasonal.weather_alerts === false) return { alerts: 0, emitted: 0, skipped: 'off' };
  let alerts: ReturnType<typeof classifyNwsAlerts> = [];
  try {
    alerts = classifyNwsAlerts(await getJson(`https://api.weather.gov/alerts/active?point=${SHOP_POINT}`));
  } catch (error) {
    console.error(`[marketing] NWS alerts failed: ${error instanceof Error ? error.message : String(error)}`);
    return { alerts: 0, emitted: 0, skipped: 'unavailable' };
  }
  if (!alerts.length) return { alerts: 0, emitted: 0 };
  const customers = await activeCustomerIds(db, now, MAX_WEATHER_RECIPIENTS);
  let emitted = 0;
  for (const alert of alerts.slice(0, 2)) {
    for (const customerId of customers) {
      const { scheduled } = await emit({
        name: `marketing.weather.${alert.kind}`, subjectType: 'customer', subjectId: customerId,
        discriminator: `weather:${alert.id}`, context: { due_service: alert.headline },
      });
      if (scheduled > 0) emitted += 1;
    }
  }
  return { alerts: alerts.length, emitted };
}

// ─── Open-bay fill ──────────────────────────────────────────────────────────

async function slotCapacity(db: Db, date: string, now: Date): Promise<{ open: number; total: number }> {
  const { data: shop } = await db.from('shop_settings').select('*').eq('id', 1).maybeSingle();
  const rules = {
    openHour: shop?.open_hour ?? 8, closeHour: shop?.close_hour ?? 17, openDays: shop?.open_days ?? [1, 2, 3, 4, 5],
    slotMinutes: shop?.slot_minutes ?? 60, bayCount: shop?.bay_count ?? 3,
  };
  const dayStart = new Date(`${date}T00:00:00Z`);
  const { data: booked } = await db.from('appointments').select('starts_at, ends_at')
    .not('status', 'in', '(cancelled,no_show)')
    .gte('starts_at', new Date(dayStart.getTime() - DAY_MS).toISOString())
    .lt('starts_at', new Date(dayStart.getTime() + 2 * DAY_MS).toISOString());
  const ranges = (booked ?? []).map((b) => ({ startsAt: new Date(b.starts_at), endsAt: new Date(b.ends_at) }));
  return { open: availableSlots(date, rules, ranges, now).length, total: availableSlots(date, rules, [], now).length };
}

/**
 * When the next two working days are mostly empty, offers those slots to recent
 * customers who have nothing booked. One send per day of open bays.
 */
export async function runOpenBayFill(db: Db = createAdminClient(), now = new Date()): Promise<{ open: number; total: number; emitted: number; skipped?: string }> {
  const settings = await getMarketingSettings(db);
  if (settings.seasonal.open_bay === false) return { open: 0, total: 0, emitted: 0, skipped: 'off' };
  const dates = [2, 3].map((offset) => localDay(new Date(now.getTime() + offset * DAY_MS), settings.timeZone));
  const capacity = await Promise.all(dates.map((date) => slotCapacity(db, date, now)));
  const open = capacity.reduce((total, day) => total + day.open, 0);
  const total = capacity.reduce((sum, day) => sum + day.total, 0);
  if (!shouldFillBays(open, total)) return { open, total, emitted: 0, skipped: 'bays booked' };

  const since = new Date(now.getTime() - 365 * DAY_MS).toISOString();
  const [{ data: invoices }, { data: appointments }] = await Promise.all([
    db.from('invoices').select('customer_id, paid_at').eq('status', 'paid').gte('paid_at', since).order('paid_at', { ascending: false }).limit(2000),
    db.from('appointments').select('customer_id, starts_at').not('status', 'in', '(cancelled,no_show,completed)').gte('starts_at', now.toISOString()),
  ]);
  const lastPaid = new Map<string, string>();
  for (const invoice of invoices ?? []) {
    if (!invoice.customer_id || !invoice.paid_at) continue;
    const current = lastPaid.get(invoice.customer_id);
    if (!current || invoice.paid_at > current) lastPaid.set(invoice.customer_id, invoice.paid_at);
  }
  const booked = new Set((appointments ?? []).flatMap((a) => (a.customer_id ? [a.customer_id] : [])));
  const when = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: settings.timeZone }).format(new Date(`${dates[0]}T17:00:00Z`));
  let emitted = 0;
  for (const customerId of openBayRecipients(lastPaid, booked, now)) {
    const { scheduled } = await emit({
      name: 'marketing.open_bay', subjectType: 'customer', subjectId: customerId,
      discriminator: `open-bay:${dates[0]}`, context: { due_service: `this ${when}` },
    });
    if (scheduled > 0) emitted += 1;
  }
  return { open, total, emitted };
}

// ─── Local events → draft campaign ──────────────────────────────────────────

/** Outside Charleston events get a starter draft 14 days out; the owner edits and schedules it. */
export async function draftLocalEventCampaigns(db: Db = createAdminClient(), now = new Date(), requestedBy: string | null = null): Promise<{ drafted: number; skipped?: string }> {
  const settings = await getMarketingSettings(db);
  let author = requestedBy;
  if (!author) {
    const { data: admin } = await db.from('profiles').select('id').eq('role', 'admin').order('created_at').limit(1).maybeSingle();
    author = admin?.id ?? null;
  }
  if (!author) return { drafted: 0, skipped: 'no admin on file' };
  const { data: rows } = await db.from('local_events').select('id, name, starts_on, pitch, draft_campaign_id').is('draft_campaign_id', null).gte('starts_on', localDay(now, settings.timeZone)).limit(50);
  const due = localEventsNeedingDraft((rows ?? []).map((r) => ({ ...r, startsOn: r.starts_on, draftCampaignId: r.draft_campaign_id })), localDay(now, settings.timeZone));
  let drafted = 0;
  for (const event of due) {
    const when = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${event.starts_on}T12:00:00Z`));
    const created = await insertStarterDraft(db, {
      name: `${event.name} ${new Date(`${event.starts_on}T12:00:00Z`).getUTCFullYear()}`.slice(0, 120),
      channel: 'email',
      subject: `See you at ${event.name}?`.slice(0, 120),
      body: `Hey {{first_name}},\n\n${event.pitch ?? `${event.name} is on ${when}.`} Bring the truck by the shop before you go and we will look it over.\n\nBook a bay: {{link}}\n\n— Lucky Diesel`,
      seasonalKey: null, segmentId: null,
    }, author);
    if ('error' in created) {
      console.error(`[marketing] local event draft failed: ${created.error}`);
      continue;
    }
    await db.from('local_events').update({ draft_campaign_id: created.id }).eq('id', event.id);
    drafted += 1;
  }
  return { drafted };
}

export { LOCAL_EVENT_LEAD_DAYS };

// ─── Tune revisions ─────────────────────────────────────────────────────────

/**
 * A calibrator released a newer revision: notes it to owners still on an older
 * one. Emissions-compliant tunes only — never a re-flash pitch for anything else.
 */
export async function notifyTuneRevision(releaseId: string, db: Db = createAdminClient()): Promise<{ notified: number; error?: string }> {
  const { data: release } = await db.from('tune_revision_releases').select('*').eq('id', releaseId).maybeSingle();
  if (!release) return { notified: 0, error: 'Release not found.' };
  const { data: tunes } = await db
    .from('tune_records')
    .select('vehicle_id, calibrator, revision, emissions_compliant, flashed_at, vehicles(customer_id, year, make, model, nickname)')
    .not('vehicle_id', 'is', null)
    .limit(2000);
  const rows = (tunes ?? []).flatMap((t) => (t.vehicles?.customer_id
    ? [{ vehicleId: t.vehicle_id!, customerId: t.vehicles.customer_id, calibrator: t.calibrator, revision: t.revision, emissionsCompliant: t.emissions_compliant, flashedAt: t.flashed_at ?? '' }]
    : []));
  const stale = vehiclesOnOlderRevision(rows, release.calibrator, release.revision);
  const labels = new Map((tunes ?? []).flatMap((t) => (t.vehicles ? [[t.vehicle_id!, vehicleLabel(t.vehicles)]] : [])));
  let notified = 0;
  for (const target of stale) {
    const { scheduled } = await emit({
      name: 'marketing.tune_revision', subjectType: 'customer', subjectId: target.customerId,
      discriminator: `tune-rev:${target.vehicleId}:${release.revision}`,
      context: {
        vehicle_id: target.vehicleId,
        due_service: `a ${release.calibrator} ${release.revision} update for ${labels.get(target.vehicleId) ?? 'your truck'} (you are on ${target.revision})`,
        detail: release.notes ?? '',
      },
    });
    if (scheduled > 0) notified += 1;
  }
  await db.from('tune_revision_releases').update({ notified }).eq('id', releaseId);
  return { notified };
}

/** Cron wrapper: runs the outside-trigger steps that are safe to repeat daily. */
export async function runLocalTriggers(db: Db = createAdminClient(), now = new Date()): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  const step = async (name: string, fn: () => Promise<unknown>) => {
    try {
      out[name] = await fn();
    } catch (error) {
      out[name] = { error: error instanceof Error ? error.message : String(error) };
    }
  };
  await step('recalls', () => syncVehicleRecalls(db, now));
  await step('weather', () => runWeatherTriggers(db, now));
  await step('openBay', () => runOpenBayFill(db, now));
  await step('localEvents', () => draftLocalEventCampaigns(db, now));
  return out;
}

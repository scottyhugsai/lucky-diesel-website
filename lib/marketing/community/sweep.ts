import 'server-only';
import { ownerRecipient } from '@/lib/automations/context';
import { firstName, money } from '@/lib/format';
import { previousMonth, monthRange } from '@/lib/marketing/fleet/fleet-math';
import { fleetRecipient, loadFleetDetail, reportFor, reportText } from '@/lib/marketing/fleet/fleet-service';
import { BUSINESS } from '@/lib/site';
import { siteUrl } from '@/lib/site-url';
import { highValueCarts } from '@/lib/store/compliance';
import { runStockAlerts } from '@/lib/store/stock-alerts';
import type { createAdminClient } from '@/lib/supabase/admin';
import { sendCatalogMessage, type CatalogSendOutcome } from './catalog-send';
import { isFollowUpDue, monthKey, monthLabel, reminderStage } from './event-rules';

type Db = ReturnType<typeof createAdminClient>;
const DAY_MS = 86_400_000;
const TZ = 'America/New_York';

const fmtWhen = (iso: string, withDay: boolean) =>
  new Intl.DateTimeFormat('en-US', { timeZone: TZ, ...(withDay ? { weekday: 'long', month: 'short', day: 'numeric' } : {}), hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

function count(tally: Record<string, number>, outcome: CatalogSendOutcome) {
  tally[outcome] = (tally[outcome] ?? 0) + 1;
}

/** 7-day and day-before reminders to everyone signed up (not waitlist). */
export async function sendEventReminders(db: Db, now: Date): Promise<Record<string, number>> {
  const tally: Record<string, number> = {};
  const { data: events } = await db.from('events').select('id, slug, name, starts_at, location, event_registrations(id, full_name, email, phone, customer_id, status, slot_at)')
    .eq('published', true).gt('starts_at', now.toISOString()).lte('starts_at', new Date(now.getTime() + 9 * DAY_MS).toISOString()).limit(20);
  for (const event of events ?? []) {
    const stage = reminderStage(event.starts_at, now);
    if (!stage) continue;
    for (const reg of event.event_registrations.filter((r) => r.status === 'registered')) {
      const outcome = await sendCatalogMessage(db, {
        key: 'event_reminder', subjectType: 'event_registration', subjectId: reg.id, dedupeKey: `event_reminder:${reg.id}:${stage}`,
        recipient: { email: reg.email, phone: reg.phone, customerId: reg.customer_id, isCustomer: true },
        vars: {
          first_name: firstName(reg.full_name), event_name: event.name, event_when: stage === '1d' ? `on ${fmtWhen(event.starts_at, true)}` : `next ${fmtWhen(event.starts_at, true)}`,
          event_place: event.location ?? BUSINESS.name, event_link: `${siteUrl()}/events/${event.slug}`,
          slot_line: reg.slot_at ? ` Your dyno slot: ${fmtWhen(reg.slot_at, false)}.` : '',
        },
      });
      count(tally, outcome);
    }
  }
  return tally;
}

/** Day-after thanks to attendees, with their result card when they allowed media. Marketing consent applies. */
export async function sendEventFollowUps(db: Db, now: Date): Promise<Record<string, number>> {
  const tally: Record<string, number> = {};
  const { data: events } = await db.from('events').select('id, slug, name, ends_at, event_registrations(id, full_name, email, phone, customer_id, status, horsepower, torque, media_consent, result_verified)')
    .lt('ends_at', now.toISOString()).gte('ends_at', new Date(now.getTime() - 4 * DAY_MS).toISOString()).limit(20);
  for (const event of events ?? []) {
    if (!isFollowUpDue(event.ends_at, now)) continue;
    for (const reg of event.event_registrations.filter((r) => r.status === 'checked_in')) {
      const hasCard = reg.media_consent && reg.result_verified && reg.horsepower;
      const result = reg.horsepower && reg.result_verified ? ` Your truck made ${reg.horsepower} hp${reg.torque ? ` / ${reg.torque} lb-ft` : ''}.` : '';
      const outcome = await sendCatalogMessage(db, {
        key: 'mkt_event_follow_up', subjectType: 'event_registration', subjectId: reg.id, dedupeKey: `event_follow_up:${reg.id}`,
        recipient: { email: reg.email, phone: reg.phone, customerId: reg.customer_id, isCustomer: true },
        vars: { first_name: firstName(reg.full_name), event_name: event.name, result_line: hasCard ? `${result} Your result card: ${siteUrl()}/events/${event.slug}/card/${reg.id}` : result },
      });
      count(tally, outcome);
    }
  }
  return tally;
}

/** Owner email: store checkouts ≥ $1,000 in the last day with no order or payment since. */
export async function sendHighValueCartSummary(db: Db, now: Date): Promise<CatalogSendOutcome | 'none'> {
  const since = new Date(now.getTime() - DAY_MS).toISOString();
  const { data: clicks } = await db.from('conversion_events').select('id, customer_id, value_cents, occurred_at, customers(full_name, phone)').eq('kind', 'store_checkout_click').gte('occurred_at', since).limit(500);
  const known = [...new Set((clicks ?? []).flatMap((c) => (c.customer_id ? [c.customer_id] : [])))];
  const [{ data: orders }, { data: paid }] = known.length
    ? await Promise.all([
        db.from('store_orders').select('customer_id').in('customer_id', known).gte('ordered_at', since),
        db.from('invoices').select('customer_id').in('customer_id', known).gte('paid_at', since),
      ])
    : [{ data: [] }, { data: [] }];
  const converted = new Set([...(orders ?? []), ...(paid ?? [])].flatMap((r) => (r.customer_id ? [r.customer_id] : [])));
  const carts = highValueCarts((clicks ?? []).map((c) => ({ id: c.id, customerId: c.customer_id, valueCents: c.value_cents, occurredAt: c.occurred_at })), converted, now);
  if (!carts.length) return 'none';
  const byId = new Map((clicks ?? []).map((c) => [c.id, c]));
  const lines = carts.slice(0, 20).map((cart) => {
    const who = byId.get(cart.id)?.customers;
    return `• ${money(cart.valueCents)} — ${who ? `${who.full_name}${who.phone ? ` ${who.phone}` : ''}` : 'anonymous visitor'}`;
  });
  const owner = await ownerRecipient(db);
  return sendCatalogMessage(db, {
    key: 'store_high_value_carts', subjectType: 'shop', subjectId: null, dedupeKey: `high_value_carts:${now.toISOString().slice(0, 10)}`,
    recipient: { ...owner, phone: null },
    vars: { cart_count: carts.length, cart_total: money(carts.reduce((t, c) => t + c.valueCents, 0), { whole: true }), cart_lines: lines.join('\n'), admin_link: `${siteUrl()}/admin/marketing/contacts` },
  });
}

/** First three days of the month: last month's report to every active fleet with an email. */
export async function sendFleetMonthlyReports(db: Db, now: Date): Promise<Record<string, number>> {
  const tally: Record<string, number> = {};
  const localDay = Number(new Intl.DateTimeFormat('en-US', { timeZone: TZ, day: 'numeric' }).format(now));
  if (localDay > 3) return tally;
  const month = previousMonth(new Date(`${monthKey(now, TZ)}-15T12:00:00Z`));
  const range = monthRange(month)!;
  const { data: fleets } = await db.from('fleet_accounts').select('id').eq('active', true).eq('stage', 'active').limit(100);
  for (const { id } of fleets ?? []) {
    const detail = await loadFleetDetail(db, id, now);
    if (!detail) continue;
    const to = await fleetRecipient(db, detail.fleet);
    const report = reportFor(detail, range.from, range.to, now);
    const outcome = await sendCatalogMessage(db, {
      key: 'fleet_monthly_report', subjectType: 'fleet_account', subjectId: id, dedupeKey: `fleet_report:${id}:${month}`,
      recipient: { email: to.email, phone: null, customerId: to.customerId, isCustomer: true },
      vars: { first_name: to.firstName, fleet_name: detail.fleet.name, period: monthLabel(month), report_text: reportText(detail, monthLabel(month), report) },
    });
    if (outcome === 'sent') await db.from('fleet_accounts').update({ last_report_sent_at: now.toISOString() }).eq('id', id);
    count(tally, outcome);
  }
  return tally;
}

/** Daily: event reminders & follow-ups, back-in-stock alerts, big-cart summary, fleet reports. Steps are isolated. */
export async function runCommunitySweep(now: Date, db: Db): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  const steps: [string, () => Promise<unknown>][] = [
    ['eventReminders', () => sendEventReminders(db, now)],
    ['eventFollowUps', () => sendEventFollowUps(db, now)],
    ['stockAlerts', () => runStockAlerts(db)],
    ['highValueCarts', () => sendHighValueCartSummary(db, now)],
    ['fleetReports', () => sendFleetMonthlyReports(db, now)],
  ];
  for (const [name, fn] of steps) {
    try {
      out[name] = await fn();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      console.error(`[community sweep] ${name} failed: ${message}`);
      out[name] = { error: message };
    }
  }
  return out;
}

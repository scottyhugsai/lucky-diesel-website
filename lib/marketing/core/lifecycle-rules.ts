/**
 * Pure selection rules for the daily lifecycle sweep. Each rule returns the
 * events to emit; the automation engine dedupes on (automation, customer,
 * discriminator), so re-running the sweep is harmless.
 */

import { categorizeService } from './segment-rules';
import { retentionEmits } from './lifecycle-retention';
import { isServiceDue, predictMileage, type MileageReading } from './scoring';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const DAYS_PER_MONTH = 30.44;
const ACTIVE_CUSTOMER_DAYS = 730;

export type EmitContext = Record<string, string | number | boolean | null>;
export interface LifecycleEmit { name: string; customerId: string; discriminator: string; context: EmitContext }

export interface LifecycleInput {
  now: Date;
  timeZone: string;
  winbackMonths: number[];
  seasonal: Record<string, boolean>;
  customers: { id: string; birthday: string | null; tags: string[] }[];
  paidInvoices: { customerId: string; paidAt: string }[];
  vehicles: { id: string; customerId: string; mileage: number | null; createdAt: string; label: string; platform?: string | null; generation?: string | null; engineCode?: string | null; mileageUpdatedAt?: string | null }[];
  workOrders: { id?: string; customerId: string; vehicleId: string; title: string; mileageIn: number | null; at: string }[];
  tunes: { id: string; customerId: string; vehicleId: string; flashedAt: string }[];
  plannerLeads: { id: string; customerId: string | null; createdAt: string; status: string }[];
  appointments: { customerId: string; createdAt: string; startsAt: string; status: string }[];
  checkoutClicks: { id: string; customerId: string; occurredAt: string }[];
  detractors: { id: string; customerId: string; respondedAt: string }[];
  events: { id: string; name: string; kind: string; startsAt: string; registeredCustomerIds: string[] }[];
  fleets: { id: string; contactCustomerId: string | null; pmIntervalMiles: number; pmIntervalDays: number; memberCustomerIds: string[] }[];
  /** Leads marked lost (retention rules below; optional so older callers keep working). */
  lostLeads?: { id: string; customerId: string | null; createdAt: string }[];
  buildItems?: { id: string; vehicleId: string; customerId: string; partName: string; installedAt: string | null; warrantyUntil: string | null }[];
  promoters?: { id: string; customerId: string; respondedAt: string }[];
  /** Customers with a portal login that was never used, keyed by customer id. */
  portalNeverSignedIn?: string[];
  /** Absolute site origin for links built in rules. */
  siteBase?: string;
}

export const SEASONS: readonly { key: string; event: string; from: [number, number]; to: [number, number]; label: string; /** Only customers with one of these tags. */ tags?: string[] }[] = [
  { key: 'towing_season', event: 'marketing.seasonal.towing_season', from: [3, 1], to: [4, 15], label: 'a pre-towing-season inspection' },
  { key: 'hurricane_prep', event: 'marketing.seasonal.hurricane_prep', from: [5, 20], to: [6, 15], label: 'an evacuation-ready truck check' },
  { key: 'winter_diesel', event: 'marketing.seasonal.winter_diesel', from: [10, 15], to: [11, 30], label: 'a cold-start and fuel system check' },
  { key: 'summer_heat', event: 'marketing.seasonal.summer_heat', from: [6, 16], to: [7, 31], label: 'a cooling system check' },
  { key: 'hunting_season', event: 'marketing.seasonal.hunting_season', from: [8, 15], to: [9, 30], label: 'a pre-season trip check', tags: ['hunting', 'tows', 'towing', 'offroad'] },
  { key: 'tax_refund', event: 'marketing.seasonal.tax_refund', from: [2, 1], to: [3, 15], label: 'a build plan' },
  { key: 'holiday_parts', event: 'marketing.seasonal.holiday_parts', from: [11, 24], to: [12, 20], label: 'parts and gift ideas' },
];

export function localDate(at: Date, timeZone: string): { year: number; month: number; day: number } {
  const [year, month, day] = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at).split('-').map(Number);
  return { year: year!, month: month!, day: day! };
}

export const ageMs = (iso: string, now: Date) => now.getTime() - Date.parse(iso);
export const within = (iso: string, now: Date, minMs: number, maxMs: number) => {
  const age = ageMs(iso, now);
  return age >= minMs && age <= maxMs;
};

export function lastPaidByCustomer(input: LifecycleInput): Map<string, string> {
  const last = new Map<string, string>();
  for (const inv of input.paidInvoices) {
    const current = last.get(inv.customerId);
    if (!current || inv.paidAt > current) last.set(inv.customerId, inv.paidAt);
  }
  return last;
}

export function upcomingAppointmentCustomers(input: LifecycleInput): Set<string> {
  return new Set(input.appointments.filter((a) => !['cancelled', 'no_show', 'completed'].includes(a.status) && Date.parse(a.startsAt) > input.now.getTime()).map((a) => a.customerId));
}

export function winBackEmits(input: LifecycleInput): LifecycleEmit[] {
  const booked = upcomingAppointmentCustomers(input);
  const thresholds = [...new Set(input.winbackMonths.filter((m) => m > 0))].sort((a, b) => b - a);
  const out: LifecycleEmit[] = [];
  for (const [customerId, paidAt] of lastPaidByCustomer(input)) {
    if (booked.has(customerId)) continue;
    const months = ageMs(paidAt, input.now) / DAY_MS / DAYS_PER_MONTH;
    if (months >= 24) continue;
    const threshold = thresholds.find((t) => months >= t);
    if (!threshold) continue;
    const bucket = threshold >= 12 ? '12m' : '6m';
    out.push({ name: `marketing.win_back_${bucket}`, customerId, discriminator: `${bucket}:${paidAt.slice(0, 10)}`, context: { due_service: 'a check-up' } });
  }
  return out;
}

export function readingsFor(vehicleId: string, input: LifecycleInput): MileageReading[] {
  const readings: MileageReading[] = input.workOrders
    .filter((w) => w.vehicleId === vehicleId && w.mileageIn)
    .map((w) => ({ at: new Date(w.at), miles: w.mileageIn! }));
  const vehicle = input.vehicles.find((v) => v.id === vehicleId);
  if (vehicle?.mileage) readings.push({ at: new Date(vehicle.mileageUpdatedAt ?? vehicle.createdAt), miles: vehicle.mileage });
  return readings;
}

/** Emits the existing `service.due` event (covered by the transactional SMS consent text). */
export function serviceDueEmits(input: LifecycleInput): LifecycleEmit[] {
  const booked = upcomingAppointmentCustomers(input);
  const out: LifecycleEmit[] = [];
  for (const vehicle of input.vehicles) {
    if (booked.has(vehicle.customerId)) continue;
    const services = input.workOrders
      .filter((w) => w.vehicleId === vehicle.id && w.mileageIn && categorizeService(w.title).includes('maintenance'))
      .sort((a, b) => b.at.localeCompare(a.at));
    const lastService = services[0];
    if (!lastService) continue;
    const predicted = predictMileage(readingsFor(vehicle.id, input), input.now);
    if (!isServiceDue(predicted, lastService.mileageIn)) continue;
    const rounded = Math.round((predicted ?? 0) / 100) * 100;
    out.push({
      name: 'service.due',
      customerId: vehicle.customerId,
      discriminator: `mileage:${vehicle.id}:${lastService.mileageIn}`,
      context: { vehicle_id: vehicle.id, due_service: `an oil & fuel filter service (about ${rounded.toLocaleString('en-US')} mi now)` },
    });
  }
  return out;
}

export function tuneEmits(input: LifecycleInput): LifecycleEmit[] {
  return input.tunes.flatMap((tune) => {
    const context = { vehicle_id: tune.vehicleId, due_service: 'a datalog review' };
    if (within(tune.flashedAt, input.now, 3 * DAY_MS, 10 * DAY_MS)) return [{ name: 'marketing.tune_follow_up', customerId: tune.customerId, discriminator: tune.id, context }];
    if (within(tune.flashedAt, input.now, 30 * DAY_MS, 45 * DAY_MS)) return [{ name: 'marketing.dyno_recheck', customerId: tune.customerId, discriminator: tune.id, context: { ...context, due_service: 'a dyno re-check' } }];
    return [];
  });
}

export function activeSeasons(now: Date, timeZone: string, toggles: Record<string, boolean>): typeof SEASONS[number][] {
  const { month, day } = localDate(now, timeZone);
  const today = month * 100 + day;
  return SEASONS.filter((s) => toggles[s.key] !== false && today >= s.from[0] * 100 + s.from[1] && today <= s.to[0] * 100 + s.to[1]);
}

export function seasonalEmits(input: LifecycleInput): LifecycleEmit[] {
  const seasons = activeSeasons(input.now, input.timeZone, input.seasonal);
  if (!seasons.length) return [];
  const { year } = localDate(input.now, input.timeZone);
  const active = [...lastPaidByCustomer(input)].filter(([, paidAt]) => ageMs(paidAt, input.now) <= ACTIVE_CUSTOMER_DAYS * DAY_MS).map(([id]) => id);
  const tagsById = new Map(input.customers.map((c) => [c.id, c.tags.map((t) => t.toLowerCase())]));
  return seasons.flatMap((season) => active
    .filter((customerId) => !season.tags || (tagsById.get(customerId) ?? []).some((t) => season.tags!.includes(t)))
    .map((customerId) => ({ name: season.event, customerId, discriminator: `${season.key}:${year}`, context: { due_service: season.label, store_link: `${input.siteBase ?? ''}/store`, planner_link: `${input.siteBase ?? ''}/build-planner` } })));
}

export function birthdayAndAnniversaryEmits(input: LifecycleInput): LifecycleEmit[] {
  const today = localDate(input.now, input.timeZone);
  const isLeap = new Date(Date.UTC(today.year, 1, 29)).getUTCMonth() === 1;
  const sameDay = (month: number, day: number) => month === today.month && (day === today.day || (!isLeap && month === 2 && day === 29 && today.day === 28));
  const out: LifecycleEmit[] = [];
  for (const customer of input.customers) {
    if (!customer.birthday) continue;
    const [, m, d] = customer.birthday.split('-').map(Number);
    if (m && d && sameDay(m, d)) out.push({ name: 'marketing.birthday', customerId: customer.id, discriminator: `birthday:${today.year}`, context: { due_service: 'a birthday thank-you' } });
  }
  const firstPaid = new Map<string, string>();
  for (const inv of input.paidInvoices) {
    const current = firstPaid.get(inv.customerId);
    if (!current || inv.paidAt < current) firstPaid.set(inv.customerId, inv.paidAt);
  }
  for (const [customerId, paidAt] of firstPaid) {
    const first = localDate(new Date(paidAt), input.timeZone);
    const years = today.year - first.year;
    if (years >= 1 && sameDay(first.month, first.day)) {
      out.push({ name: 'marketing.customer_anniversary', customerId, discriminator: `anniversary:${today.year}`, context: { due_service: `${years} year${years === 1 ? '' : 's'} with Lucky Diesel` } });
    }
  }
  return out;
}

export function abandonedPlanEmits(input: LifecycleInput): LifecycleEmit[] {
  return input.plannerLeads.flatMap((lead) => {
    if (!lead.customerId || !['new', 'contacted'].includes(lead.status) || !within(lead.createdAt, input.now, 5 * DAY_MS, 14 * DAY_MS)) return [];
    const bookedSince = input.appointments.some((a) => a.customerId === lead.customerId && a.createdAt >= lead.createdAt && a.status !== 'cancelled');
    return bookedSince ? [] : [{ name: 'marketing.build_plan_abandoned', customerId: lead.customerId, discriminator: lead.id, context: { due_service: 'your build plan' } }];
  });
}

export function checkoutClickEmits(input: LifecycleInput): LifecycleEmit[] {
  const latest = new Map<string, LifecycleInput['checkoutClicks'][number]>();
  for (const click of input.checkoutClicks) {
    const current = latest.get(click.customerId);
    if (!current || click.occurredAt > current.occurredAt) latest.set(click.customerId, click);
  }
  return [...latest.values()].flatMap((click) => {
    if (!within(click.occurredAt, input.now, 20 * HOUR_MS, 7 * DAY_MS)) return [];
    const convertedSince = input.appointments.some((a) => a.customerId === click.customerId && a.createdAt >= click.occurredAt)
      || input.paidInvoices.some((i) => i.customerId === click.customerId && i.paidAt >= click.occurredAt);
    return convertedSince ? [] : [{ name: 'marketing.store_checkout_click', customerId: click.customerId, discriminator: click.id, context: { due_service: 'the parts in your cart' } }];
  });
}

export function detractorEmits(input: LifecycleInput): LifecycleEmit[] {
  return input.detractors
    .filter((d) => within(d.respondedAt, input.now, 0, 7 * DAY_MS))
    .map((d) => ({ name: 'marketing.review_detractor', customerId: d.customerId, discriminator: d.id, context: {} }));
}

export function dynoInviteEmits(input: LifecycleInput): LifecycleEmit[] {
  const performance = new Set([
    ...input.tunes.map((t) => t.customerId),
    ...input.customers.filter((c) => c.tags.some((t) => ['performance', 'dyno', 'tuned'].includes(t.toLowerCase()))).map((c) => c.id),
  ]);
  return input.events.flatMap((event) => {
    const until = Date.parse(event.startsAt) - input.now.getTime();
    if (event.kind !== 'dyno_day' || until < 7 * DAY_MS || until > 21 * DAY_MS) return [];
    const when = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: input.timeZone }).format(new Date(event.startsAt));
    const registered = new Set(event.registeredCustomerIds);
    return [...performance].filter((id) => !registered.has(id)).map((customerId) => ({
      name: 'marketing.dyno_day_invite', customerId, discriminator: event.id, context: { due_service: `${event.name} on ${when}` },
    }));
  });
}

export function fleetPmEmits(input: LifecycleInput): LifecycleEmit[] {
  const { year } = localDate(input.now, input.timeZone);
  const week = Math.floor((input.now.getTime() - Date.UTC(year, 0, 1)) / (7 * DAY_MS));
  return input.fleets.flatMap((fleet) => {
    if (!fleet.contactCustomerId) return [];
    const members = new Set([fleet.contactCustomerId, ...fleet.memberCustomerIds]);
    const due = input.vehicles.filter((vehicle) => {
      if (!members.has(vehicle.customerId)) return false;
      const history = input.workOrders.filter((w) => w.vehicleId === vehicle.id).sort((a, b) => b.at.localeCompare(a.at));
      const last = history[0];
      if (!last) return false;
      if (ageMs(last.at, input.now) >= fleet.pmIntervalDays * DAY_MS) return true;
      const predicted = predictMileage(readingsFor(vehicle.id, input), input.now);
      return predicted !== null && last.mileageIn !== null && predicted - last.mileageIn >= fleet.pmIntervalMiles;
    });
    if (!due.length) return [];
    const labels = due.slice(0, 3).map((v) => v.label).join(', ') + (due.length > 3 ? ` +${due.length - 3} more` : '');
    return [{ name: 'marketing.fleet_pm_due', customerId: fleet.contactCustomerId, discriminator: `${fleet.id}:${year}-w${week}`, context: { due_service: `PM on ${due.length} unit${due.length === 1 ? '' : 's'}: ${labels}` } }];
  });
}

export function planLifecycleEmits(input: LifecycleInput): LifecycleEmit[] {
  return [
    ...detractorEmits(input),
    ...serviceDueEmits(input),
    ...tuneEmits(input),
    ...abandonedPlanEmits(input),
    ...checkoutClickEmits(input),
    ...birthdayAndAnniversaryEmits(input),
    ...fleetPmEmits(input),
    ...dynoInviteEmits(input),
    ...winBackEmits(input),
    ...seasonalEmits(input),
    ...retentionEmits(input),
  ];
}

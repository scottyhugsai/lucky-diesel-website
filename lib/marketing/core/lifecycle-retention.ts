/**
 * Retention rules added on top of the core lifecycle sweep: welcome series,
 * post-install check-ins, mileage asks, lost-lead re-engagement, warranties,
 * build anniversaries, known-issue education, next-stage ideas, parts
 * cross-sell and the portal nudge. Pure; the engine dedupes on discriminator.
 */

import { ageMs, lastPaidByCustomer, localDate, upcomingAppointmentCustomers, within, readingsFor, type LifecycleEmit, type LifecycleInput } from './lifecycle-rules';
import { isServiceDue, predictMileage } from './scoring';
import { categorizeService, type ServiceCategory } from './segment-rules';

const DAY_MS = 86_400_000;
const ACTIVE_CUSTOMER_DAYS = 730;
/** Daily sweeps can skip a day; each rule fires inside a short window and dedupes. */
const WINDOW_DAYS = 4;

const inWindow = (iso: string, now: Date, startDay: number, spanDays = WINDOW_DAYS) => within(iso, now, startDay * DAY_MS, (startDay + spanDays) * DAY_MS);

function firstPaidByCustomer(input: LifecycleInput): Map<string, string> {
  const first = new Map<string, string>();
  for (const inv of input.paidInvoices) {
    const current = first.get(inv.customerId);
    if (!current || inv.paidAt < current) first.set(inv.customerId, inv.paidAt);
  }
  return first;
}

export const WELCOME_STEPS: readonly { day: number; name: string }[] = [
  { day: 0, name: 'marketing.welcome_1' },
  { day: 7, name: 'marketing.welcome_2' },
  { day: 30, name: 'marketing.welcome_3' },
];

/** New customer welcome series: day 0, 7 and 30 after the first paid invoice. */
export function welcomeEmits(input: LifecycleInput): LifecycleEmit[] {
  return [...firstPaidByCustomer(input)].flatMap(([customerId, paidAt]) => {
    const step = WELCOME_STEPS.find((s) => inWindow(paidAt, input.now, s.day, s.day === 0 ? 3 : WINDOW_DAYS));
    return step ? [{ name: step.name, customerId, discriminator: `welcome:${step.day}`, context: { due_service: 'your first visit' } }] : [];
  });
}

export const INSTALL_FOLLOW_UPS: Partial<Record<ServiceCategory, { days: number; detail: string }>> = {
  injectors: { days: 7, detail: 'the new injectors (watch for rough idle or smoke)' },
  fuel: { days: 10, detail: 'the fuel system work (listen for pump noise, watch fuel pressure)' },
  turbo: { days: 14, detail: 'the new turbo (let it cool a minute after hard pulls)' },
  transmission: { days: 21, detail: 'the transmission work (check for slips or flare when towing)' },
  head_studs: { days: 30, detail: 'the head stud job (keep an eye on coolant level and temps)' },
  engine: { days: 30, detail: 'the engine work (break-in done? time for an oil sample)' },
};

/** Post-install check-in, timed per job type. One per job. */
export function installFollowUpEmits(input: LifecycleInput): LifecycleEmit[] {
  return input.workOrders.flatMap((job) => {
    const category = categorizeService(job.title).find((c) => INSTALL_FOLLOW_UPS[c]);
    const plan = category ? INSTALL_FOLLOW_UPS[category] : undefined;
    if (!category || !plan || !inWindow(job.at, input.now, plan.days)) return [];
    return [{ name: 'marketing.install_follow_up', customerId: job.customerId, discriminator: `install:${job.id ?? `${job.vehicleId}:${job.at.slice(0, 10)}`}`, context: { vehicle_id: job.vehicleId, due_service: plan.detail } }];
  });
}

const MILEAGE_ASK_LEAD_DAYS = 7;
const FRESH_READING_DAYS = 30;

/** “Reply with your mileage”: asks a week before the predicted due date, unless a fresh reading exists. */
export function mileageAskEmits(input: LifecycleInput): LifecycleEmit[] {
  const booked = upcomingAppointmentCustomers(input);
  const soon = new Date(input.now.getTime() + MILEAGE_ASK_LEAD_DAYS * DAY_MS);
  return input.vehicles.flatMap((vehicle) => {
    if (booked.has(vehicle.customerId)) return [];
    if (vehicle.mileageUpdatedAt && ageMs(vehicle.mileageUpdatedAt, input.now) < FRESH_READING_DAYS * DAY_MS) return [];
    const last = input.workOrders
      .filter((w) => w.vehicleId === vehicle.id && w.mileageIn && categorizeService(w.title).includes('maintenance'))
      .sort((a, b) => b.at.localeCompare(a.at))[0];
    if (!last) return [];
    const readings = readingsFor(vehicle.id, input);
    if (isServiceDue(predictMileage(readings, input.now), last.mileageIn) || !isServiceDue(predictMileage(readings, soon), last.mileageIn)) return [];
    return [{ name: 'marketing.mileage_ask', customerId: vehicle.customerId, discriminator: `mileage-ask:${vehicle.id}:${last.mileageIn}`, context: { vehicle_id: vehicle.id, due_service: 'its next oil and filter service' } }];
  });
}

/** Lost leads get one gentle note at 60 and 120 days, unless they booked or paid since. */
export function lostLeadEmits(input: LifecycleInput): LifecycleEmit[] {
  return (input.lostLeads ?? []).flatMap((lead) => {
    if (!lead.customerId) return [];
    const bucket = inWindow(lead.createdAt, input.now, 60, 7) ? 60 : inWindow(lead.createdAt, input.now, 120, 7) ? 120 : null;
    if (!bucket) return [];
    const convertedSince = input.appointments.some((a) => a.customerId === lead.customerId && a.createdAt >= lead.createdAt && a.status !== 'cancelled')
      || input.paidInvoices.some((i) => i.customerId === lead.customerId && i.paidAt >= lead.createdAt);
    return convertedSince ? [] : [{ name: `marketing.lost_lead_${bucket}`, customerId: lead.customerId, discriminator: `lost:${lead.id}`, context: { due_service: 'your truck' } }];
  });
}

/** Parts warranty ends in about 30 days: offer a check while it's covered. */
export function warrantyEmits(input: LifecycleInput): LifecycleEmit[] {
  return (input.buildItems ?? []).flatMap((item) => {
    if (!item.warrantyUntil) return [];
    const until = Date.parse(`${item.warrantyUntil}T12:00:00Z`) - input.now.getTime();
    if (until < 23 * DAY_MS || until > 31 * DAY_MS) return [];
    const date = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${item.warrantyUntil}T12:00:00Z`));
    return [{ name: 'marketing.warranty_expiring', customerId: item.customerId, discriminator: `warranty:${item.id}`, context: { vehicle_id: item.vehicleId, due_service: `a check on the ${item.partName} before its warranty ends ${date}` } }];
  });
}

/** Yearly on the first install date of a truck's build. */
export function buildAnniversaryEmits(input: LifecycleInput): LifecycleEmit[] {
  const today = localDate(input.now, input.timeZone);
  const firstInstall = new Map<string, { customerId: string; date: string }>();
  for (const item of input.buildItems ?? []) {
    if (!item.installedAt) continue;
    const current = firstInstall.get(item.vehicleId);
    if (!current || item.installedAt < current.date) firstInstall.set(item.vehicleId, { customerId: item.customerId, date: item.installedAt });
  }
  return [...firstInstall].flatMap(([vehicleId, { customerId, date }]) => {
    const [year, month, day] = date.split('-').map(Number);
    const years = today.year - (year ?? today.year);
    if (years < 1 || month !== today.month || day !== today.day) return [];
    return [{ name: 'marketing.build_anniversary', customerId, discriminator: `build-anniv:${vehicleId}:${today.year}`, context: { vehicle_id: vehicleId, due_service: `${years} year${years === 1 ? '' : 's'} since the build started` } }];
  });
}

export interface KnownIssue { key: string; test: (v: { platform: string; engine: string; year: number | null }) => boolean; topic: string }

/** Owner education only: repair and prevention, never emissions changes. */
export const KNOWN_ISSUES: readonly KnownIssue[] = [
  { key: 'lb7_injectors', test: (v) => /\bLB7\b/i.test(v.engine), topic: 'injector wear on the LB7 Duramax' },
  { key: 'lml_cp4', test: (v) => /\bLML\b/i.test(v.engine), topic: 'the CP4.2 fuel pump on the LML Duramax' },
  { key: 'ps60_head', test: (v) => v.platform === 'powerstroke' && /\b6\.0\b/.test(v.engine), topic: 'head studs, oil cooler and coolant health on the 6.0 Power Stroke' },
  { key: 'ps64_cooling', test: (v) => v.platform === 'powerstroke' && /\b6\.4\b/.test(v.engine), topic: 'radiator and fuel-in-oil checks on the 6.4 Power Stroke' },
  { key: 'ps67_cp4', test: (v) => v.platform === 'powerstroke' && /\b6\.7\b/.test(v.engine) && v.year !== null && v.year <= 2019, topic: 'the CP4.2 fuel pump on the 2011–2019 6.7 Power Stroke' },
];

export function knownIssueFor(vehicle: { platform?: string | null; generation?: string | null; engineCode?: string | null; label: string }): KnownIssue | null {
  const engine = [vehicle.engineCode, vehicle.generation, vehicle.label].filter(Boolean).join(' ');
  const year = Number(/\b(19|20)\d{2}\b/.exec(vehicle.label)?.[0] ?? NaN);
  return KNOWN_ISSUES.find((issue) => issue.test({ platform: (vehicle.platform ?? '').toLowerCase(), engine, year: Number.isFinite(year) ? year : null })) ?? null;
}

/** Once per truck: what to watch on this platform. Active customers, trucks on file two weeks or more. */
export function knownIssueEmits(input: LifecycleInput): LifecycleEmit[] {
  const lastPaid = lastPaidByCustomer(input);
  return input.vehicles.flatMap((vehicle) => {
    const paidAt = lastPaid.get(vehicle.customerId);
    if (!paidAt || ageMs(paidAt, input.now) > ACTIVE_CUSTOMER_DAYS * DAY_MS || ageMs(vehicle.createdAt, input.now) < 14 * DAY_MS) return [];
    const issue = knownIssueFor(vehicle);
    return issue ? [{ name: 'marketing.known_issue', customerId: vehicle.customerId, discriminator: `issue:${vehicle.id}:${issue.key}`, context: { vehicle_id: vehicle.id, due_service: issue.topic } }] : [];
  });
}

export const NEXT_STAGE: Partial<Record<ServiceCategory, string>> = {
  tune: 'transmission tuning and fuel supply to match the tune',
  turbo: 'injectors matched to the turbo and a dyno check',
  injectors: 'a matched turbo and a tune revision check',
};

/** 60 days after a performance job with nothing since: suggest the next compliant stage. */
export function nextStageEmits(input: LifecycleInput): LifecycleEmit[] {
  return input.workOrders.flatMap((job) => {
    const category = categorizeService(job.title).find((c) => NEXT_STAGE[c]);
    if (!category || !inWindow(job.at, input.now, 60, 7)) return [];
    if (input.workOrders.some((w) => w.vehicleId === job.vehicleId && w.at > job.at)) return [];
    return [{ name: 'marketing.next_stage', customerId: job.customerId, discriminator: `next-stage:${job.id ?? `${job.vehicleId}:${job.at.slice(0, 10)}`}`, context: { vehicle_id: job.vehicleId, due_service: NEXT_STAGE[category]! } }];
  });
}

const STORE_PLATFORMS = new Set(['duramax', 'powerstroke', 'cummins']);

/** Two weeks after a maintenance job: filters and fluids for their platform. */
export function crossSellEmits(input: LifecycleInput): LifecycleEmit[] {
  const siteBase = input.siteBase ?? '';
  return input.workOrders.flatMap((job) => {
    if (!categorizeService(job.title).includes('maintenance') || !inWindow(job.at, input.now, 14)) return [];
    const platform = (input.vehicles.find((v) => v.id === job.vehicleId)?.platform ?? '').toLowerCase();
    const storeLink = `${siteBase}/store/products${STORE_PLATFORMS.has(platform) ? `?platform=${platform}` : ''}`;
    return [{ name: 'marketing.parts_cross_sell', customerId: job.customerId, discriminator: `cross-sell:${job.id ?? `${job.vehicleId}:${job.at.slice(0, 10)}`}`, context: { vehicle_id: job.vehicleId, due_service: 'filters and fluids for next time', store_link: storeLink } }];
  });
}

/** Portal login never used: nudge 2 and 7 days after their first job. */
export function portalNudgeEmits(input: LifecycleInput): LifecycleEmit[] {
  const never = new Set(input.portalNeverSignedIn ?? []);
  if (!never.size) return [];
  const firstJob = new Map<string, string>();
  for (const job of input.workOrders) {
    if (!never.has(job.customerId)) continue;
    const current = firstJob.get(job.customerId);
    if (!current || job.at < current) firstJob.set(job.customerId, job.at);
  }
  return [...firstJob].flatMap(([customerId, at]) => {
    const day = inWindow(at, input.now, 2, 2) ? 2 : inWindow(at, input.now, 7, 3) ? 7 : null;
    return day ? [{ name: 'marketing.portal_nudge', customerId, discriminator: `portal:${day}`, context: { due_service: 'your truck’s service history' } }] : [];
  });
}

export function retentionEmits(input: LifecycleInput): LifecycleEmit[] {
  return [
    ...welcomeEmits(input),
    ...installFollowUpEmits(input),
    ...mileageAskEmits(input),
    ...lostLeadEmits(input),
    ...warrantyEmits(input),
    ...buildAnniversaryEmits(input),
    ...knownIssueEmits(input),
    ...nextStageEmits(input),
    ...crossSellEmits(input),
    ...portalNudgeEmits(input),
  ];
}

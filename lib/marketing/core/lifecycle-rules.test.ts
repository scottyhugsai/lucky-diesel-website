import { describe, expect, test } from 'vitest';
import {
  abandonedPlanEmits, activeSeasons, birthdayAndAnniversaryEmits, checkoutClickEmits, detractorEmits, dynoInviteEmits, fleetPmEmits,
  planLifecycleEmits, seasonalEmits, serviceDueEmits, tuneEmits, winBackEmits, type LifecycleInput,
} from './lifecycle-rules';

const now = new Date('2026-09-17T15:00:00Z');
const ago = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
const ahead = (days: number) => new Date(now.getTime() + days * 86_400_000).toISOString();

function input(patch: Partial<LifecycleInput> = {}): LifecycleInput {
  return {
    now, timeZone: 'America/New_York', winbackMonths: [6, 12], seasonal: { towing_season: true, winter_diesel: true, hurricane_prep: true },
    customers: [], paidInvoices: [], vehicles: [], workOrders: [], tunes: [], plannerLeads: [], appointments: [], checkoutClicks: [],
    detractors: [], events: [], fleets: [], ...patch,
  };
}

describe('win-back', () => {
  test('6 and 12 month buckets, skipping recent, very old and booked customers', () => {
    const emits = winBackEmits(input({
      paidInvoices: [
        { customerId: 'six', paidAt: ago(200) }, { customerId: 'twelve', paidAt: ago(400) }, { customerId: 'recent', paidAt: ago(30) },
        { customerId: 'ancient', paidAt: ago(900) }, { customerId: 'booked', paidAt: ago(250) },
        { customerId: 'six', paidAt: ago(500) },
      ],
      appointments: [{ customerId: 'booked', createdAt: ago(1), startsAt: ahead(3), status: 'scheduled' }],
    }));
    expect(emits.map((e) => [e.customerId, e.name])).toEqual([['six', 'marketing.win_back_6m'], ['twelve', 'marketing.win_back_12m']]);
    expect(emits[0]!.discriminator).toBe(`6m:${ago(200).slice(0, 10)}`);
  });
});

describe('mileage-based service due', () => {
  const vehicles = [{ id: 'v1', customerId: 'c1', mileage: null, createdAt: ago(400), label: '2019 Ram 2500' }];
  test('predicts miles from job history and emits service.due near the interval', () => {
    const emits = serviceDueEmits(input({
      vehicles,
      workOrders: [
        { customerId: 'c1', vehicleId: 'v1', title: 'Maintenance service', mileageIn: 80_000, at: ago(120) },
        { customerId: 'c1', vehicleId: 'v1', title: 'Diagnostics', mileageIn: 74_000, at: ago(300) },
      ],
    }));
    // 6,000 mi over 180 days ≈ 1,015 mi/month → ~84,000 now: not due yet (needs 7,000).
    expect(emits).toEqual([]);
    const due = serviceDueEmits(input({
      vehicles,
      workOrders: [
        { customerId: 'c1', vehicleId: 'v1', title: 'Maintenance service', mileageIn: 80_000, at: ago(200) },
        { customerId: 'c1', vehicleId: 'v1', title: 'Turbo', mileageIn: 70_000, at: ago(400) },
      ],
    }));
    expect(due).toHaveLength(1);
    expect(due[0]).toMatchObject({ name: 'service.due', customerId: 'c1', discriminator: 'mileage:v1:80000' });
    expect(due[0]!.context.vehicle_id).toBe('v1');
    expect(String(due[0]!.context.due_service)).toContain('oil & fuel filter');
  });

  test('never emits without a previous maintenance reading', () => {
    expect(serviceDueEmits(input({ vehicles, workOrders: [{ customerId: 'c1', vehicleId: 'v1', title: 'Turbo', mileageIn: 10_000, at: ago(700) }] }))).toEqual([]);
  });
});

describe('tune, planner, checkout and detractor follow-ups', () => {
  test('tune check-in at 3–10 days and dyno re-check at 30–45 days', () => {
    const emits = tuneEmits(input({ tunes: [
      { id: 't1', customerId: 'a', vehicleId: 'v', flashedAt: ago(4) },
      { id: 't2', customerId: 'b', vehicleId: 'v', flashedAt: ago(35) },
      { id: 't3', customerId: 'c', vehicleId: 'v', flashedAt: ago(1) },
    ] }));
    expect(emits.map((e) => e.name)).toEqual(['marketing.tune_follow_up', 'marketing.dyno_recheck']);
  });

  test('abandoned build plans: open planner leads 5–14 days old with no booking since', () => {
    const emits = abandonedPlanEmits(input({
      plannerLeads: [
        { id: 'l1', customerId: 'a', createdAt: ago(6), status: 'new' },
        { id: 'l2', customerId: 'b', createdAt: ago(6), status: 'booked' },
        { id: 'l3', customerId: 'c', createdAt: ago(6), status: 'contacted' },
        { id: 'l4', customerId: 'd', createdAt: ago(2), status: 'new' },
      ],
      appointments: [{ customerId: 'c', createdAt: ago(3), startsAt: ahead(2), status: 'scheduled' }],
    }));
    expect(emits.map((e) => e.discriminator)).toEqual(['l1']);
  });

  test('checkout clicks: latest per customer, 20h–7d old, not converted since', () => {
    const emits = checkoutClickEmits(input({
      checkoutClicks: [
        { id: 'k1', customerId: 'a', occurredAt: ago(3) }, { id: 'k2', customerId: 'a', occurredAt: ago(2) },
        { id: 'k3', customerId: 'b', occurredAt: ago(0.2) }, { id: 'k4', customerId: 'c', occurredAt: ago(2) },
      ],
      paidInvoices: [{ customerId: 'c', paidAt: ago(1) }],
    }));
    expect(emits.map((e) => e.discriminator)).toEqual(['k2']);
  });

  test('detractors within a week', () => {
    expect(detractorEmits(input({ detractors: [{ id: 'n1', customerId: 'a', respondedAt: ago(1) }, { id: 'n2', customerId: 'b', respondedAt: ago(9) }] })).map((e) => e.discriminator)).toEqual(['n1']);
  });
});

describe('calendar rules', () => {
  test('seasonal windows overlap where the calendar overlaps, and toggles switch one off', () => {
    const tz = 'America/New_York';
    expect(activeSeasons(new Date('2026-03-10T15:00:00Z'), tz, {}).map((s) => s.key)).toEqual(['towing_season', 'tax_refund']);
    expect(activeSeasons(new Date('2026-06-01T15:00:00Z'), tz, {}).map((s) => s.key)).toEqual(['hurricane_prep']);
    expect(activeSeasons(new Date('2026-11-30T15:00:00Z'), tz, {}).map((s) => s.key)).toEqual(['winter_diesel', 'holiday_parts']);
    expect(activeSeasons(new Date('2026-11-30T15:00:00Z'), tz, { winter_diesel: false }).map((s) => s.key)).toEqual(['holiday_parts']);
    expect(activeSeasons(now, tz, {}).map((s) => s.key)).toEqual(['hunting_season']);
    expect(activeSeasons(now, tz, { hunting_season: false })).toEqual([]);
  });

  test('seasonal emits go to customers active in the last two years, once per year', () => {
    const emits = seasonalEmits(input({ now: new Date('2026-10-20T15:00:00Z'), paidInvoices: [{ customerId: 'a', paidAt: '2026-05-01T00:00:00Z' }, { customerId: 'b', paidAt: '2023-01-01T00:00:00Z' }] }));
    expect(emits).toEqual([{ name: 'marketing.seasonal.winter_diesel', customerId: 'a', discriminator: 'winter_diesel:2026', context: { due_service: 'a cold-start and fuel system check', store_link: '/store', planner_link: '/build-planner' } }]);
  });

  test('birthdays (local date) and first-visit anniversaries', () => {
    const emits = birthdayAndAnniversaryEmits(input({
      customers: [{ id: 'bday', birthday: '1988-09-17', tags: [] }, { id: 'other', birthday: '1990-01-02', tags: [] }],
      paidInvoices: [{ customerId: 'anniv', paidAt: '2024-09-17T16:00:00Z' }, { customerId: 'anniv', paidAt: '2025-01-01T16:00:00Z' }, { customerId: 'new', paidAt: '2026-09-17T13:00:00Z' }],
    }));
    expect(emits.map((e) => [e.name, e.customerId])).toEqual([['marketing.birthday', 'bday'], ['marketing.customer_anniversary', 'anniv']]);
    expect(emits[1]!.context.due_service).toBe('2 years with Lucky Diesel');
  });

  test('Feb 29 birthdays are celebrated on Feb 28 in non-leap years', () => {
    const emits = birthdayAndAnniversaryEmits(input({ now: new Date('2027-02-28T15:00:00Z'), customers: [{ id: 'leap', birthday: '1992-02-29', tags: [] }] }));
    expect(emits.map((e) => e.customerId)).toEqual(['leap']);
  });
});

describe('dyno days and fleets', () => {
  test('invites tuned or performance-tagged customers 7–21 days out, not already registered', () => {
    const emits = dynoInviteEmits(input({
      tunes: [{ id: 't', customerId: 'tuned', vehicleId: 'v', flashedAt: ago(100) }, { id: 't2', customerId: 'registered', vehicleId: 'v2', flashedAt: ago(100) }],
      customers: [{ id: 'tagged', birthday: null, tags: ['Performance'] }, { id: 'plain', birthday: null, tags: [] }],
      events: [
        { id: 'e1', name: 'Fall Dyno Day', kind: 'dyno_day', startsAt: ahead(14), registeredCustomerIds: ['registered'] },
        { id: 'e2', name: 'Open House', kind: 'open_house', startsAt: ahead(14), registeredCustomerIds: [] },
        { id: 'e3', name: 'Far Dyno Day', kind: 'dyno_day', startsAt: ahead(60), registeredCustomerIds: [] },
      ],
    }));
    expect(emits.map((e) => e.customerId).sort()).toEqual(['tagged', 'tuned']);
    expect(String(emits[0]!.context.due_service)).toMatch(/^Fall Dyno Day on \w{3}, Oct 1$/);
  });

  test('fleet PM digest lists due units to the fleet contact once a week', () => {
    const emits = fleetPmEmits(input({
      fleets: [{ id: 'f1', contactCustomerId: 'mgr', pmIntervalMiles: 10_000, pmIntervalDays: 90, memberCustomerIds: ['driver'] }],
      vehicles: [
        { id: 'v1', customerId: 'driver', mileage: null, createdAt: ago(300), label: '2020 Ram 3500' },
        { id: 'v2', customerId: 'mgr', mileage: null, createdAt: ago(300), label: '2021 F-350' },
        { id: 'v3', customerId: 'stranger', mileage: null, createdAt: ago(300), label: 'Not in fleet' },
      ],
      workOrders: [
        { customerId: 'driver', vehicleId: 'v1', title: 'Maintenance service', mileageIn: 40_000, at: ago(120) },
        { customerId: 'mgr', vehicleId: 'v2', title: 'Maintenance service', mileageIn: 20_000, at: ago(10) },
        { customerId: 'stranger', vehicleId: 'v3', title: 'Maintenance service', mileageIn: 20_000, at: ago(400) },
      ],
    }));
    expect(emits).toHaveLength(1);
    expect(emits[0]).toMatchObject({ name: 'marketing.fleet_pm_due', customerId: 'mgr', context: { due_service: 'PM on 1 unit: 2020 Ram 3500' } });
  });

  test('planLifecycleEmits combines every rule', () => {
    expect(planLifecycleEmits(input({ detractors: [{ id: 'n', customerId: 'a', respondedAt: ago(1) }], paidInvoices: [{ customerId: 'b', paidAt: ago(200) }] })).map((e) => e.name))
      .toEqual(['marketing.review_detractor', 'marketing.win_back_6m']);
  });
});

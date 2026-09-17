import 'server-only';
import type { Tables } from '@/lib/db/database.types';
import { money } from '@/lib/format';
import type { createAdminClient } from '@/lib/supabase/admin';
import { buildFleetReport, reportEmailBody, type FleetReport, type ReportInvoice, type ReportJob, type ReportTruck } from './fleet-math';

type Db = ReturnType<typeof createAdminClient>;
const DAY_MS = 86_400_000;

export interface FleetDetail {
  fleet: Tables<'fleet_accounts'>;
  members: { id: string; name: string; email: string | null }[];
  trucks: (ReportTruck & { owner: string; lastService: string | null })[];
  jobs: (ReportJob & { id: string; number: number; title: string; truck: string })[];
  invoices: ReportInvoice[];
}

function truckLabel(v: { year: number | null; make: string | null; model: string | null; nickname: string | null }): string {
  return v.nickname || [v.year, v.make, v.model].filter(Boolean).join(' ') || 'Truck';
}

/** Everything the fleet detail page, proposal and monthly report need, in four bounded queries. */
export async function loadFleetDetail(db: Db, fleetId: string, now = new Date()): Promise<FleetDetail | null> {
  const { data: fleet } = await db.from('fleet_accounts').select('*').eq('id', fleetId).maybeSingle();
  if (!fleet) return null;
  const { data: customers } = await db.from('customers').select('id, full_name, email, vehicles(id, year, make, model, nickname)').eq('fleet_account_id', fleetId).limit(200);
  const members = customers ?? [];
  const memberIds = members.map((c) => c.id);
  const since = new Date(now.getTime() - 400 * DAY_MS).toISOString();
  const [{ data: orders }, { data: invoices }] = memberIds.length
    ? await Promise.all([
        db.from('work_orders').select('id, number, title, vehicle_id, status, created_at, completed_at').in('customer_id', memberIds).gte('created_at', since).order('created_at', { ascending: false }).limit(1000),
        db.from('invoices').select('id, number, total_cents, status, created_at, due_at, paid_at').in('customer_id', memberIds).gte('created_at', since).order('created_at', { ascending: false }).limit(1000),
      ])
    : [{ data: [] }, { data: [] }];

  const lastByVehicle = new Map<string, string>();
  for (const o of orders ?? []) {
    if (o.status === 'cancelled') continue;
    const when = o.completed_at ?? o.created_at;
    const current = lastByVehicle.get(o.vehicle_id);
    if (!current || when > current) lastByVehicle.set(o.vehicle_id, when);
  }
  const labels = new Map<string, string>();
  const trucks = members.flatMap((c) => c.vehicles.map((v) => {
    const label = truckLabel(v);
    labels.set(v.id, label);
    const last = lastByVehicle.get(v.id) ?? null;
    const nextDue = last ? new Date(Date.parse(last) + fleet.pm_interval_days * DAY_MS).toISOString() : null;
    return { id: v.id, label, owner: c.full_name, lastService: last, nextDue, overdue: !nextDue || Date.parse(nextDue) < now.getTime() };
  }));

  return {
    fleet,
    members: members.map((c) => ({ id: c.id, name: c.full_name, email: c.email })),
    trucks,
    jobs: (orders ?? []).map((o) => ({ id: o.id, number: o.number, title: o.title, truck: labels.get(o.vehicle_id) ?? 'Truck', vehicleId: o.vehicle_id, createdAt: o.created_at, completedAt: o.completed_at, status: o.status, totalCents: 0 })),
    invoices: (invoices ?? []).map((i) => ({ id: i.id, number: i.number, totalCents: i.total_cents, status: i.status, createdAt: i.created_at, dueAt: i.due_at, paidAt: i.paid_at })),
  };
}

export function reportFor(detail: FleetDetail, from: Date, to: Date, now = new Date()): FleetReport {
  return buildFleetReport({ jobs: detail.jobs, invoices: detail.invoices, trucks: detail.trucks }, from, to, now);
}

export function reportText(detail: FleetDetail, periodLabel: string, report: FleetReport): string {
  return reportEmailBody(detail.fleet.name, periodLabel, report, (c) => money(c));
}

/** Where a fleet's report goes: the account email, else the contact customer's email. */
export async function fleetRecipient(db: Db, fleet: Pick<Tables<'fleet_accounts'>, 'email' | 'contact_customer_id' | 'contact_name' | 'name'>): Promise<{ email: string | null; customerId: string | null; firstName: string }> {
  let email = fleet.email;
  if (!email && fleet.contact_customer_id) {
    const { data } = await db.from('customers').select('email').eq('id', fleet.contact_customer_id).maybeSingle();
    email = data?.email ?? null;
  }
  return { email, customerId: fleet.contact_customer_id, firstName: fleet.contact_name?.split(' ')[0] || 'there' };
}

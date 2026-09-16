import 'server-only';
import type { Tables } from '@/lib/db/database.types';
import { money } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import { needsAcknowledgement } from './acknowledgement';
import type { ActionItem } from './ActionBand';

const CLOSED = new Set(['paid', 'cancelled']);

export type GarageJob = Pick<Tables<'work_orders'>, 'id' | 'number' | 'status' | 'title' | 'vehicle_id' | 'promised_at' | 'created_at'>;

/** Everything on the garage overview, read as the signed-in customer (RLS). */
export async function loadGarage(customerId: string) {
  const supabase = await createClient();
  const [vehicles, jobs, invoices, appointments, dyno] = await Promise.all([
    supabase.from('vehicles').select('*').eq('customer_id', customerId).order('created_at'),
    supabase.from('work_orders').select('id, number, status, title, vehicle_id, promised_at, created_at').eq('customer_id', customerId).order('created_at', { ascending: false }),
    supabase.from('invoices').select('id, number, total_cents, due_at, work_order_id').eq('customer_id', customerId).eq('status', 'open').order('created_at'),
    supabase.from('appointments').select('*').eq('customer_id', customerId).in('status', ['scheduled', 'confirmed']).gte('starts_at', new Date().toISOString()).order('starts_at').limit(1),
    supabase.from('dyno_runs').select('vehicle_id, horsepower, torque, is_baseline, run_at').order('run_at', { ascending: false }),
  ]);

  const activeJobs: GarageJob[] = (jobs.data ?? []).filter((job) => !CLOSED.has(job.status));
  const activeIds = activeJobs.map((job) => job.id);
  const [lines, acks] = activeIds.length
    ? await Promise.all([
        supabase.from('line_items').select('work_order_id, description').in('work_order_id', activeIds),
        supabase.from('acknowledgements').select('work_order_id').in('work_order_id', activeIds),
      ])
    : [{ data: [] }, { data: [] }];

  const signed = new Set((acks.data ?? []).map((ack) => ack.work_order_id));
  const actions: ActionItem[] = [];
  for (const job of activeJobs) {
    if (job.status === 'awaiting_approval') {
      actions.push({ key: `approve-${job.id}`, kind: 'approve', title: 'Your estimate is ready', detail: `Job #${job.number} · ${job.title}. Review the inspection photos and approve what you want done.`, href: `/portal/jobs/${job.id}#estimate`, cta: 'Review & approve' });
    }
    const descriptions = (lines.data ?? []).filter((line) => line.work_order_id === job.id).map((line) => line.description);
    if (job.status !== 'estimate' && !signed.has(job.id) && needsAcknowledgement(job.title, descriptions)) {
      actions.push({ key: `sign-${job.id}`, kind: 'sign', title: 'Sign the performance acknowledgement', detail: `Required before we start tuning, exhaust or turbo work on job #${job.number}.`, href: `/portal/jobs/${job.id}#acknowledgement`, cta: 'Read & sign' });
    }
  }
  for (const invoice of invoices.data ?? []) {
    actions.push({ key: `pay-${invoice.id}`, kind: 'pay', title: `Invoice #${invoice.number} is due`, detail: `${money(invoice.total_cents)} — pay online and skip the counter.`, href: `/portal/invoices/${invoice.id}`, cta: `Pay ${money(invoice.total_cents)}` });
  }
  const order = { approve: 0, pay: 1, sign: 2 } as const;
  actions.sort((a, b) => order[a.kind] - order[b.kind]);

  const latestDyno = new Map<string, { horsepower: number | null; torque: number | null }>();
  for (const run of dyno.data ?? []) {
    if (!run.is_baseline && !latestDyno.has(run.vehicle_id)) latestDyno.set(run.vehicle_id, run);
  }

  return {
    vehicles: vehicles.data ?? [],
    activeJobs,
    actions,
    nextAppointment: appointments.data?.[0] ?? null,
    latestDyno,
  };
}

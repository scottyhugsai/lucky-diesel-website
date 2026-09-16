import 'server-only';
import { createClient } from '@/lib/supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A truck's full record, read as the signed-in customer. Null when it isn't theirs. */
export async function loadTruck(id: string, customerId: string) {
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  const { data: vehicle } = await supabase.from('vehicles').select('*').eq('id', id).eq('customer_id', customerId).maybeSingle();
  if (!vehicle) return null;

  const [dyno, tunes, build, jobs] = await Promise.all([
    supabase.from('dyno_runs').select('*').eq('vehicle_id', id).order('run_at'),
    supabase.from('tune_records').select('*').eq('vehicle_id', id).order('flashed_at', { ascending: false }),
    supabase.from('build_items').select('*').eq('vehicle_id', id).order('installed_at', { ascending: false }),
    supabase.from('work_orders').select('id, number, title, status, mileage_in, completed_at, created_at').eq('vehicle_id', id).in('status', ['paid', 'invoiced']).order('created_at', { ascending: false }),
  ]);
  const jobIds = (jobs.data ?? []).map((job) => job.id);
  const { data: invoices } = jobIds.length
    ? await supabase.from('invoices').select('work_order_id, total_cents, status').in('work_order_id', jobIds)
    : { data: [] };

  const runs = dyno.data ?? [];
  const baseline = [...runs].reverse().find((run) => run.is_baseline) ?? null;
  const after = [...runs].reverse().find((run) => !run.is_baseline) ?? null;

  const categories = new Map<string, NonNullable<typeof build.data>>();
  for (const item of build.data ?? []) categories.set(item.category, [...(categories.get(item.category) ?? []), item]);

  return {
    vehicle,
    runs,
    baseline,
    after,
    tunes: tunes.data ?? [],
    buildGroups: [...categories.entries()],
    jobs: jobs.data ?? [],
    invoiceByJob: new Map((invoices ?? []).map((invoice) => [invoice.work_order_id, invoice])),
  };
}

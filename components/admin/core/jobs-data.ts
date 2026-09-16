import 'server-only';
import type { Enums } from '@/lib/db/database.types';
import { vehicleLabel } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import { computeTotals } from '@/lib/work-orders/totals';

type Status = Enums<'work_order_status'>;

export const BOARD_COLUMNS: readonly { key: string; label: string; statuses: Status[] }[] = [
  { key: 'estimate', label: 'Estimate', statuses: ['estimate'] },
  { key: 'awaiting_approval', label: 'Awaiting approval', statuses: ['awaiting_approval'] },
  { key: 'approved', label: 'Approved', statuses: ['approved'] },
  { key: 'in_progress', label: 'In progress', statuses: ['in_progress'] },
  { key: 'waiting_parts', label: 'Waiting parts', statuses: ['waiting_parts'] },
  { key: 'quality_check', label: 'Quality check', statuses: ['quality_check'] },
  { key: 'ready', label: 'Ready / invoiced', statuses: ['ready', 'invoiced'] },
];

export interface JobSummary {
  id: string;
  number: number;
  title: string;
  status: Status;
  bay: string | null;
  createdAt: string;
  promisedAt: string | null;
  isOverdue: boolean;
  customerName: string;
  truck: string;
  vin: string | null;
  tech: { name: string; color: string } | null;
  totalCents: number;
}

const LIST_LIMIT = 400;
const OPEN_STATUSES = new Set<Status>(['estimate', 'awaiting_approval', 'approved', 'in_progress', 'waiting_parts', 'quality_check']);

export async function loadJobs({ boardOnly }: { boardOnly: boolean }): Promise<JobSummary[]> {
  const supabase = await createClient();
  let query = supabase
    .from('work_orders')
    .select('id, number, title, status, bay, created_at, promised_at, customers(full_name), vehicles(year, make, model, engine_code, vin), profiles(full_name, avatar_color), line_items(kind, quantity, unit_price_cents, taxable, approval)')
    .order('created_at', { ascending: false })
    .limit(LIST_LIMIT);
  if (boardOnly) query = query.not('status', 'in', '(paid,cancelled)');

  const [{ data, error }, { data: settings }] = await Promise.all([query, supabase.from('shop_settings').select('tax_rate').eq('id', 1).maybeSingle()]);
  if (error) throw new Error(`Could not load jobs: ${error.message}`);
  const taxRate = Number(settings?.tax_rate ?? 0);
  const now = Date.now();

  return (data ?? []).map((wo) => ({
    id: wo.id,
    number: wo.number,
    title: wo.title,
    status: wo.status,
    bay: wo.bay,
    createdAt: wo.created_at,
    promisedAt: wo.promised_at,
    isOverdue: Boolean(wo.promised_at && new Date(wo.promised_at).getTime() < now && OPEN_STATUSES.has(wo.status)),
    customerName: wo.customers?.full_name ?? 'Unknown customer',
    truck: vehicleLabel(wo.vehicles),
    vin: wo.vehicles?.vin ?? null,
    tech: wo.profiles ? { name: wo.profiles.full_name, color: wo.profiles.avatar_color } : null,
    totalCents: computeTotals(wo.line_items.filter((l) => l.approval !== 'declined'), taxRate).totalCents,
  }));
}

export function filterJobs(jobs: JobSummary[], q: string, status: Status | null): JobSummary[] {
  const needle = q.trim().toLowerCase().replace(/^#/, '');
  return jobs.filter((job) => {
    if (status && job.status !== status) return false;
    if (!needle) return true;
    return (
      String(job.number) === needle ||
      job.customerName.toLowerCase().includes(needle) ||
      job.truck.toLowerCase().includes(needle) ||
      job.title.toLowerCase().includes(needle) ||
      (job.vin ?? '').toLowerCase().includes(needle)
    );
  });
}

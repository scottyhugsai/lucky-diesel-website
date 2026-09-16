import 'server-only';
import { signedMediaUrls } from '@/lib/media';
import { createClient } from '@/lib/supabase/server';

/** Everything the job screen needs, read as the signed-in tech (RLS applies). */
export async function loadJob(workOrderId: string, userId: string) {
  const db = await createClient();

  const { data: job } = await db
    .from('work_orders')
    .select('*, customers(full_name), vehicles(*), tech:profiles!work_orders_assigned_tech_id_fkey(full_name)')
    .eq('id', workOrderId)
    .maybeSingle();
  if (!job) return null;

  const [inspection, lines, media, time, myOpen, notes, parts, tunes, dyno, settings, approval, automations] = await Promise.all([
    db.from('inspections').select('id, status, summary, sent_at, inspection_items(*)').eq('work_order_id', workOrderId).maybeSingle(),
    db.from('line_items').select('*').eq('work_order_id', workOrderId).order('sort'),
    db.from('media').select('id, path, kind, inspection_item_id, created_at').eq('work_order_id', workOrderId).order('created_at'),
    db.from('time_entries').select('id, tech_id, started_at, ended_at, tech:profiles!time_entries_tech_id_fkey(full_name)').eq('work_order_id', workOrderId).order('started_at'),
    db.from('time_entries').select('id, work_order_id, started_at, work_orders(number)').eq('tech_id', userId).is('ended_at', null).maybeSingle(),
    db.from('work_order_notes').select('id, body, internal, created_at, author:profiles(full_name)').eq('work_order_id', workOrderId).order('created_at', { ascending: false }),
    db.from('part_requests').select('id, description, status, created_at').eq('work_order_id', workOrderId).order('created_at', { ascending: false }),
    db.from('tune_records').select('*, flasher:profiles!tune_records_flashed_by_fkey(full_name)').eq('vehicle_id', job.vehicle_id).order('flashed_at', { ascending: false }),
    db.from('dyno_runs').select('*').eq('vehicle_id', job.vehicle_id).order('run_at'),
    db.from('shop_settings').select('labor_rate_cents, tax_rate').eq('id', 1).maybeSingle(),
    db.from('approvals').select('signer_name, created_at').eq('work_order_id', workOrderId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('automations').select('trigger_event').eq('enabled', true).eq('audience', 'customer').like('trigger_event', 'work_order.status:%'),
  ]);

  const mediaRows = media.data ?? [];
  const urls = await signedMediaUrls(mediaRows.map((row) => row.path));

  return {
    job,
    inspection: inspection.data
      ? { ...inspection.data, items: [...(inspection.data.inspection_items ?? [])].sort((a, b) => a.sort - b.sort) }
      : null,
    lines: lines.data ?? [],
    media: mediaRows.map((row) => ({ ...row, url: urls[row.path] ?? null })),
    timeEntries: time.data ?? [],
    myOpenEntry: myOpen.data,
    notes: notes.data ?? [],
    parts: parts.data ?? [],
    tunes: tunes.data ?? [],
    dynoRuns: dyno.data ?? [],
    laborRateCents: settings.data?.labor_rate_cents ?? 16500,
    taxRate: Number(settings.data?.tax_rate ?? 0),
    approval: approval.data,
    customerTextStatuses: (automations.data ?? []).map((row) => row.trigger_event.replace('work_order.status:', '')),
  };
}

export type JobData = NonNullable<Awaited<ReturnType<typeof loadJob>>>;

import 'server-only';
import { signedMediaUrls } from '@/lib/media';
import { createClient } from '@/lib/supabase/server';

/** Everything the admin job editor shows, in one parallel round of queries. */
export async function loadJobDetail(id: string) {
  const supabase = await createClient();
  const [job, lines, inspection, approvals, acks, tunes, dyno, time, notes, parts, events, messages, invoice, techs, settings] = await Promise.all([
    supabase
      .from('work_orders')
      .select('*, customers(id, full_name, phone, email, sms_consent, sms_opted_out_at, profile_id), vehicles(*), profiles(id, full_name, avatar_color)')
      .eq('id', id)
      .maybeSingle(),
    supabase.from('line_items').select('*').eq('work_order_id', id).order('sort').order('created_at'),
    supabase.from('inspections').select('*, profiles(full_name), inspection_items(*, media(id, path, caption, kind))').eq('work_order_id', id).maybeSingle(),
    supabase.from('approvals').select('*').eq('work_order_id', id).order('created_at', { ascending: false }),
    supabase.from('acknowledgements').select('*').eq('work_order_id', id).order('created_at', { ascending: false }),
    supabase.from('tune_records').select('*, profiles(full_name)').eq('work_order_id', id).order('flashed_at', { ascending: false }),
    supabase.from('dyno_runs').select('*').eq('work_order_id', id).order('run_at'),
    supabase.from('time_entries').select('*, profiles(full_name, avatar_color)').eq('work_order_id', id).order('started_at'),
    supabase.from('work_order_notes').select('*, profiles(full_name, avatar_color)').eq('work_order_id', id).order('created_at', { ascending: false }),
    supabase.from('part_requests').select('*, profiles(full_name)').eq('work_order_id', id).order('created_at', { ascending: false }),
    supabase.from('work_order_events').select('*, profiles(full_name, avatar_color)').eq('work_order_id', id).order('created_at', { ascending: false }),
    supabase.from('messages').select('id, channel, direction, to_address, subject, body, status, error, automation_key, created_at').eq('work_order_id', id).order('created_at', { ascending: false }).limit(50),
    supabase.from('invoices').select('id, number, status, total_cents, paid_at, created_at, payments(id, amount_cents, method, created_at)').eq('work_order_id', id).maybeSingle(),
    supabase.from('profiles').select('id, full_name, role').in('role', ['employee', 'admin']).eq('active', true).order('full_name'),
    supabase.from('shop_settings').select('tax_rate, labor_rate_cents, parts_taxable, labor_taxable, bay_count').eq('id', 1).maybeSingle(),
  ]);

  if (job.error) throw new Error(`Could not load job: ${job.error.message}`);
  if (!job.data) return null;

  const photoPaths = (inspection.data?.inspection_items ?? []).flatMap((item) => item.media.filter((m) => m.kind === 'photo').map((m) => m.path));
  const photoUrls = await signedMediaUrls(photoPaths);

  return {
    job: job.data,
    lines: lines.data ?? [],
    inspection: inspection.data,
    photoUrls,
    approvals: approvals.data ?? [],
    acks: acks.data ?? [],
    tunes: tunes.data ?? [],
    dyno: dyno.data ?? [],
    time: time.data ?? [],
    notes: notes.data ?? [],
    parts: parts.data ?? [],
    events: events.data ?? [],
    messages: messages.data ?? [],
    invoice: invoice.data,
    techs: techs.data ?? [],
    settings: {
      taxRate: Number(settings.data?.tax_rate ?? 0),
      laborRateCents: settings.data?.labor_rate_cents ?? 16500,
      partsTaxable: settings.data?.parts_taxable ?? true,
      laborTaxable: settings.data?.labor_taxable ?? false,
      bayCount: settings.data?.bay_count ?? 3,
    },
  };
}

export type JobDetail = NonNullable<Awaited<ReturnType<typeof loadJobDetail>>>;

import 'server-only';
import { signedMediaUrls } from '@/lib/media';
import { createClient } from '@/lib/supabase/server';
import { needsAcknowledgement } from './acknowledgement';
import type { InspectionGroup, InspectionItemView } from './InspectionItemCard';
import type { PortalLine } from './lines';
import { getShopRules, techName } from './server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One job with everything the customer may see. Null when it isn't theirs (RLS + explicit check). */
export async function loadJob(id: string, customerId: string) {
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  const { data: job } = await supabase.from('work_orders').select('*').eq('id', id).eq('customer_id', customerId).maybeSingle();
  if (!job) return null;

  const [vehicle, events, lineRows, inspection, approvals, acks, notes, invoice, media, rules, tech] = await Promise.all([
    supabase.from('vehicles').select('*').eq('id', job.vehicle_id).maybeSingle(),
    supabase.from('work_order_events').select('id, from_status, to_status, note, created_at').eq('work_order_id', id).order('created_at', { ascending: false }),
    supabase.from('line_items').select('id, kind, description, quantity, unit_price_cents, taxable, approval, inspection_item_id').eq('work_order_id', id).order('sort'),
    supabase.from('inspections').select('*').eq('work_order_id', id).eq('status', 'sent').maybeSingle(),
    supabase.from('approvals').select('*').eq('work_order_id', id).order('created_at', { ascending: false }),
    supabase.from('acknowledgements').select('*').eq('work_order_id', id).order('created_at', { ascending: false }),
    supabase.from('work_order_notes').select('id, body, created_at').eq('work_order_id', id).eq('internal', false).order('created_at', { ascending: false }),
    supabase.from('invoices').select('id, number, status, total_cents').eq('work_order_id', id).maybeSingle(),
    supabase.from('media').select('id, path, caption, kind, inspection_item_id').eq('work_order_id', id).eq('kind', 'photo').order('created_at'),
    getShopRules(),
    // Safe: the job was just read through RLS as this customer.
    techName(job.assigned_tech_id),
  ]);

  const lines: PortalLine[] = (lineRows.data ?? []).map((line) => ({ ...line, quantity: Number(line.quantity) }));
  const photos = media.data ?? [];
  const urls = await signedMediaUrls(photos.map((m) => m.path));
  const groups = inspection.data ? await buildGroups(inspection.data.id, lines, photos, urls) : [];
  const jobPhotos = photos
    .filter((m) => urls[m.path] && (!inspection.data || !m.inspection_item_id))
    .map((m) => ({ id: m.id, url: urls[m.path]!, caption: m.caption }));
  const linkedIds = new Set(groups.flatMap((group) => group.items.flatMap((item) => item.lines.map((line) => line.id))));
  const ackItems = lines.filter((line) => line.approval !== 'declined').map((line) => line.description);

  return {
    job,
    vehicle: vehicle.data,
    events: events.data ?? [],
    lines,
    otherLines: lines.filter((line) => !linkedIds.has(line.id)),
    inspection: inspection.data,
    groups,
    jobPhotos,
    approval: approvals.data?.[0] ?? null,
    acknowledgement: acks.data?.[0] ?? null,
    ackItems,
    needsAck: needsAcknowledgement(job.title, ackItems),
    notes: notes.data ?? [],
    invoice: invoice.data,
    taxRate: rules.taxRate,
    techName: tech,
  };
}

async function buildGroups(
  inspectionId: string,
  lines: PortalLine[],
  media: { id: string; path: string; caption: string | null; inspection_item_id: string | null }[],
  urls: Record<string, string>,
): Promise<InspectionGroup[]> {
  const supabase = await createClient();
  const { data: items } = await supabase.from('inspection_items').select('*').eq('inspection_id', inspectionId).order('sort');

  const groups: InspectionGroup[] = [];
  for (const item of items ?? []) {
    const view: InspectionItemView = {
      id: item.id,
      category: item.category,
      label: item.label,
      rating: item.rating,
      notes: item.notes,
      photos: media.filter((m) => m.inspection_item_id === item.id && urls[m.path]).map((m) => ({ id: m.id, url: urls[m.path]!, caption: m.caption })),
      lines: lines.filter((line) => line.inspection_item_id === item.id),
    };
    const group = groups.find((g) => g.category === item.category);
    if (group) group.items.push(view);
    else groups.push({ category: item.category, items: [view] });
  }
  return groups;
}

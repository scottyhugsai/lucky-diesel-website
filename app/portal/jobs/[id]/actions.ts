'use server';

import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { canonicalJson } from '@/components/portal/canonical';
import { ACK_TEMPLATE_VERSION, acknowledgementBody, isIntendedUse, needsAcknowledgement } from '@/components/portal/acknowledgement';
import { clientIp, getShopRules } from '@/components/portal/server';
import { requireRole } from '@/lib/auth';
import { emit } from '@/lib/automations/engine';
import type { Json } from '@/lib/db/database.types';
import { changeWorkOrderStatus } from '@/lib/domain/work-orders';
import { vehicleLabel } from '@/lib/format';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { computeTotals, lineAmount, type Totals } from '@/lib/work-orders/totals';

export interface PortalActionState {
  error?: string;
  message?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOT_FOUND = 'We couldn’t find that job on your account.';

/** A typed signature must look like a full name. */
function readSignature(formData: FormData): string | null {
  const name = String(formData.get('signerName') ?? '').trim().replace(/\s+/g, ' ');
  return name.length >= 3 && name.length <= 120 && name.includes(' ') ? name : null;
}

/** Loads the job as the signed-in customer. RLS plus an explicit customer check. */
async function ownedWorkOrder(workOrderId: string, customerId: string) {
  if (!UUID.test(workOrderId)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from('work_orders')
    .select('id, number, title, status, customer_id, vehicle_id')
    .eq('id', workOrderId)
    .maybeSingle();
  return data && data.customer_id === customerId ? { supabase, workOrder: data } : null;
}

function totalsJson(totals: Totals) {
  return { subtotal_cents: totals.subtotalCents, tax_cents: totals.taxCents, total_cents: totals.totalCents };
}

export async function approveEstimate(_previous: PortalActionState, formData: FormData): Promise<PortalActionState> {
  const viewer = await requireRole('client');
  if (!viewer.customerId) return { error: NOT_FOUND };
  const signerName = readSignature(formData);
  if (!signerName) return { error: 'Type your full name (first and last) to sign.' };
  if (formData.get('consent') !== 'on') return { error: 'Tick the box to authorize the approved work.' };

  const owned = await ownedWorkOrder(String(formData.get('workOrderId') ?? ''), viewer.customerId);
  if (!owned) return { error: NOT_FOUND };
  const { supabase, workOrder } = owned;
  if (workOrder.status !== 'awaiting_approval') return { error: 'This estimate was already answered. Refresh to see the latest.' };

  const { data: lines } = await supabase.from('line_items').select('*').eq('work_order_id', workOrder.id).order('sort');
  const pending = (lines ?? []).filter((line) => line.approval === 'pending');
  if (!pending.length) return { error: 'Nothing on this job is waiting for approval.' };

  const decided = pending.map((line) => ({ line, decision: formData.get(`line:${line.id}`) }));
  if (decided.some(({ decision }) => decision !== 'approved' && decision !== 'declined')) {
    return { error: 'Choose approve or decline for every item.' };
  }
  const approved = decided.filter((d) => d.decision === 'approved').map((d) => ({ ...d.line, approval: 'approved' as const }));
  const declined = decided.filter((d) => d.decision === 'declined').map((d) => ({ ...d.line, approval: 'declined' as const }));

  const { taxRate } = await getShopRules();
  const approvedTotals = computeTotals(approved, taxRate);
  const signedAt = new Date().toISOString();
  const snapshot: Json = {
    version: 1,
    signed_at: signedAt,
    signer_name: signerName,
    tax_rate: taxRate,
    work_order: { id: workOrder.id, number: workOrder.number, title: workOrder.title },
    lines: decided.map(({ line, decision }) => ({
      id: line.id,
      kind: line.kind,
      description: line.description,
      quantity: Number(line.quantity),
      unit_price_cents: line.unit_price_cents,
      taxable: line.taxable,
      amount_cents: lineAmount(line),
      inspection_item_id: line.inspection_item_id,
      decision: String(decision),
    })),
    totals: { approved: totalsJson(approvedTotals), declined: totalsJson(computeTotals(declined, taxRate)) },
  };
  const requestHeaders = await headers();
  const db = createAdminClient();

  for (const [state, group] of [['approved', approved], ['declined', declined]] as const) {
    if (!group.length) continue;
    const ids = group.map((line) => line.id);
    const { data: updated, error } = await db
      .from('line_items')
      .update({ approval: state })
      .in('id', ids)
      .eq('work_order_id', workOrder.id)
      .eq('approval', 'pending')
      .select('id');
    if (error || updated?.length !== ids.length) return { error: 'The estimate changed while you were reviewing it. Refresh and try again.' };
  }

  const { error: insertError } = await db.from('approvals').insert({
    work_order_id: workOrder.id,
    signer_name: signerName,
    signed_by: viewer.userId,
    approved_item_ids: approved.map((line) => line.id),
    declined_item_ids: declined.map((line) => line.id),
    approved_total_cents: approvedTotals.totalCents,
    snapshot,
    snapshot_sha256: createHash('sha256').update(canonicalJson(snapshot)).digest('hex'),
    ip: clientIp(requestHeaders.get('x-forwarded-for')),
    user_agent: requestHeaders.get('user-agent')?.slice(0, 500) ?? null,
  });
  if (insertError) return { error: 'We couldn’t save your signature. Please try again.' };

  const next = approved.length ? 'approved' : 'estimate';
  const note = `Customer e-signed: ${approved.length} approved, ${declined.length} declined`;
  const moved = await changeWorkOrderStatus(workOrder.id, next, viewer.userId, note);
  if (!moved.ok) return { error: moved.error };
  await emit({ name: 'estimate.approved', subjectType: 'work_order', subjectId: workOrder.id });

  revalidatePath(`/portal/jobs/${workOrder.id}`);
  revalidatePath('/portal');
  return { message: approved.length ? 'Approved and signed. We’ll get started and text you as it moves.' : 'Got it — nothing approved. The shop has been notified.' };
}

export async function signAcknowledgement(_previous: PortalActionState, formData: FormData): Promise<PortalActionState> {
  const viewer = await requireRole('client');
  if (!viewer.customerId) return { error: NOT_FOUND };
  const signerName = readSignature(formData);
  if (!signerName) return { error: 'Type your full name (first and last) to sign.' };
  const use = formData.get('intendedUse');
  if (!isIntendedUse(use)) return { error: 'Tell us how the truck will be used.' };
  if (formData.get('consent') !== 'on') return { error: 'Tick the box to confirm you’ve read the acknowledgement.' };

  const owned = await ownedWorkOrder(String(formData.get('workOrderId') ?? ''), viewer.customerId);
  if (!owned) return { error: NOT_FOUND };
  const { supabase, workOrder } = owned;
  if (workOrder.status === 'paid' || workOrder.status === 'cancelled') return { error: 'This job is closed.' };

  const [{ data: lines }, { data: vehicle }, { data: existing }] = await Promise.all([
    supabase.from('line_items').select('description, approval').eq('work_order_id', workOrder.id).order('sort'),
    supabase.from('vehicles').select('*').eq('id', workOrder.vehicle_id).maybeSingle(),
    supabase.from('acknowledgements').select('id').eq('work_order_id', workOrder.id).eq('template_version', ACK_TEMPLATE_VERSION).limit(1),
  ]);
  if (existing?.length) return { message: 'Already signed.' };
  const items = (lines ?? []).filter((line) => line.approval !== 'declined').map((line) => line.description);
  if (!vehicle || !needsAcknowledgement(workOrder.title, items)) return { error: 'This job doesn’t need an acknowledgement.' };

  const body = acknowledgementBody({ vehicle: vehicleLabel(vehicle), vin: vehicle.vin, jobNumber: workOrder.number, jobTitle: workOrder.title, items }, use);
  const requestHeaders = await headers();
  const { error } = await createAdminClient().from('acknowledgements').insert({
    work_order_id: workOrder.id,
    vehicle_id: vehicle.id,
    template_version: ACK_TEMPLATE_VERSION,
    body,
    signer_name: signerName,
    signed_by: viewer.userId,
    ip: clientIp(requestHeaders.get('x-forwarded-for')),
  });
  if (error) return { error: 'We couldn’t save your signature. Please try again.' };

  revalidatePath(`/portal/jobs/${workOrder.id}`);
  revalidatePath('/portal');
  return { message: 'Signed. A copy is saved to this job.' };
}

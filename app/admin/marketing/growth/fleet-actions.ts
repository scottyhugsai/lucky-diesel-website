'use server';

import { revalidatePath } from 'next/cache';
import { checkbox, email, guard, number, oneOf, phone, requiredText, requiredUuid, text, type ActionState } from '@/components/admin/core/parse';
import { requireRole } from '@/lib/auth';
import { parseProspectCsv } from '@/lib/marketing/fleet/fleet-math';
import { createAdminClient } from '@/lib/supabase/admin';

const PATH = '/admin/marketing/growth';
const TERMS = ['due_on_receipt', 'net_15', 'net_30'] as const;
const STAGES = ['prospect', 'active', 'lost'] as const;

function fleetFields(form: FormData) {
  return {
    contact_name: text(form, 'contact_name', { max: 120, label: 'Contact' }),
    email: email(form, 'email'),
    phone: phone(form, 'phone'),
    billing_terms: oneOf(form, 'billing_terms', TERMS, 'terms'),
    stage: oneOf(form, 'stage', STAGES, 'stage'),
    city: text(form, 'city', { max: 80, label: 'City' }),
    website: text(form, 'website', { max: 200, label: 'Website' }),
    truck_count: number(form, 'truck_count', { min: 0, max: 100_000, integer: true, label: 'Trucks' }),
    priority: checkbox(form, 'priority'),
    sla_hours: number(form, 'sla_hours', { min: 4, max: 336, integer: true, required: true, label: 'SLA hours' }) as number,
    labor_discount_pct: number(form, 'labor_discount_pct', { min: 0, max: 50, integer: true, required: true, label: 'Fleet discount' }) as number,
    pm_interval_days: number(form, 'pm_interval_days', { min: 7, max: 365, integer: true, required: true, label: 'PM days' }) as number,
    pm_interval_miles: number(form, 'pm_interval_miles', { min: 500, max: 50_000, integer: true, required: true, label: 'PM miles' }) as number,
    notes: text(form, 'notes', { max: 1000, label: 'Notes' }),
  };
}

export async function createFleet(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const name = requiredText(form, 'name', 'Company', 120);
    const { error } = await createAdminClient().from('fleet_accounts').insert({ name, ...fleetFields(form) });
    if (error) return { error: 'Couldn’t save the account.' };
    revalidatePath(PATH);
    return { notice: `${name} added.` };
  });
}

export async function updateFleet(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const id = requiredUuid(form, 'fleet_id', 'Account');
    const fields = fleetFields(form);
    // A prospect is never billable: keep `active` in step with the stage.
    const { error } = await createAdminClient().from('fleet_accounts').update({ ...fields, active: fields.stage === 'active' }).eq('id', id);
    if (error) return { error: 'Couldn’t save.' };
    revalidatePath(PATH);
    return { notice: 'Saved.' };
  });
}

/** Attaches a customer (and so their trucks) to a fleet account. */
export async function linkFleetCustomer(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const fleetId = requiredUuid(form, 'fleet_id', 'Account');
    const customerId = requiredUuid(form, 'customer_id', 'Customer');
    const { error } = await createAdminClient().from('customers').update({ fleet_account_id: fleetId, is_fleet: true }).eq('id', customerId);
    if (error) return { error: 'Couldn’t link the customer.' };
    revalidatePath(PATH);
    return { notice: 'Trucks linked.' };
  });
}

/**
 * Pasted CSV → prospect accounts. Companies already on file are skipped, so
 * re-pasting the same list is safe. Bad rows are reported, not guessed at.
 */
export async function importProspects(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const csv = requiredText(form, 'csv', 'CSV', 60_000);
    const source = text(form, 'source', { max: 60, label: 'Source' }) ?? 'import';
    const { rows, errors } = parseProspectCsv(csv);
    if (rows.length === 0) return { error: errors[0] ?? 'No rows found.' };

    const db = createAdminClient();
    const { data: existing } = await db.from('fleet_accounts').select('name').limit(2000);
    const taken = new Set((existing ?? []).map((f) => f.name.toLowerCase()));
    const fresh = rows.filter((r) => !taken.has(r.name.toLowerCase()));
    if (fresh.length === 0) return { notice: `All ${rows.length} already on file.` };

    const { error } = await db.from('fleet_accounts').insert(
      fresh.map((r) => ({
        name: r.name, contact_name: r.contactName, email: r.email, phone: r.phone,
        truck_count: r.truckCount, city: r.city, stage: 'prospect' as const, source, active: false,
      })),
    );
    if (error) return { error: 'Couldn’t import the list.' };
    revalidatePath(PATH);
    const skipped = rows.length - fresh.length;
    const notes = [`${fresh.length} added.`, skipped > 0 ? `${skipped} already on file.` : '', errors.join(' ')].filter(Boolean);
    return { notice: notes.join(' ').slice(0, 300) };
  });
}

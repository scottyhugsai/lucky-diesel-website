'use server';

import { revalidatePath } from 'next/cache';
import { email, guard, number, oneOf, phone, requiredText, requiredUuid, text, type ActionState } from '@/components/admin/core/parse';
import { requireRole } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

const PATH = '/admin/marketing/growth';
const TERMS = ['due_on_receipt', 'net_15', 'net_30'] as const;

function fleetFields(form: FormData) {
  return {
    contact_name: text(form, 'contact_name', { max: 120, label: 'Contact' }),
    email: email(form, 'email'),
    phone: phone(form, 'phone'),
    billing_terms: oneOf(form, 'billing_terms', TERMS, 'terms'),
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
    const { error } = await createAdminClient().from('fleet_accounts').update(fleetFields(form)).eq('id', id);
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

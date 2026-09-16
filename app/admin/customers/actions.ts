'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  type ActionState, InputError, checkbox, email, guard, number, oneOf, phone, requiredText, requiredUuid, text, uuid, vin,
} from '@/components/admin/core/parse';
import { decodeVinWithNhtsa, type DecodedVin } from '@/components/admin/core/vin';
import { requireRole } from '@/lib/auth';
import { SMS_CONSENT_VERSION } from '@/lib/lead';
import { siteUrl } from '@/lib/site-url';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const SOURCES = ['walk-in', 'phone', 'website', 'instagram', 'facebook', 'tiktok', 'google', 'referral', 'other'] as const;

function contactFields(form: FormData) {
  const row = {
    full_name: requiredText(form, 'full_name', 'Name', 120),
    phone: phone(form, 'phone'),
    email: email(form, 'email'),
    source: oneOf(form, 'source', SOURCES, 'source'),
    notes: text(form, 'notes', { max: 4000, label: 'Notes' }),
  };
  if (!row.phone && !row.email) throw new InputError('Add a phone number or an email.');
  return row;
}

async function assertUnique(db: Awaited<ReturnType<typeof createClient>>, row: { phone: string | null; email: string | null }, exceptId?: string) {
  for (const [column, value] of [['phone', row.phone], ['email', row.email]] as const) {
    if (!value) continue;
    let query = db.from('customers').select('id, full_name').eq(column, value).limit(1);
    if (exceptId) query = query.neq('id', exceptId);
    const { data } = await query;
    if (data?.[0]) throw new InputError(`${data[0].full_name} already uses that ${column}. Open their record instead.`);
  }
}

export async function createCustomer(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  let customerId = '';
  const result = await guard(async () => {
    const db = await createClient();
    const row = contactFields(form);
    await assertUnique(db, row);
    const { data, error } = await db.from('customers').insert(row).select('id').single();
    if (error || !data) return { error: `Could not save customer: ${error?.message}` };
    customerId = data.id;
    return {};
  });
  if (result.error || !customerId) return result;
  revalidatePath('/admin/customers');
  redirect(`/admin/customers/${customerId}`);
}

export async function updateCustomer(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const id = requiredUuid(form, 'customer_id', 'Customer');
    const db = await createClient();
    const row = contactFields(form);
    await assertUnique(db, row, id);
    const { error } = await db.from('customers').update(row).eq('id', id);
    if (error) return { error: `Could not save: ${error.message}` };
    revalidatePath(`/admin/customers/${id}`);
    revalidatePath('/admin/customers');
    return { notice: 'Contact details saved.' };
  });
}

export async function updateSmsConsent(_prev: ActionState, form: FormData): Promise<ActionState> {
  const viewer = await requireRole('admin');
  return guard(async () => {
    const id = requiredUuid(form, 'customer_id', 'Customer');
    const change = oneOf(form, 'change', ['opt_out', 'record_consent'] as const, 'consent change');
    const db = await createClient();
    const now = new Date().toISOString();

    if (change === 'record_consent' && !checkbox(form, 'confirm_consent')) {
      throw new InputError('Confirm the customer gave express consent before turning texts on.');
    }
    const patch = change === 'opt_out'
      ? { sms_opted_out_at: now }
      : { sms_consent: true, sms_consent_at: now, sms_consent_version: SMS_CONSENT_VERSION, sms_opted_out_at: null };

    const { error } = await db.from('customers').update(patch).eq('id', id);
    if (error) return { error: `Could not update consent: ${error.message}` };
    await db.from('audit_log').insert({ actor_id: viewer.userId, entity: 'customer', entity_id: id, action: change === 'opt_out' ? 'sms_opt_out' : 'sms_consent_recorded', data: { version: SMS_CONSENT_VERSION, via: 'admin' } });
    revalidatePath(`/admin/customers/${id}`);
    revalidatePath('/admin/customers');
    return { notice: change === 'opt_out' ? 'Opted out. No more texts will go to this customer.' : 'Consent recorded. Automated texts are on.' };
  });
}

const PLATFORM_IDS = ['duramax', 'powerstroke', 'cummins', 'other'] as const;

export async function saveVehicle(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const customerId = requiredUuid(form, 'customer_id', 'Customer');
    const vehicleId = uuid(form, 'vehicle_id', { required: false, label: 'Truck' });
    const platform = text(form, 'platform', { max: 20 });
    if (platform && !(PLATFORM_IDS as readonly string[]).includes(platform)) throw new InputError('Pick a valid platform.');
    const row = {
      vin: vin(text(form, 'vin', { max: 20, label: 'VIN' })),
      year: number(form, 'year', { min: 1950, max: new Date().getFullYear() + 1, integer: true, label: 'Year' }),
      make: text(form, 'make', { max: 40, label: 'Make' }),
      model: text(form, 'model', { max: 80, label: 'Model' }),
      platform,
      generation: text(form, 'generation', { max: 60, label: 'Generation' }),
      engine_code: text(form, 'engine_code', { max: 40, label: 'Engine' }),
      transmission: text(form, 'transmission', { max: 60, label: 'Transmission' }),
      mileage: number(form, 'mileage', { max: 2_000_000, integer: true, label: 'Mileage' }),
      nickname: text(form, 'nickname', { max: 40, label: 'Nickname' }),
      color: text(form, 'color', { max: 30, label: 'Color' }),
    };
    if (!row.make && !row.model && !row.vin) throw new InputError('Add a VIN or at least the make and model.');

    const db = await createClient();
    const { error } = vehicleId
      ? await db.from('vehicles').update(row).eq('id', vehicleId).eq('customer_id', customerId)
      : await db.from('vehicles').insert({ ...row, customer_id: customerId });
    if (error) return { error: `Could not save truck: ${error.message}` };
    revalidatePath(`/admin/customers/${customerId}`);
    return { notice: vehicleId ? 'Truck saved.' : 'Truck added.' };
  });
}

/** Called from the truck form's Decode button, not a form submit. */
export async function decodeVin(rawVin: string): Promise<{ data?: DecodedVin; error?: string }> {
  await requireRole('admin');
  const clean = String(rawVin ?? '').toUpperCase().replace(/\s/g, '');
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(clean)) return { error: 'Enter all 17 VIN characters (no I, O or Q) to decode.' };
  return decodeVinWithNhtsa(clean);
}

export async function inviteToPortal(_prev: ActionState, form: FormData): Promise<ActionState> {
  const viewer = await requireRole('admin');
  return guard(async () => {
    const id = requiredUuid(form, 'customer_id', 'Customer');
    const db = await createClient();
    const { data: customer } = await db.from('customers').select('id, full_name, email, profile_id').eq('id', id).maybeSingle();
    if (!customer) throw new InputError('Customer not found.');
    if (customer.profile_id) throw new InputError('This customer already has portal access.');
    if (!customer.email) throw new InputError('Add an email address first. The invite is sent by email.');

    const admin = createAdminClient();
    // Someone who already has an account (e.g. from a magic-link sign-up) just gets linked.
    const { data: existing } = await admin.from('profiles').select('id, role').eq('email', customer.email).maybeSingle();
    let userId = existing?.id;
    if (existing && existing.role !== 'client') throw new InputError('That email belongs to a staff account and can’t be linked to a customer.');

    if (!userId) {
      const { data, error } = await admin.auth.admin.inviteUserByEmail(customer.email, {
        data: { full_name: customer.full_name },
        redirectTo: `${siteUrl()}/auth/callback?next=/portal`,
      });
      if (error || !data.user) return { error: `Invite failed: ${error?.message ?? 'no user returned'}` };
      userId = data.user.id;
      // inviteUserByEmail can't set app_metadata; the role trigger syncs profiles.role from it.
      const { error: roleError } = await admin.auth.admin.updateUserById(userId, { app_metadata: { role: 'client' } });
      if (roleError) return { error: `Invite sent, but setting the client role failed: ${roleError.message}` };
    }

    const { error: linkError } = await admin.from('customers').update({ profile_id: userId }).eq('id', id).is('profile_id', null);
    if (linkError) return { error: `Could not link the portal account: ${linkError.message}` };
    await admin.from('audit_log').insert({ actor_id: viewer.userId, entity: 'customer', entity_id: id, action: existing ? 'portal_linked' : 'portal_invited', data: { email: customer.email } });
    revalidatePath(`/admin/customers/${id}`);
    return { notice: existing ? `Linked to the existing portal account for ${customer.email}.` : `Invite sent to ${customer.email}. They set a password from the email link.` };
  });
}

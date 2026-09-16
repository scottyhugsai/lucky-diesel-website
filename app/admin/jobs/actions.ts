'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { cannedJobLines, findCannedJob } from '@/components/admin/core/canned-jobs';
import {
  type ActionState, InputError, email, guard, number, oneOf, phone, requiredText, requiredUuid, shopDateTime, text, uuid, vin,
} from '@/components/admin/core/parse';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

type Db = Awaited<ReturnType<typeof createClient>>;

async function resolveCustomerAndVehicle(db: Db, form: FormData): Promise<{ customerId: string; vehicleId: string }> {
  const mode = oneOf(form, 'customer_mode', ['existing', 'new'] as const, 'customer option');

  if (mode === 'existing') {
    const customerId = requiredUuid(form, 'customer_id', 'Customer');
    const vehicleId = requiredUuid(form, 'vehicle_id', 'Truck');
    const { data: vehicle } = await db.from('vehicles').select('id').eq('id', vehicleId).eq('customer_id', customerId).maybeSingle();
    if (!vehicle) throw new InputError('That truck doesn’t belong to the selected customer.');
    return { customerId, vehicleId };
  }

  const fullName = requiredText(form, 'new_full_name', 'Customer name', 120);
  const customerPhone = phone(form, 'new_phone');
  const customerEmail = email(form, 'new_email');
  if (!customerPhone && !customerEmail) throw new InputError('Add a phone or email for the new customer.');
  const year = number(form, 'new_year', { min: 1980, max: new Date().getFullYear() + 1, integer: true, label: 'Year' });
  const make = requiredText(form, 'new_make', 'Make', 40);
  const model = requiredText(form, 'new_model', 'Model', 60);
  const vehicleVin = vin(text(form, 'new_vin', { max: 20 }));

  const existing = customerPhone ? (await db.from('customers').select('id').eq('phone', customerPhone).limit(1)).data?.[0] : undefined;
  let customerId = existing?.id;
  if (!customerId) {
    const { data, error } = await db
      .from('customers')
      .insert({ full_name: fullName, phone: customerPhone, email: customerEmail, source: 'walk-in' })
      .select('id')
      .single();
    if (error || !data) throw new Error(`Could not save customer: ${error?.message}`);
    customerId = data.id;
  }

  const { data: vehicle, error } = await db.from('vehicles').insert({ customer_id: customerId, year, make, model, vin: vehicleVin }).select('id').single();
  if (error || !vehicle) throw new Error(`Could not save truck: ${error?.message}`);
  return { customerId, vehicleId: vehicle.id };
}

export async function createJob(_prev: ActionState, form: FormData): Promise<ActionState> {
  const viewer = await requireRole('admin');
  let jobId = '';
  const result = await guard(async () => {
    const db = await createClient();
    const template = findCannedJob(text(form, 'template', { max: 40 }));
    const title = text(form, 'title', { max: 140, label: 'Title' }) ?? template?.title;
    if (!title) throw new InputError('Give the job a title or pick a template.');
    const complaint = text(form, 'complaint', { max: 2000, label: 'Complaint' });
    const techId = uuid(form, 'tech_id', { required: false, label: 'Tech' });
    const promisedAt = shopDateTime(form, 'promised_at', 'Promised time');
    const bay = text(form, 'bay', { max: 20, label: 'Bay' });

    if (techId) {
      const { data: tech } = await db.from('profiles').select('id').eq('id', techId).eq('role', 'employee').eq('active', true).maybeSingle();
      if (!tech) throw new InputError('Pick an active technician.');
    }

    const { customerId, vehicleId } = await resolveCustomerAndVehicle(db, form);
    const [{ data: settings }, { data: vehicle }] = await Promise.all([
      db.from('shop_settings').select('labor_rate_cents, parts_taxable, labor_taxable').eq('id', 1).maybeSingle(),
      db.from('vehicles').select('mileage').eq('id', vehicleId).maybeSingle(),
    ]);

    const { data: wo, error } = await db
      .from('work_orders')
      .insert({ customer_id: customerId, vehicle_id: vehicleId, title, complaint, assigned_tech_id: techId, promised_at: promisedAt, bay, mileage_in: vehicle?.mileage ?? null, status: 'estimate' })
      .select('id')
      .single();
    if (error || !wo) throw new Error(`Could not create job: ${error?.message}`);

    if (template) {
      const lines = cannedJobLines(template, settings?.labor_rate_cents ?? 16500).map((line) => ({
        ...line,
        work_order_id: wo.id,
        taxable: line.kind === 'labor' ? settings?.labor_taxable ?? false : settings?.parts_taxable ?? true,
        approval: 'pending' as const,
        recommended: true,
      }));
      const { error: lineError } = await db.from('line_items').insert(lines);
      if (lineError) throw new Error(`Job created but the template lines failed: ${lineError.message}`);
    }

    await db.from('audit_log').insert({ actor_id: viewer.userId, entity: 'work_order', entity_id: wo.id, action: 'created', data: { template: template?.id ?? null } });
    jobId = wo.id;
    return {};
  });
  if (result.error || !jobId) return result;

  revalidatePath('/admin/jobs');
  revalidatePath('/admin');
  redirect(`/admin/jobs/${jobId}`);
}

export async function updateJobDetails(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const db = await createClient();
    const id = requiredUuid(form, 'work_order_id', 'Job');
    const techId = uuid(form, 'tech_id', { required: false, label: 'Tech' });
    if (techId) {
      const { data: tech } = await db.from('profiles').select('id').eq('id', techId).in('role', ['employee', 'admin']).eq('active', true).maybeSingle();
      if (!tech) throw new InputError('Pick an active team member.');
    }
    const patch = {
      title: requiredText(form, 'title', 'Title', 140),
      complaint: text(form, 'complaint', { max: 2000, label: 'Complaint' }),
      assigned_tech_id: techId,
      bay: text(form, 'bay', { max: 20, label: 'Bay' }),
      promised_at: shopDateTime(form, 'promised_at', 'Promised time'),
      mileage_in: number(form, 'mileage_in', { max: 2_000_000, integer: true, label: 'Mileage' }),
    };
    const { error } = await db.from('work_orders').update(patch).eq('id', id);
    if (error) return { error: `Could not save: ${error.message}` };
    revalidatePath(`/admin/jobs/${id}`);
    revalidatePath('/admin/jobs');
    return { notice: 'Job details saved.' };
  });
}

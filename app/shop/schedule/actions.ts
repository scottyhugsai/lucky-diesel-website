'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { fail, isUuid, type ActionState } from '@/app/shop/_lib/form';
import { shopDateKey } from '@/app/shop/_lib/time';
import { requireRole } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Turns today's appointment into a job on the tech's board. Employees can't insert
 * work orders or edit appointments under RLS, so after the role check this uses the
 * service role — scoped to exactly one appointment that must be today and still open.
 */
export async function checkInAppointment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireRole('employee', 'admin');
  const appointmentId = formData.get('appointmentId');
  if (!isUuid(appointmentId)) return fail('That appointment link is broken.');

  const db = createAdminClient();
  const { data: appointment } = await db
    .from('appointments')
    .select('id, status, starts_at, service_label, notes, customer_id, vehicle_id, work_order_id, vehicles(mileage)')
    .eq('id', appointmentId)
    .maybeSingle();
  if (!appointment) return fail('Appointment not found.');
  if (shopDateKey(appointment.starts_at) !== shopDateKey(new Date())) return fail('Only today’s appointments can be checked in.');
  if (['cancelled', 'no_show', 'completed'].includes(appointment.status)) return fail(`This appointment is ${appointment.status.replace('_', ' ')}.`);

  let workOrderId = appointment.work_order_id;
  if (!workOrderId) {
    if (!appointment.vehicle_id) return fail('No truck on this appointment — add it at the counter first.');
    const { data: created, error } = await db
      .from('work_orders')
      .insert({
        customer_id: appointment.customer_id,
        vehicle_id: appointment.vehicle_id,
        status: 'estimate',
        title: appointment.service_label,
        complaint: appointment.notes,
        mileage_in: appointment.vehicles?.mileage ?? null,
        assigned_tech_id: viewer.userId,
      })
      .select('id, number')
      .single();
    if (error || !created) return fail('Couldn’t open a work order. Try again or tell the front desk.');
    workOrderId = created.id;
    await db.from('audit_log').insert({
      actor_id: viewer.userId,
      entity: 'work_order',
      entity_id: created.id,
      action: 'checked_in',
      data: { appointment_id: appointment.id, number: created.number },
    });
  }

  const { error: linkError } = await db
    .from('appointments')
    .update({ work_order_id: workOrderId, status: 'checked_in' })
    .eq('id', appointment.id);
  if (linkError) return fail('Work order opened, but the appointment didn’t update. Tell the front desk.');

  revalidatePath('/shop/schedule');
  revalidatePath('/shop');
  redirect(`/shop/jobs/${workOrderId}`);
}

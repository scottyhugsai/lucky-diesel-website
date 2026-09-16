'use server';

import { revalidatePath } from 'next/cache';
import { checked, fail, isUuid, num, ok, oneOf, text, type ActionState } from '@/app/shop/_lib/form';
import { CALIBRATORS, EMISSIONS_OPTIONS, TUNER_PLATFORMS } from '@/app/shop/_lib/performance';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

type Db = Awaited<ReturnType<typeof createClient>>;

/** Vehicle comes from the job, never from the form. */
async function jobVehicle(db: Db, workOrderId: unknown): Promise<{ workOrderId: string; vehicleId: string } | null> {
  if (!isUuid(workOrderId)) return null;
  const { data } = await db.from('work_orders').select('id, vehicle_id').eq('id', workOrderId).maybeSingle();
  return data ? { workOrderId: data.id, vehicleId: data.vehicle_id } : null;
}

export async function logTune(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireRole('employee', 'admin');
  const platform = oneOf(formData, 'tunerPlatform', TUNER_PLATFORMS);
  const calibrator = oneOf(formData, 'calibrator', CALIBRATORS);
  const emissions = oneOf(formData, 'emissions', EMISSIONS_OPTIONS);
  const fields = {
    'Device serial': text(formData, 'deviceSerial', { max: 80 }),
    ECU: text(formData, 'ecu', { max: 80 }),
    'File name': text(formData, 'fileName', { max: 200 }),
    Revision: text(formData, 'revision', { max: 40 }),
    Notes: text(formData, 'notes', { max: 2000 }),
  };
  if (!platform) return fail('Pick the tuner platform.');
  if (!calibrator) return fail('Pick who calibrated the file.');
  if (!emissions) return fail('Answer the emissions question (yes, no or unknown).');
  const invalid = Object.entries(fields).find(([, field]) => field.error);
  if (invalid) return fail(`${invalid[0]} ${invalid[1].error}.`);

  const db = await createClient();
  const job = await jobVehicle(db, formData.get('workOrderId'));
  if (!job) return fail('Job not found.');

  const backedUp = checked(formData, 'stockBackedUp');
  const { error } = await db.from('tune_records').insert({
    vehicle_id: job.vehicleId,
    work_order_id: job.workOrderId,
    tuner_platform: platform,
    calibrator,
    device_serial: fields['Device serial'].value,
    ecu: fields.ECU.value,
    file_name: fields['File name'].value,
    revision: fields.Revision.value,
    emissions_compliant: emissions === 'unknown' ? null : emissions === 'yes',
    stock_file_backed_up: backedUp,
    notes: fields.Notes.value,
    flashed_by: viewer.userId,
  });
  if (error) return fail('Couldn’t save the tune. Try again.');

  revalidatePath(`/shop/jobs/${job.workOrderId}`);
  return ok(backedUp ? 'Tune logged.' : 'Tune logged — no stock file backup on record. Pull one before the truck leaves.');
}

export async function logDynoRun(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('employee', 'admin');
  const label = text(formData, 'label', { max: 80, required: true });
  const horsepower = num(formData, 'horsepower', { min: 1, max: 3000, integer: true });
  const torque = num(formData, 'torque', { min: 1, max: 5000, integer: true });
  const boost = num(formData, 'boostPsi', { min: 0, max: 150 });
  const egt = num(formData, 'egtF', { min: 0, max: 2500, integer: true });
  const notes = text(formData, 'notes', { max: 1000 });
  if (!label.value) return fail(label.error === 'required' ? 'Label the run (e.g. “Baseline” or “After tune v1”).' : `Label ${label.error}.`);
  if (horsepower.error) return fail(`Horsepower ${horsepower.error}.`);
  if (torque.error) return fail(`Torque ${torque.error}.`);
  if (boost.error) return fail(`Boost ${boost.error}.`);
  if (egt.error) return fail(`EGT ${egt.error}.`);
  if (notes.error) return fail(`Notes ${notes.error}.`);
  if (horsepower.value === null && torque.value === null) return fail('Enter horsepower or torque from the sheet.');

  const db = await createClient();
  const job = await jobVehicle(db, formData.get('workOrderId'));
  if (!job) return fail('Job not found.');

  const tuneId = formData.get('tuneRecordId');
  let tuneRecordId: string | null = null;
  if (isUuid(tuneId)) {
    const { data: tune } = await db.from('tune_records').select('id').eq('id', tuneId).eq('vehicle_id', job.vehicleId).maybeSingle();
    if (!tune) return fail('That tune isn’t on this truck.');
    tuneRecordId = tune.id;
  }

  const { error } = await db.from('dyno_runs').insert({
    vehicle_id: job.vehicleId,
    work_order_id: job.workOrderId,
    tune_record_id: tuneRecordId,
    label: label.value,
    is_baseline: checked(formData, 'isBaseline'),
    horsepower: horsepower.value,
    torque: torque.value,
    boost_psi: boost.value,
    egt_f: egt.value,
    notes: notes.value,
  });
  if (error) return fail('Couldn’t save the run. Try again.');

  revalidatePath(`/shop/jobs/${job.workOrderId}`);
  return ok('Dyno run saved.');
}

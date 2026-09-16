'use client';

import { addNote, updatePartRequest } from '@/app/admin/jobs/[id]/actions';
import { updateJobDetails } from '@/app/admin/jobs/actions';
import { fieldClass, labelClass } from '@/components/app/ui';
import type { Enums } from '@/lib/db/database.types';
import { ActionForm, PendingButton } from './ActionForm';
import { toShopInputValue } from './parse';

interface DetailsProps {
  job: { id: string; title: string; complaint: string | null; assigned_tech_id: string | null; bay: string | null; promised_at: string | null; mileage_in: number | null };
  techs: { id: string; full_name: string; role: Enums<'app_role'> }[];
  bays: string[];
}

export function JobDetailsForm({ job, techs, bays }: DetailsProps) {
  const bayOptions = job.bay && !bays.includes(job.bay) ? [...bays, job.bay] : bays;
  return (
    <ActionForm action={updateJobDetails} className="grid gap-3">
      <input type="hidden" name="work_order_id" value={job.id} />
      <div><label htmlFor="d-title" className={labelClass}>Title</label><input id="d-title" name="title" required maxLength={140} defaultValue={job.title} className={fieldClass} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 sm:col-span-1 lg:col-span-2"><label htmlFor="d-tech" className={labelClass}>Tech</label>
          <select id="d-tech" name="tech_id" defaultValue={job.assigned_tech_id ?? ''} className={fieldClass}>
            <option value="">Unassigned</option>
            {techs.map((t) => <option key={t.id} value={t.id}>{t.full_name}{t.role === 'admin' ? ' (owner)' : ''}</option>)}
          </select>
        </div>
        <div><label htmlFor="d-bay" className={labelClass}>Bay</label>
          <select id="d-bay" name="bay" defaultValue={job.bay ?? ''} className={fieldClass}>
            <option value="">None</option>
            {bayOptions.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div><label htmlFor="d-miles" className={labelClass}>Mileage in</label><input id="d-miles" name="mileage_in" inputMode="numeric" defaultValue={job.mileage_in ?? ''} className={`${fieldClass} tabular-nums`} /></div>
      </div>
      <div><label htmlFor="d-promised" className={labelClass}>Promised</label><input id="d-promised" name="promised_at" type="datetime-local" defaultValue={toShopInputValue(job.promised_at)} className={`${fieldClass} [color-scheme:dark]`} /></div>
      <div><label htmlFor="d-complaint" className={labelClass}>Customer concern</label><textarea id="d-complaint" name="complaint" rows={3} maxLength={2000} defaultValue={job.complaint ?? ''} className={`${fieldClass} h-auto py-2`} /></div>
      <PendingButton variant="secondary" size="sm" className="justify-self-start">Save details</PendingButton>
    </ActionForm>
  );
}

export function NoteForm({ workOrderId }: { workOrderId: string }) {
  return (
    <ActionForm action={addNote} resetOnSuccess className="grid gap-2">
      <input type="hidden" name="work_order_id" value={workOrderId} />
      <label htmlFor="note-body" className="sr-only">Note</label>
      <textarea id="note-body" name="body" required rows={2} maxLength={2000} placeholder="Add a note…" className={`${fieldClass} h-auto py-2`} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm text-chalk/75">
          <input type="checkbox" name="customer_visible" className="size-4 accent-[var(--clover)]" /> Visible to customer
        </label>
        <PendingButton size="sm" variant="secondary">Add note</PendingButton>
      </div>
    </ActionForm>
  );
}

export function PartStatusForm({ workOrderId, partId, status }: { workOrderId: string; partId: string; status: Enums<'part_request_status'> }) {
  const next = status === 'requested' ? 'ordered' : status === 'ordered' ? 'received' : null;
  if (!next) return null;
  return (
    <ActionForm action={updatePartRequest} feedback="below">
      <input type="hidden" name="work_order_id" value={workOrderId} />
      <input type="hidden" name="part_request_id" value={partId} />
      <PendingButton size="sm" variant="secondary" name="status" value={next}>Mark {next}</PendingButton>
    </ActionForm>
  );
}

'use client';

import { useActionState, useState } from 'react';
import { convertLead } from '@/app/admin/leads/actions';
import { SubmitButton } from '@/components/app/SubmitButton';
import { fieldClass, labelClass } from '@/components/app/ui';
import { SERVICES } from '@/lib/site';
import type { ActionState } from './form';
import { FormMessage } from './FormMessage';
import { SlotPicker } from './SlotPicker';

interface ConvertLeadFormProps {
  leadId: string;
  serviceId: string | null;
  today: string;
  vehicleText: string;
}

/** Lead → customer + truck + estimate, optionally booked into a real open slot. */
export function ConvertLeadForm({ leadId, serviceId, today, vehicleText }: ConvertLeadFormProps) {
  const [state, action] = useActionState<ActionState, FormData>(convertLead, {});
  const [book, setBook] = useState(true);
  const defaultService = SERVICES.some((s) => s.id === serviceId) ? serviceId ?? '' : '';

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="lead_id" value={leadId} />
      <ol className="grid gap-2 text-sm text-chalk/70">
        <li><b className="text-chalk">1.</b> Customer record (matched by email or phone)</li>
        <li><b className="text-chalk">2.</b> Truck: {vehicleText}</li>
        <li><b className="text-chalk">3.</b> Estimate work order</li>
      </ol>
      <div>
        <label htmlFor="convert-service" className={labelClass}>Service</label>
        <select id="convert-service" name="service_id" defaultValue={defaultService} required className={fieldClass}>
          <option value="" disabled>Choose a service</option>
          {SERVICES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <label className="flex items-center gap-3 rounded-sm border border-line bg-carbon p-3 text-sm font-semibold">
        <input type="checkbox" name="book" checked={book} onChange={(e) => setBook(e.target.checked)} className="size-4 accent-[var(--clover)]" />
        Book an appointment now
      </label>
      {book && <SlotPicker initialDate={today} idPrefix="convert" />}
      <SubmitButton pendingLabel="Converting…">{book ? 'Convert & book' : 'Convert to estimate'}</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

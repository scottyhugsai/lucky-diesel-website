'use client';

import { useActionState, useState } from 'react';
import { createAppointment } from '@/app/admin/calendar/actions';
import { SubmitButton } from '@/components/app/SubmitButton';
import { fieldClass, labelClass } from '@/components/app/ui';
import { SERVICES } from '@/lib/site';
import type { DemoCustomer } from './DemoTools';
import type { ActionState } from './form';
import { FormMessage } from './FormMessage';
import { SlotPicker } from './SlotPicker';

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-3 rounded-md border border-line bg-carbon-2 p-4 sm:grid-cols-[2.5rem_1fr] sm:p-5">
      <span className="display text-3xl not-italic leading-none text-clover" aria-hidden="true">{n}</span>
      <div className="grid gap-3">
        <legend className="display text-xl not-italic">{title}</legend>
        {children}
      </div>
    </fieldset>
  );
}

export function NewAppointmentForm({ customers, initialCustomerId, initialDate }: { customers: DemoCustomer[]; initialCustomerId: string; initialDate: string }) {
  const [state, action] = useActionState<ActionState, FormData>(createAppointment, {});
  const [customerId, setCustomerId] = useState(initialCustomerId);
  const vehicles = customers.find((c) => c.id === customerId)?.vehicles ?? [];

  return (
    <form action={action} className="grid max-w-3xl gap-4">
      <Step n={1} title="Customer">
        <label htmlFor="appt-customer" className="sr-only">Customer</label>
        <select id="appt-customer" name="customer_id" required value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={fieldClass}>
          <option value="" disabled>Choose a customer</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Step>
      <Step n={2} title="Truck">
        <label htmlFor="appt-vehicle" className="sr-only">Truck</label>
        <select id="appt-vehicle" name="vehicle_id" key={customerId} className={fieldClass} disabled={!customerId}>
          {vehicles.length ? vehicles.map((v) => <option key={v.id} value={v.id}>{v.label}</option>) : <option value="">No truck on file (add at check-in)</option>}
        </select>
      </Step>
      <Step n={3} title="Service">
        <label htmlFor="appt-service" className="sr-only">Service</label>
        <select id="appt-service" name="service_id" required defaultValue="" className={fieldClass}>
          <option value="" disabled>Choose a service</option>
          {SERVICES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div>
          <label htmlFor="appt-notes" className={labelClass}>Notes (optional)</label>
          <textarea id="appt-notes" name="notes" rows={2} maxLength={500} className={`${fieldClass} h-auto py-2`} />
        </div>
      </Step>
      <Step n={4} title="Date & time">
        <SlotPicker initialDate={initialDate} idPrefix="appt" />
      </Step>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="Booking…">Book appointment</SubmitButton>
        <p className="text-sm text-steel">Sends the confirmation and schedules 24h and 2h reminders.</p>
        <FormMessage state={state} className="basis-full" />
      </div>
    </form>
  );
}

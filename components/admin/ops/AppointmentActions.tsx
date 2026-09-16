'use client';

import { useActionState } from 'react';
import { setAppointmentStatus } from '@/app/admin/calendar/actions';
import { SubmitButton } from '@/components/app/SubmitButton';
import type { ActionState } from './form';
import { FormMessage } from './FormMessage';

export function AppointmentActions({ appointmentId, status }: { appointmentId: string; status: string }) {
  const [state, action] = useActionState<ActionState, FormData>(setAppointmentStatus, {});
  const closed = ['cancelled', 'completed', 'no_show'].includes(status);
  return (
    <form action={action}>
      <input type="hidden" name="appointment_id" value={appointmentId} />
      {closed ? (
        <p className="text-sm text-steel">This appointment is {status.replace('_', ' ')}.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {status === 'scheduled' && <SubmitButton name="status" value="confirmed" size="sm">Confirm</SubmitButton>}
          {status !== 'checked_in' && <SubmitButton name="status" value="checked_in" size="sm" variant="secondary">Check in</SubmitButton>}
          {status === 'checked_in' && <SubmitButton name="status" value="completed" size="sm">Complete</SubmitButton>}
          <SubmitButton name="status" value="no_show" size="sm" variant="secondary">No-show</SubmitButton>
          <SubmitButton name="status" value="cancelled" size="sm" variant="danger" pendingLabel="Cancelling…">Cancel</SubmitButton>
        </div>
      )}
      <FormMessage state={state} className="mt-2" />
    </form>
  );
}

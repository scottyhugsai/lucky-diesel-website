'use client';

import { LogIn } from 'lucide-react';
import { useActionState } from 'react';
import { checkInAppointment } from '@/app/shop/schedule/actions';
import type { ActionState } from '@/app/shop/_lib/form';
import { SubmitButton } from '@/components/app/SubmitButton';
import { FormMessage } from './FormMessage';

export function CheckInButton({ appointmentId, who }: { appointmentId: string; who: string }) {
  const [state, action] = useActionState<ActionState, FormData>(checkInAppointment, {});
  return (
    <form action={action} className="grid grid-cols-[minmax(0,1fr)] gap-2">
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <SubmitButton pendingLabel="Opening job…" className="h-14 w-full text-lg">
        <LogIn className="size-5" aria-hidden="true" /> Check in<span className="sr-only"> {who}</span>
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

'use client';

import { Hand } from 'lucide-react';
import { useActionState } from 'react';
import { takeJob } from '@/app/shop/actions';
import type { ActionState } from '@/app/shop/_lib/form';
import { SubmitButton } from '@/components/app/SubmitButton';
import { FormMessage } from './FormMessage';

export function TakeJobButton({ workOrderId, number }: { workOrderId: string; number: number }) {
  const [state, action] = useActionState<ActionState, FormData>(takeJob, {});
  return (
    <form action={action} className="grid grid-cols-[minmax(0,1fr)] gap-2">
      <input type="hidden" name="workOrderId" value={workOrderId} />
      <SubmitButton variant="secondary" pendingLabel="Claiming…" className="h-12 w-full text-base">
        <Hand className="size-5" aria-hidden="true" /> Take it<span className="sr-only"> — WO #{number}</span>
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

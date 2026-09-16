'use client';

import { MessageSquare, TriangleAlert } from 'lucide-react';
import { useActionState, useState } from 'react';
import { moveStatus } from '@/app/shop/jobs/[id]/actions';
import type { ActionState } from '@/app/shop/_lib/form';
import { SubmitButton } from '@/components/app/SubmitButton';
import { buttonClass } from '@/components/app/ui';
import type { Enums } from '@/lib/db/database.types';
import { FormMessage } from './FormMessage';

type Status = Enums<'work_order_status'>;

const VERBS: Partial<Record<Status, string>> = {
  estimate: 'Back to estimate',
  awaiting_approval: 'Awaiting approval',
  approved: 'Mark approved',
  in_progress: 'Start work',
  waiting_parts: 'Waiting on parts',
  quality_check: 'Send to QC',
  ready: 'Ready for pickup',
  cancelled: 'Cancel job',
};

/** Moves that undo progress or kill the job ask twice. */
const CONFIRM: Partial<Record<Status, string>> = {
  cancelled: 'Cancel this job? Work stops and it drops off every board.',
  estimate: 'Pull this job back to estimate? Any pending approval is withdrawn.',
};

const FORWARD: Status[] = ['approved', 'in_progress', 'quality_check', 'ready'];

interface StatusActionsProps {
  workOrderId: string;
  number: number;
  next: Status[];
  textsCustomer: string[];
}

export function StatusActions({ workOrderId, number, next, textsCustomer }: StatusActionsProps) {
  const [state, action] = useActionState<ActionState, FormData>(moveStatus, {});
  const [confirming, setConfirming] = useState<Status | null>(null);
  const options = next.filter((status) => VERBS[status]);

  if (!options.length) {
    return <p className="text-sm text-steel">No moves from here on the shop floor — the front office takes it from this point.</p>;
  }

  const primary = options.find((status) => FORWARD.includes(status));

  return (
    <form action={action} className="grid grid-cols-[minmax(0,1fr)] gap-3" onSubmit={() => setConfirming(null)}>
      <input type="hidden" name="workOrderId" value={workOrderId} />
      {confirming ? (
        <div role="alertdialog" aria-labelledby="confirm-status" className="grid grid-cols-[minmax(0,1fr)] gap-3 rounded-md border border-danger/40 bg-danger/10 p-4">
          <p id="confirm-status" className="flex items-start gap-2 font-semibold text-chalk">
            <TriangleAlert className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden="true" />
            WO #{number}: {CONFIRM[confirming]}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setConfirming(null)} className={`${buttonClass('secondary')} h-14 text-base`} autoFocus>
              Keep as is
            </button>
            <SubmitButton name="to" value={confirming} variant="danger" pendingLabel="Saving…" className="h-14 text-base">
              Yes, {VERBS[confirming]?.toLowerCase()}
            </SubmitButton>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
          {options.map((status) => {
            const isPrimary = status === primary;
            const variant = CONFIRM[status] ? (status === 'cancelled' ? 'danger' : 'secondary') : isPrimary ? 'primary' : 'secondary';
            const span = isPrimary ? 'col-span-2 lg:col-span-1' : '';
            const content = (
              <span className="flex flex-col items-center leading-tight">
                <span>{VERBS[status]}</span>
                {textsCustomer.includes(status) && (
                  <span className="mt-0.5 inline-flex items-center gap-1 text-[0.7rem] font-semibold opacity-75">
                    <MessageSquare className="size-3" aria-hidden="true" /> texts customer
                  </span>
                )}
              </span>
            );
            if (CONFIRM[status]) {
              return (
                <button key={status} type="button" onClick={() => setConfirming(status)} className={`${buttonClass(variant)} h-14 text-base ${span}`}>
                  {content}
                </button>
              );
            }
            return (
              <SubmitButton key={status} name="to" value={status} variant={variant} pendingLabel="Saving…" className={`h-14 text-base ${span}`}>
                {content}
              </SubmitButton>
            );
          })}
        </div>
      )}
      <FormMessage state={state} />
    </form>
  );
}

'use client';

import { ArrowRightLeft, CirclePlay, CircleStop } from 'lucide-react';
import { useActionState } from 'react';
import { clockIn, clockOut, switchClock } from '@/app/shop/actions';
import type { ActionState } from '@/app/shop/_lib/form';
import { SubmitButton } from '@/components/app/SubmitButton';
import { ElapsedTimer } from './ElapsedTimer';
import { FormMessage } from './FormMessage';

export interface OpenEntry {
  id: string;
  workOrderId: string;
  number: number;
  startedAt: string;
}

interface ClockControlProps {
  workOrderId: string;
  openEntry: OpenEntry | null;
  serverNow: number;
  /** Compact single-row layout for the sticky phone action bar. */
  compact?: boolean;
  disabled?: boolean;
}

const BIG = 'h-14 w-full text-lg';

export function ClockControl({ workOrderId, openEntry, serverNow, compact = false, disabled = false }: ClockControlProps) {
  const [inState, inAction] = useActionState<ActionState, FormData>(clockIn, {});
  const [outState, outAction] = useActionState<ActionState, FormData>(clockOut, {});
  const [switchState, switchAction] = useActionState<ActionState, FormData>(switchClock, {});
  const onThisJob = openEntry?.workOrderId === workOrderId;
  const onOtherJob = openEntry && !onThisJob;
  const state = onThisJob ? outState : onOtherJob ? switchState : inState;

  let control: React.ReactNode;
  if (onThisJob) {
    control = (
      <form action={outAction} className="flex items-center gap-3">
        <input type="hidden" name="entryId" value={openEntry.id} />
        <div className="min-w-0 flex-1">
          {!compact && <p className="text-xs font-semibold uppercase tracking-widest text-clover">On the clock</p>}
          <ElapsedTimer startedAt={openEntry.startedAt} serverNow={serverNow} className={`display not-italic text-clover ${compact ? 'text-3xl' : 'text-5xl'}`} />
        </div>
        <SubmitButton variant="danger" pendingLabel="Stopping…" className={`h-14 shrink-0 px-5 text-lg ${compact ? '' : 'min-w-40'}`}>
          <CircleStop className="size-5" aria-hidden="true" /> Clock out
        </SubmitButton>
      </form>
    );
  } else if (onOtherJob) {
    control = (
      <form action={switchAction} className={compact ? 'flex items-center gap-3' : 'grid gap-2'}>
        <input type="hidden" name="workOrderId" value={workOrderId} />
        <p className={`text-sm text-chalk/75 ${compact ? 'min-w-0 flex-1 leading-tight' : ''}`}>
          Clocked into <strong className="text-chalk">WO #{openEntry.number}</strong>
          {!compact && ' — switching stops that timer and starts one here.'}
        </p>
        <SubmitButton variant="secondary" pendingLabel="Switching…" className={compact ? 'h-14 shrink-0 px-4' : BIG}>
          <ArrowRightLeft className="size-5" aria-hidden="true" /> Switch here
        </SubmitButton>
      </form>
    );
  } else {
    control = (
      <form action={inAction}>
        <input type="hidden" name="workOrderId" value={workOrderId} />
        <SubmitButton pendingLabel="Starting…" className={BIG}>
          <CirclePlay className="size-5" aria-hidden="true" /> Clock in to this job
        </SubmitButton>
      </form>
    );
  }

  if (disabled && !onThisJob) {
    control = <p className="text-sm text-steel">Job is closed — no time can be added.</p>;
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
      {control}
      <FormMessage state={state} />
    </div>
  );
}

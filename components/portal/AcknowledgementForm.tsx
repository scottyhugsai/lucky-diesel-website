'use client';

import { useActionState, useState } from 'react';
import { signAcknowledgement, type PortalActionState } from '@/app/portal/jobs/[id]/actions';
import { SubmitButton } from '@/components/app/SubmitButton';
import { fieldClass, labelClass } from '@/components/app/ui';
import { acknowledgementBody, INTENDED_USES, type AcknowledgementSubject, type IntendedUse } from './acknowledgement';

export function AcknowledgementForm({ workOrderId, subject }: { workOrderId: string; subject: AcknowledgementSubject }) {
  const [state, action] = useActionState<PortalActionState, FormData>(signAcknowledgement, {});
  const [use, setUse] = useState<IntendedUse>('street');

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="workOrderId" value={workOrderId} />
      <fieldset className="min-w-0">
        <legend className={labelClass}>How will this truck be used?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(INTENDED_USES) as IntendedUse[]).map((key) => (
            <label key={key} className={`flex min-h-14 cursor-pointer items-start gap-3 rounded-sm border p-3 text-sm transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-clover ${use === key ? 'border-clover bg-clover/10 text-chalk' : 'border-line text-chalk/70 hover:border-chalk/30'}`}>
              <input type="radio" name="intendedUse" value={key} checked={use === key} onChange={() => setUse(key)} className="mt-0.5 size-4 shrink-0 accent-[var(--clover)]" />
              {INTENDED_USES[key]}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <p className={labelClass} id="ack-text-label">Acknowledgement</p>
        <div tabIndex={0} aria-labelledby="ack-text-label" className="max-h-72 overflow-y-auto whitespace-pre-line rounded-sm border border-line bg-carbon p-4 text-sm leading-relaxed text-chalk/80">
          {acknowledgementBody(subject, use)}
        </div>
      </div>

      <label className="flex min-h-11 items-start gap-3 text-sm text-chalk/80">
        <input type="checkbox" name="consent" required className="mt-0.5 size-5 shrink-0 accent-[var(--clover)]" />
        <span>I have read this acknowledgement and agree to it.</span>
      </label>
      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <label htmlFor="ackSignerName" className={labelClass}>Sign with your full name</label>
          <input id="ackSignerName" name="signerName" required autoComplete="name" placeholder="First and last name" className={`${fieldClass} h-14 font-display text-2xl font-extrabold italic`} />
        </div>
        <SubmitButton pendingLabel="Signing…" variant="secondary" className="h-14 px-6">Sign acknowledgement</SubmitButton>
      </div>
      <p role="status" aria-live="polite" className={`text-sm ${state.error ? 'text-danger' : 'text-clover'}`}>{state.error ?? state.message}</p>
    </form>
  );
}

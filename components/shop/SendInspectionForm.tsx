'use client';

import { ClipboardCheck, Send } from 'lucide-react';
import { useState } from 'react';
import { sendInspection, startInspection } from '@/app/shop/jobs/[id]/_inspection/actions';
import { buttonClass } from '@/components/app/ui';
import { Field, shopTextarea } from './fields';
import { FormMessage } from './FormMessage';
import { PendingButton, useShopForm } from './useShopForm';

interface SendInspectionFormProps {
  workOrderId: string;
  customerFirstName: string;
  suggestedSummary: string;
  itemCount: number;
  movesToApproval: boolean;
}

export function SendInspectionForm({ workOrderId, customerFirstName, suggestedSummary, itemCount, movesToApproval }: SendInspectionFormProps) {
  const { state, pending, onSubmit } = useShopForm(sendInspection);
  const [confirming, setConfirming] = useState(false);
  const who = customerFirstName || 'the customer';

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-[minmax(0,1fr)] gap-4 rounded-md border border-clover/40 bg-clover/5 p-4">
      <input type="hidden" name="workOrderId" value={workOrderId} />
      <div>
        <p className="kicker text-sm">Send to customer</p>
        <p className="mt-1 text-sm text-chalk/70">
          Texts and emails {who} a link with every photo, rating and price to approve.
          {movesToApproval && ' The job moves to Awaiting approval.'}
        </p>
      </div>
      <Field label="Summary for the customer" hint="Shown at the top of their inspection.">
        {(id) => <textarea id={id} name="summary" maxLength={1000} rows={3} defaultValue={suggestedSummary} className={shopTextarea} />}
      </Field>
      {confirming ? (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setConfirming(false)} className={`${buttonClass('secondary')} h-14 text-base`}>Not yet</button>
          <PendingButton pending={pending} pendingLabel="Sending…" className="h-14 text-base">
            <Send className="size-5" aria-hidden="true" /> Yes, send
          </PendingButton>
        </div>
      ) : (
        <button type="button" disabled={!itemCount} onClick={() => setConfirming(true)} className={`${buttonClass('primary')} h-14 text-lg`}>
          <Send className="size-5" aria-hidden="true" /> Send {itemCount} item{itemCount === 1 ? '' : 's'} to {who}
        </button>
      )}
      <FormMessage state={state} />
    </form>
  );
}

export function StartInspectionButton({ workOrderId }: { workOrderId: string }) {
  const { state, pending, onSubmit } = useShopForm(startInspection);
  return (
    <form onSubmit={onSubmit} className="grid grid-cols-[minmax(0,1fr)] gap-3 rounded-md border border-dashed border-chalk/20 p-6 text-center">
      <input type="hidden" name="workOrderId" value={workOrderId} />
      <ClipboardCheck className="mx-auto size-8 text-clover" aria-hidden="true" />
      <p className="display text-2xl not-italic">No inspection yet</p>
      <p className="text-sm text-chalk/60">Walk the truck, rate what you see, shoot photos. The customer approves from their phone.</p>
      <PendingButton pending={pending} pendingLabel="Starting…" className="mx-auto h-14 w-full max-w-sm text-lg">
        Start inspection
      </PendingButton>
      <FormMessage state={state} />
    </form>
  );
}

'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { addRecommendedLine } from '@/app/shop/jobs/[id]/_inspection/actions';
import { CheckRow, Field, shopField } from './fields';
import { FormMessage } from './FormMessage';
import { PendingButton, useShopForm } from './useShopForm';

type Kind = 'part' | 'labor';

function LineFields({ laborRate }: { laborRate: string }) {
  const [kind, setKind] = useState<Kind>('part');
  const [taxable, setTaxable] = useState(true);

  function pickKind(next: Kind) {
    setKind(next);
    setTaxable(next === 'part');
  }

  return (
    <>
      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold text-chalk/85">Type</legend>
        <div className="grid grid-cols-2 gap-1.5">
          {(['part', 'labor'] as const).map((option) => (
            <label key={option} className="flex h-12 cursor-pointer items-center justify-center rounded-sm border-2 border-line bg-carbon font-bold uppercase tracking-wide text-chalk/80 has-checked:border-clover has-checked:bg-clover/10 has-checked:text-clover has-focus-visible:outline-2 has-focus-visible:outline-clover">
              <input type="radio" name="kind" value={option} checked={kind === option} onChange={() => pickKind(option)} className="sr-only" />
              {option === 'part' ? 'Part' : 'Labor'}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Description">
        {(id) => <input id={id} name="description" required maxLength={200} className={shopField} placeholder={kind === 'part' ? 'e.g. Turbo actuator' : 'e.g. Replace turbo actuator'} />}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={kind === 'labor' ? 'Hours' : 'Qty'}>
          {(id) => <input id={id} name="quantity" required inputMode="decimal" defaultValue="1" className={`${shopField} font-mono`} />}
        </Field>
        <Field label={kind === 'labor' ? 'Rate ($/hr)' : 'Price each ($)'}>
          {(id) => <input key={kind} id={id} name="price" required inputMode="decimal" defaultValue={kind === 'labor' ? laborRate : ''} placeholder="0.00" className={`${shopField} font-mono`} />}
        </Field>
      </div>
      <CheckRow name="taxable" label="Taxable" description={kind === 'part' ? 'Parts are taxed by default' : 'Labor is not taxed by default'} checked={taxable} onChange={setTaxable} />
    </>
  );
}

export function RecommendForm({ workOrderId, itemId, laborRateCents }: { workOrderId: string; itemId: string; laborRateCents: number }) {
  const { state, pending, onSubmit } = useShopForm(addRecommendedLine);
  return (
    <form onSubmit={onSubmit} className="grid grid-cols-[minmax(0,1fr)] gap-3 rounded-md border border-line bg-carbon p-3">
      <input type="hidden" name="workOrderId" value={workOrderId} />
      <input type="hidden" name="itemId" value={itemId} />
      <LineFields key={state.savedAt ?? 0} laborRate={(laborRateCents / 100).toFixed(2)} />
      <PendingButton pending={pending} pendingLabel="Adding…" className="h-12 text-base">
        <Plus className="size-5" aria-hidden="true" /> Add to estimate
      </PendingButton>
      <FormMessage state={state} />
    </form>
  );
}

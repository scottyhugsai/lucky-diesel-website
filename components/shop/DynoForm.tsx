'use client';

import { Gauge } from 'lucide-react';
import { logDynoRun } from '@/app/shop/jobs/[id]/_performance/actions';
import { CheckRow, Field, shopField, shopTextarea } from './fields';
import { FormMessage } from './FormMessage';
import { PendingButton, useShopForm } from './useShopForm';

interface DynoFormProps {
  workOrderId: string;
  tunes: { id: string; label: string }[];
  hasBaseline: boolean;
}

function DynoFields({ tunes, hasBaseline }: Omit<DynoFormProps, 'workOrderId'>) {
  const numeric = `${shopField} font-mono text-lg`;
  return (
    <>
      <Field label="Run label">
        {(id) => <input id={id} name="label" required maxLength={80} defaultValue={hasBaseline ? '' : 'Baseline (stock)'} placeholder="e.g. After tune v1" className={shopField} />}
      </Field>
      <CheckRow name="isBaseline" label="Baseline run" description="Before any changes — gains are measured from this" defaultChecked={!hasBaseline} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Horsepower">{(id) => <input id={id} name="horsepower" inputMode="numeric" pattern="[0-9]*" className={numeric} />}</Field>
        <Field label="Torque (lb-ft)">{(id) => <input id={id} name="torque" inputMode="numeric" pattern="[0-9]*" className={numeric} />}</Field>
        <Field label="Boost (psi)">{(id) => <input id={id} name="boostPsi" inputMode="decimal" className={numeric} />}</Field>
        <Field label="EGT (°F)">{(id) => <input id={id} name="egtF" inputMode="numeric" pattern="[0-9]*" className={numeric} />}</Field>
      </div>
      {tunes.length > 0 && (
        <Field label="Tune on the truck">
          {(id) => (
            <select id={id} name="tuneRecordId" defaultValue="" className={shopField}>
              <option value="">None / stock</option>
              {tunes.map((tune) => <option key={tune.id} value={tune.id}>{tune.label}</option>)}
            </select>
          )}
        </Field>
      )}
      <Field label="Notes">
        {(id) => <textarea id={id} name="notes" rows={2} maxLength={1000} className={shopTextarea} placeholder="Gear, weather correction, anything odd on the pull" />}
      </Field>
    </>
  );
}

export function DynoForm({ workOrderId, tunes, hasBaseline }: DynoFormProps) {
  const { state, pending, onSubmit } = useShopForm(logDynoRun);
  return (
    <form onSubmit={onSubmit} className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <input type="hidden" name="workOrderId" value={workOrderId} />
      <DynoFields key={state.savedAt ?? 0} tunes={tunes} hasBaseline={hasBaseline} />
      <PendingButton pending={pending} pendingLabel="Saving…" className="h-14 text-lg">
        <Gauge className="size-5" aria-hidden="true" /> Save dyno run
      </PendingButton>
      <FormMessage state={state} />
    </form>
  );
}

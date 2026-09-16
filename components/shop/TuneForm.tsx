'use client';

import { FileCheck, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { CALIBRATORS, TUNER_PLATFORMS } from '@/app/shop/_lib/performance';
import { logTune } from '@/app/shop/jobs/[id]/_performance/actions';
import { CheckRow, Field, shopField, shopTextarea } from './fields';
import { FormMessage } from './FormMessage';
import { PendingButton, useShopForm } from './useShopForm';

function TuneFields() {
  const [backedUp, setBackedUp] = useState(false);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tuner platform">
          {(id) => (
            <select id={id} name="tunerPlatform" required defaultValue="" className={shopField}>
              <option value="" disabled>Choose…</option>
              {TUNER_PLATFORMS.map((option) => <option key={option}>{option}</option>)}
            </select>
          )}
        </Field>
        <Field label="Calibrator">
          {(id) => (
            <select id={id} name="calibrator" required defaultValue="" className={shopField}>
              <option value="" disabled>Choose…</option>
              {CALIBRATORS.map((option) => <option key={option}>{option}</option>)}
            </select>
          )}
        </Field>
        <Field label="Device serial">
          {(id) => <input id={id} name="deviceSerial" maxLength={80} autoCapitalize="characters" className={`${shopField} font-mono`} />}
        </Field>
        <Field label="ECU">
          {(id) => <input id={id} name="ecu" maxLength={80} placeholder="e.g. E41" className={shopField} />}
        </Field>
        <Field label="File name">
          {(id) => <input id={id} name="fileName" maxLength={200} className={`${shopField} font-mono`} />}
        </Field>
        <Field label="Revision">
          {(id) => <input id={id} name="revision" maxLength={40} placeholder="e.g. v3.3" className={`${shopField} font-mono`} />}
        </Field>
      </div>

      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold text-chalk/85">Emissions compliant?</legend>
        <div className="grid grid-cols-3 gap-1.5">
          {(['yes', 'no', 'unknown'] as const).map((option) => (
            <label key={option} className="flex h-12 cursor-pointer items-center justify-center rounded-sm border-2 border-line bg-carbon font-bold uppercase tracking-wide text-chalk/80 has-checked:border-clover has-checked:bg-clover/10 has-checked:text-clover has-focus-visible:outline-2 has-focus-visible:outline-clover">
              <input type="radio" name="emissions" value={option} required className="sr-only" />
              {option === 'unknown' ? 'Not sure' : option}
            </label>
          ))}
        </div>
      </fieldset>

      <CheckRow name="stockBackedUp" label="Stock file backed up" description="Saved the original calibration before flashing" checked={backedUp} onChange={setBackedUp} />
      {!backedUp && (
        <p role="note" className="flex items-start gap-2 rounded-sm border border-amber-400/40 bg-amber-400/10 p-3 text-sm font-semibold text-amber-200">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          No stock backup = no way back to factory. Pull the stock file before you flash.
        </p>
      )}

      <Field label="Notes">
        {(id) => <textarea id={id} name="notes" rows={2} maxLength={2000} className={shopTextarea} placeholder="Datalog observations, options enabled…" />}
      </Field>
    </>
  );
}

export function TuneForm({ workOrderId }: { workOrderId: string }) {
  const { state, pending, onSubmit } = useShopForm(logTune);
  return (
    <form onSubmit={onSubmit} className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <input type="hidden" name="workOrderId" value={workOrderId} />
      <TuneFields key={state.savedAt ?? 0} />
      <PendingButton pending={pending} pendingLabel="Saving…" className="h-14 text-lg">
        <FileCheck className="size-5" aria-hidden="true" /> Log tune
      </PendingButton>
      <FormMessage state={state} />
    </form>
  );
}

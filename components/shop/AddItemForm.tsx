'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { INSPECTION_CATEGORIES, type Rating } from '@/app/shop/_lib/inspection';
import { addInspectionItem } from '@/app/shop/jobs/[id]/_inspection/actions';
import { Field, shopField, shopTextarea } from './fields';
import { FormMessage } from './FormMessage';
import { PendingButton, useShopForm } from './useShopForm';
import { RatingToggle } from './RatingToggle';

const QUICK_LABELS: Record<(typeof INSPECTION_CATEGORIES)[number], string[]> = {
  'Turbo & boost': ['Turbo shaft play', 'Boost leak test', 'Intercooler boots & clamps'],
  'Fuel system': ['Injector balance rates', 'Fuel filter / water separator', 'Lift pump pressure'],
  Engine: ['Oil leaks', 'Blow-by', 'Head gasket / coolant loss'],
  Cooling: ['Coolant condition', 'Radiator & hoses', 'Water pump'],
  Transmission: ['Fluid condition', 'Shift quality / slip', 'Cooler lines'],
  Electrical: ['Batteries & load test', 'Glow plugs', 'Stored codes'],
  Exhaust: ['DPF soot load', 'EGR valve & cooler', 'Exhaust leaks'],
  Tuning: ['ECU software version', 'Stock file on record', 'Datalog review'],
  'Suspension & brakes': ['Front end play', 'Brake pads & rotors', 'Steering box'],
};

function ItemFields() {
  const [rating, setRating] = useState<Rating | null>(null);
  const [category, setCategory] = useState<(typeof INSPECTION_CATEGORIES)[number]>(INSPECTION_CATEGORIES[0]);
  const listId = `quick-labels-${category.replace(/\W+/g, '-')}`;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category">
          {(id) => (
            <select id={id} name="category" value={category} onChange={(event) => setCategory(event.currentTarget.value as typeof category)} className={shopField}>
              {INSPECTION_CATEGORIES.map((option) => <option key={option}>{option}</option>)}
            </select>
          )}
        </Field>
        <Field label="What you checked">
          {(id) => (
            <>
              <input id={id} name="label" required maxLength={120} list={listId} autoComplete="off" placeholder={QUICK_LABELS[category][0]} className={shopField} />
              <datalist id={listId}>{QUICK_LABELS[category].map((option) => <option key={option} value={option} />)}</datalist>
            </>
          )}
        </Field>
      </div>
      <div>
        <p id="new-item-rating" className="mb-1.5 text-sm font-semibold text-chalk/85">Condition</p>
        <RatingToggle value={rating} onChange={setRating} label="Condition of new item" />
        <input type="hidden" name="rating" value={rating ?? ''} />
      </div>
      <Field label="Notes" hint="What the customer should know. Plain words.">
        {(id) => <textarea id={id} name="notes" maxLength={1000} rows={2} className={shopTextarea} placeholder="e.g. Shaft has radial play, oil seeping at the compressor side." />}
      </Field>
    </>
  );
}

export function AddItemForm({ workOrderId }: { workOrderId: string }) {
  const { state, pending, onSubmit } = useShopForm(addInspectionItem);
  return (
    <form onSubmit={onSubmit} className="grid grid-cols-[minmax(0,1fr)] gap-4 rounded-md border border-dashed border-chalk/20 bg-carbon p-4">
      <p className="kicker text-sm">Add finding</p>
      <input type="hidden" name="workOrderId" value={workOrderId} />
      <ItemFields key={state.savedAt ?? 0} />
      <PendingButton pending={pending} pendingLabel="Adding…" className="h-14 text-lg">
        <Plus className="size-5" aria-hidden="true" /> Add item
      </PendingButton>
      <FormMessage state={state} />
    </form>
  );
}

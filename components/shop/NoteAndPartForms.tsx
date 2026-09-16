'use client';

import { Eye, EyeOff, Package, StickyNote } from 'lucide-react';
import { useState } from 'react';
import { addNote, requestPart } from '@/app/shop/jobs/[id]/actions';
import { Field, shopField, shopTextarea } from './fields';
import { FormMessage } from './FormMessage';
import { PendingButton, useShopForm } from './useShopForm';

function NoteFields() {
  const [visible, setVisible] = useState(false);
  return (
    <>
      <Field label="Note">
        {(id) => <textarea id={id} name="body" required maxLength={2000} rows={3} className={shopTextarea} placeholder="What you found, what you did, what’s next" />}
      </Field>
      <label className={`flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-sm border px-3 py-2 transition-colors has-focus-visible:border-clover ${visible ? 'border-amber-400/50 bg-amber-400/10' : 'border-line bg-carbon'}`}>
        <span className="flex items-center gap-2 font-semibold">
          {visible ? <Eye className="size-5 text-amber-300" aria-hidden="true" /> : <EyeOff className="size-5 text-steel" aria-hidden="true" />}
          {visible ? 'Customer can see this' : 'Internal — shop only'}
        </span>
        <input type="checkbox" role="switch" name="visibleToCustomer" checked={visible} onChange={(event) => setVisible(event.currentTarget.checked)} className="size-6 accent-[var(--clover)]" aria-label="Visible to customer" />
      </label>
    </>
  );
}

export function NoteForm({ workOrderId }: { workOrderId: string }) {
  const { state, pending, onSubmit } = useShopForm(addNote);
  return (
    <form onSubmit={onSubmit} className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <input type="hidden" name="workOrderId" value={workOrderId} />
      <NoteFields key={state.savedAt ?? 0} />
      <PendingButton pending={pending} pendingLabel="Saving…" variant="secondary" className="h-12 text-base">
        <StickyNote className="size-5" aria-hidden="true" /> Save note
      </PendingButton>
      <FormMessage state={state} />
    </form>
  );
}

export function PartRequestForm({ workOrderId }: { workOrderId: string }) {
  const { state, pending, onSubmit } = useShopForm(requestPart);
  return (
    <form onSubmit={onSubmit} className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <input type="hidden" name="workOrderId" value={workOrderId} />
      <Field key={state.savedAt ?? 0} label="Part needed" hint="Part number if you have it.">
        {(id) => <input id={id} name="description" required maxLength={300} className={shopField} placeholder="e.g. Turbo inlet gasket, 12345678" />}
      </Field>
      <PendingButton pending={pending} pendingLabel="Requesting…" variant="secondary" className="h-12 text-base">
        <Package className="size-5" aria-hidden="true" /> Request part
      </PendingButton>
      <FormMessage state={state} />
    </form>
  );
}

'use client';

import { Plus, Send, Trash2 } from 'lucide-react';
import { useActionState } from 'react';
import { recipientAction } from '@/app/admin/settings/recipient-actions';
import { SubmitButton } from '@/components/app/SubmitButton';
import { Card, fieldClass, labelClass } from '@/components/app/ui';
import { deliveryNotes, duplicateNotes, type DeliveryMode } from '@/lib/automations/owner-select';
import type { Tables } from '@/lib/db/database.types';
import type { ActionState } from './form';
import { FormMessage } from './FormMessage';

export interface OwnerRecipientsProps {
  recipients: Tables<'owner_recipients'>[];
  mode: DeliveryMode;
  /** Shown when nobody is listed and shop_settings is carrying the alerts. */
  fallbackLabel: string;
}

function Toggle({ name, defaultChecked, children }: { name: string; defaultChecked: boolean; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-2 text-sm font-semibold text-chalk/85">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="size-4 accent-[var(--clover)]" />
      {children}
    </label>
  );
}

function RecipientForm({ recipient, mode, duplicates = [] }: { recipient: Tables<'owner_recipients'> | null; mode: DeliveryMode; duplicates?: string[] }) {
  const [state, action] = useActionState<ActionState, FormData>(recipientAction, {});
  const id = recipient?.id ?? 'new';
  const notes = recipient ? [...duplicates, ...deliveryNotes(recipient, mode)] : [];

  return (
    <form action={action} key={recipient?.id ?? `new-${state.at ?? 0}`} className="grid gap-4 rounded-md border border-line bg-carbon p-4">
      {recipient && <input type="hidden" name="id" value={recipient.id} />}
      <div className="grid gap-4 md:grid-cols-[1.2fr_1.2fr_1fr]">
        <div>
          <label htmlFor={`label-${id}`} className={labelClass}>Who</label>
          <input id={`label-${id}`} name="label" required maxLength={80} placeholder="Scotty — developer" defaultValue={recipient?.label ?? ''} className={fieldClass} />
        </div>
        <div>
          <label htmlFor={`email-${id}`} className={labelClass}>Email</label>
          <input id={`email-${id}`} name="email" type="email" maxLength={254} defaultValue={recipient?.email ?? ''} className={fieldClass} />
        </div>
        <div>
          <label htmlFor={`phone-${id}`} className={labelClass}>Mobile</label>
          <input id={`phone-${id}`} name="phone" type="tel" maxLength={30} defaultValue={recipient?.phone ?? ''} className={fieldClass} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <Toggle name="notify_email" defaultChecked={recipient?.notify_email ?? true}>Email alerts</Toggle>
        <Toggle name="notify_sms" defaultChecked={recipient?.notify_sms ?? true}>Text alerts</Toggle>
        <Toggle name="active" defaultChecked={recipient?.active ?? true}>Active</Toggle>
      </div>

      {notes.length > 0 && (
        <ul className="grid gap-1 border-l-2 border-amber-400/40 pl-3 text-xs leading-relaxed text-chalk/60">
          {notes.map((note) => <li key={note}>{note}</li>)}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <SubmitButton name="intent" value="save" size="sm" pendingLabel="Saving…">
          {recipient ? 'Save' : <><Plus className="size-4" aria-hidden="true" />Add recipient</>}
        </SubmitButton>
        {recipient && (
          <>
            <SubmitButton name="intent" value="test" variant="secondary" size="sm" pendingLabel="Sending…">
              <Send className="size-4" aria-hidden="true" />Send test alert
            </SubmitButton>
            <SubmitButton name="intent" value="remove" variant="danger" size="sm" pendingLabel="Removing…">
              <Trash2 className="size-4" aria-hidden="true" />Remove
            </SubmitButton>
          </>
        )}
        <FormMessage state={state} className="basis-full sm:basis-auto" />
      </div>
    </form>
  );
}

/** Add, edit and test everyone who receives owner alerts. */
export function OwnerRecipients({ recipients, mode, fallbackLabel }: OwnerRecipientsProps) {
  const activeCount = recipients.filter((r) => r.active).length;
  const duplicates = duplicateNotes(recipients);

  return (
    <Card title="Who gets alerts" className="scroll-mt-24" >
      <p className="text-sm leading-relaxed text-chalk/65">
        Every owner alert — new lead, booking, approval needed, the daily summary, negative reviews and marketing alerts — goes to
        everyone listed here, on the channels they switch on. Identical addresses are only sent once.
      </p>
      {recipients.length === 0 && (
        <p className="mt-3 rounded-sm border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">
          Nobody is listed yet, so alerts fall back to the single owner contact above ({fallbackLabel}).
        </p>
      )}
      {recipients.length > 0 && activeCount === 0 && (
        <p className="mt-3 rounded-sm border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">
          Every recipient is switched off, so alerts fall back to the single owner contact above ({fallbackLabel}).
        </p>
      )}

      <div className="mt-4 grid gap-3">
        {recipients.map((recipient, index) => <RecipientForm key={recipient.id} recipient={recipient} mode={mode} duplicates={duplicates[index]} />)}
      </div>

      <div className="mt-5 border-t border-line pt-5">
        <h3 className="display mb-3 text-lg not-italic">Add someone</h3>
        <RecipientForm recipient={null} mode={mode} />
      </div>
    </Card>
  );
}

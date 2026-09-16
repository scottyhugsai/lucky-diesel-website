'use client';

import { MailPlus, MessageSquareOff, MessageSquareText } from 'lucide-react';
import { createCustomer, inviteToPortal, updateCustomer, updateSmsConsent } from '@/app/admin/customers/actions';
import { fieldClass, labelClass } from '@/components/app/ui';
import type { Tables } from '@/lib/db/database.types';
import { ActionForm, PendingButton } from './ActionForm';

const SOURCES = [
  ['walk-in', 'Walk-in'], ['phone', 'Phone call'], ['website', 'Website'], ['instagram', 'Instagram'], ['facebook', 'Facebook'],
  ['tiktok', 'TikTok'], ['google', 'Google'], ['referral', 'Referral'], ['other', 'Other'],
] as const;

type Customer = Pick<Tables<'customers'>, 'id' | 'full_name' | 'phone' | 'email' | 'source' | 'notes'>;

export function CustomerForm({ customer }: { customer?: Customer }) {
  const knownSource = SOURCES.some(([value]) => value === customer?.source);
  return (
    <ActionForm action={customer ? updateCustomer : createCustomer} className="grid gap-4 sm:grid-cols-2">
      {customer && <input type="hidden" name="customer_id" value={customer.id} />}
      <div className="sm:col-span-2"><label htmlFor="c-name" className={labelClass}>Full name</label><input id="c-name" name="full_name" required maxLength={120} defaultValue={customer?.full_name} autoComplete="off" className={fieldClass} /></div>
      <div><label htmlFor="c-phone" className={labelClass}>Mobile phone</label><input id="c-phone" name="phone" type="tel" inputMode="tel" defaultValue={customer?.phone ?? ''} placeholder="(843) 555-0100" className={fieldClass} /></div>
      <div><label htmlFor="c-email" className={labelClass}>Email</label><input id="c-email" name="email" type="email" defaultValue={customer?.email ?? ''} className={fieldClass} /></div>
      <div><label htmlFor="c-source" className={labelClass}>How they found us</label>
        <select id="c-source" name="source" defaultValue={knownSource ? customer?.source : customer ? 'other' : 'walk-in'} className={fieldClass}>
          {SOURCES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      <div className="sm:col-span-2"><label htmlFor="c-notes" className={labelClass}>Notes</label><textarea id="c-notes" name="notes" rows={3} maxLength={4000} defaultValue={customer?.notes ?? ''} placeholder="Tows a camper, prefers texts after 5pm…" className={`${fieldClass} h-auto py-2`} /></div>
      <div className="sm:col-span-2">
        <PendingButton variant={customer ? 'secondary' : 'primary'} size={customer ? 'sm' : 'md'}>{customer ? 'Save contact' : 'Create customer'}</PendingButton>
      </div>
    </ActionForm>
  );
}

export function ConsentControls({ customerId, status }: { customerId: string; status: 'consented' | 'opted_out' | 'none' }) {
  if (status === 'consented') {
    return (
      <ActionForm action={updateSmsConsent} confirm="Record that this customer opted out of texts? Automated texts stop immediately.">
        <input type="hidden" name="customer_id" value={customerId} />
        <PendingButton variant="danger" size="sm" name="change" value="opt_out"><MessageSquareOff className="size-4" aria-hidden="true" /> Record opt-out</PendingButton>
      </ActionForm>
    );
  }
  return (
    <ActionForm action={updateSmsConsent} className="grid gap-2">
      <input type="hidden" name="customer_id" value={customerId} />
      <label className="flex items-start gap-2 text-sm text-chalk/75">
        <input type="checkbox" name="confirm_consent" className="mt-0.5 size-4 shrink-0 accent-[var(--clover)]" />
        Customer gave express permission (in person or by phone) to receive automated texts about their truck.
      </label>
      <PendingButton variant="secondary" size="sm" name="change" value="record_consent" className="justify-self-start">
        <MessageSquareText className="size-4" aria-hidden="true" /> Record consent
      </PendingButton>
    </ActionForm>
  );
}

export function InviteButton({ customerId, hasEmail }: { customerId: string; hasEmail: boolean }) {
  return (
    <ActionForm action={inviteToPortal} confirm="Send a portal invite email to this customer?">
      <input type="hidden" name="customer_id" value={customerId} />
      <PendingButton variant="secondary" size="sm" disabled={!hasEmail} title={hasEmail ? undefined : 'Add an email first'}>
        <MailPlus className="size-4" aria-hidden="true" /> Invite to portal
      </PendingButton>
    </ActionForm>
  );
}

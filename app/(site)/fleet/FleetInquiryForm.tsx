'use client';

import { Check, LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { Field, inputClass } from '@/components/quote/Field';
import type { InquiryField } from '@/lib/marketing/fleet/fleet-inquiry';
import { BUSINESS } from '@/lib/site';

type Status = 'idle' | 'sending' | 'sent' | 'error';

const BLANK = { name: '', contactName: '', email: '', phone: '', truckCount: '', city: '', notes: '', company: '' };

/** Posts to /api/marketing/fleet, which files the company as a prospect. */
export function FleetInquiryForm() {
  const [values, setValues] = useState(BLANK);
  const [errors, setErrors] = useState<Partial<Record<InquiryField, string>>>({});
  const [status, setStatus] = useState<Status>('idle');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('sending');
    try {
      const response = await fetch('/api/marketing/fleet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data: { ok?: boolean; errors?: Partial<Record<InquiryField, string>> } = await response.json().catch(() => ({}));
      if (response.status === 422 && data.errors) {
        setErrors(data.errors);
        setStatus('idle');
        return;
      }
      setStatus(response.ok && data.ok ? 'sent' : 'error');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'sent') {
    return (
      <div role="status" className="grid gap-3 rounded-md border border-clover/40 bg-carbon-2 p-6">
        <p className="kicker flex items-center gap-2"><Check className="size-4" aria-hidden="true" /> Got it</p>
        <p className="text-chalk/85">We’ll call to talk through your units and terms. Need us sooner? Call {BUSINESS.phoneDisplay}.</p>
      </div>
    );
  }

  const set = (key: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValues((v) => ({ ...v, [key]: e.target.value }));

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      <input type="text" name="company" value={values.company} onChange={set('company')} tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="fleet-name" label="Company" error={errors.name} className="sm:col-span-2">
          <input id="field-fleet-name" autoComplete="organization" required value={values.name} onChange={set('name')} className={inputClass(errors.name)} aria-invalid={Boolean(errors.name)} />
        </Field>
        <Field id="fleet-contact" label="Your name" error={errors.contactName}>
          <input id="field-fleet-contact" autoComplete="name" required value={values.contactName} onChange={set('contactName')} className={inputClass(errors.contactName)} aria-invalid={Boolean(errors.contactName)} />
        </Field>
        <Field id="fleet-phone" label="Phone" error={errors.phone}>
          <input id="field-fleet-phone" type="tel" inputMode="tel" autoComplete="tel" required value={values.phone} onChange={set('phone')} className={inputClass(errors.phone)} aria-invalid={Boolean(errors.phone)} />
        </Field>
        <Field id="fleet-email" label="Email" error={errors.email}>
          <input id="field-fleet-email" type="email" inputMode="email" autoComplete="email" required value={values.email} onChange={set('email')} className={inputClass(errors.email)} aria-invalid={Boolean(errors.email)} />
        </Field>
        <Field id="fleet-trucks" label="Trucks" optional error={errors.truckCount}>
          <input id="field-fleet-trucks" type="number" inputMode="numeric" min={1} max={100000} value={values.truckCount} onChange={set('truckCount')} className={inputClass(errors.truckCount)} aria-invalid={Boolean(errors.truckCount)} />
        </Field>
        <Field id="fleet-city" label="City" optional className="sm:col-span-2">
          <input id="field-fleet-city" autoComplete="address-level2" value={values.city} onChange={set('city')} className={inputClass()} />
        </Field>
        <Field id="fleet-notes" label="What do you run?" optional className="sm:col-span-2">
          <textarea id="field-fleet-notes" rows={3} maxLength={1000} value={values.notes} onChange={set('notes')} className={`${inputClass()} h-auto py-3`} />
        </Field>
      </div>
      <button type="submit" disabled={status === 'sending'} className="btn-go display inline-flex items-center justify-center gap-2 rounded-sm px-6 py-3.5 text-xl not-italic disabled:opacity-70">
        {status === 'sending' ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : null}
        Request a quote
      </button>
      {status === 'error' && <p role="alert" className="text-sm text-danger">That didn’t go through. Call {BUSINESS.phoneDisplay} and we’ll sort it out.</p>}
    </form>
  );
}

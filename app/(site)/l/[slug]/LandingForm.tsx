'use client';

import { Check, LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { Field, inputClass } from '@/components/quote/Field';
import { SMS_CONSENT_TEXT, type LeadField } from '@/lib/lead';
import { BUSINESS, OTHER_PLATFORM, PLATFORMS } from '@/lib/site';

interface LandingFormProps {
  service: string;
  offerTag: string;
  offerLabel: string | null;
  submitLabel: string;
}

type Status = 'idle' | 'sending' | 'sent' | 'error';
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid'] as const;

/** Posts to the existing /api/lead, tagging the request with the offer and any UTM parameters. */
export function LandingForm({ service, offerTag, offerLabel, submitLabel }: LandingFormProps) {
  const [values, setValues] = useState({ name: '', phone: '', email: '', platform: '', notes: '', company: '' });
  const [smsConsent, setSmsConsent] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<LeadField, string>>>({});
  const [status, setStatus] = useState<Status>('idle');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('sending');
    const params = new URLSearchParams(window.location.search);
    const utm = Object.fromEntries(UTM_KEYS.flatMap((k) => (params.get(k) ? [[k, params.get(k)!.slice(0, 100)]] : [])));
    const tag = [`offer:${offerTag}`, ...Object.entries(utm).map(([k, v]) => `${k}:${v}`)].join(' ');
    const details = `[${tag}] ${offerLabel ? `Claiming: ${offerLabel}. ` : ''}${values.notes.trim() || 'Sent from a landing page.'}`;
    try {
      const response = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: values.name, phone: values.phone, email: values.email, platform: values.platform, generation: '', mileage: '', service, details, smsConsent, company: values.company, offerTag, ...utm }),
      });
      const data: { ok?: boolean; errors?: Partial<Record<LeadField, string>> } = await response.json().catch(() => ({}));
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
        <p className="text-chalk/85">We’ll reach out shortly to lock in your spot. Need us sooner? Call {BUSINESS.phoneDisplay}.</p>
      </div>
    );
  }

  const set = (key: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setValues((v) => ({ ...v, [key]: e.target.value }));

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      <input type="text" name="company" value={values.company} onChange={set('company')} tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="name" label="Name" error={errors.name} className="sm:col-span-2">
          <input id="field-name" autoComplete="name" required value={values.name} onChange={set('name')} className={inputClass(errors.name)} aria-invalid={Boolean(errors.name)} />
        </Field>
        <Field id="phone" label="Phone" error={errors.phone}>
          <input id="field-phone" type="tel" inputMode="tel" autoComplete="tel" required value={values.phone} onChange={set('phone')} className={inputClass(errors.phone)} aria-invalid={Boolean(errors.phone)} />
        </Field>
        <Field id="email" label="Email" error={errors.email}>
          <input id="field-email" type="email" inputMode="email" autoComplete="email" required value={values.email} onChange={set('email')} className={inputClass(errors.email)} aria-invalid={Boolean(errors.email)} />
        </Field>
        <Field id="platform" label="Truck" error={errors.platform} className="sm:col-span-2">
          <select id="field-platform" required value={values.platform} onChange={set('platform')} className={inputClass(errors.platform)} aria-invalid={Boolean(errors.platform)}>
            <option value="">Pick your truck</option>
            {PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.make})</option>)}
            <option value={OTHER_PLATFORM}>Other</option>
          </select>
        </Field>
        <Field id="details" label="Anything we should know?" optional error={errors.details} className="sm:col-span-2">
          <textarea id="field-details" rows={3} value={values.notes} onChange={set('notes')} className={`${inputClass(errors.details)} h-auto py-3`} maxLength={1500} />
        </Field>
      </div>
      <label className="flex gap-3 text-sm text-steel">
        <input type="checkbox" checked={smsConsent} onChange={(e) => setSmsConsent(e.target.checked)} className="mt-1 size-4 accent-[var(--clover)]" />
        <span>{SMS_CONSENT_TEXT}</span>
      </label>
      <button type="submit" disabled={status === 'sending'} className="btn-go display inline-flex items-center justify-center gap-2 rounded-sm px-6 py-3.5 text-xl not-italic disabled:opacity-70">
        {status === 'sending' ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : null}
        {submitLabel}
      </button>
      {status === 'error' && <p role="alert" className="text-sm text-danger">That didn’t go through. Call {BUSINESS.phoneDisplay} and we’ll sort it out.</p>}
    </form>
  );
}

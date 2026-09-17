'use client';

import Link from 'next/link';
import { Check, LoaderCircle, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { parseLead, SMS_CONSENT_TEXT, type LeadField } from '@/lib/lead';
import { BUSINESS } from '@/lib/site';
import type { Plan } from './recommend';
import { generationLabel, type PlannerState } from './state';
import { planDetails } from './summary';
import { BTN_PRIMARY, INPUT } from './ui';

type Status = { kind: 'idle' } | { kind: 'sending' } | { kind: 'sent' } | { kind: 'error'; message: string };
type Values = Record<'name' | 'phone' | 'email' | 'company', string>;

interface QuoteRequestProps {
  state: PlannerState;
  plan: Plan | null;
  submitLabel?: string;
}

const FIELDS = [
  { key: 'name', label: 'Name', type: 'text', autoComplete: 'name', inputMode: 'text' },
  { key: 'phone', label: 'Phone', type: 'tel', autoComplete: 'tel', inputMode: 'tel' },
  { key: 'email', label: 'Email', type: 'email', autoComplete: 'email', inputMode: 'email' },
] as const;

/** Install quote for the plan. Posts to /api/lead, which alerts the shop and auto-replies. */
export function QuoteRequest({ state, plan, submitLabel = 'Get my install quote' }: QuoteRequestProps) {
  const [values, setValues] = useState<Values>({ name: '', phone: '', email: '', company: '' });
  const [smsConsent, setSmsConsent] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<LeadField, string>>>({});
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const picks = plan?.stages.flatMap((s) => s.picks) ?? [];
  const payload = {
    ...values,
    platform: state.platform ?? '',
    generation: generationLabel(state.platform, state.gen),
    mileage: state.miles,
    service: picks.length > 0 && picks.every((p) => p.product.category === 'tuning') ? 'tuning' : 'engine',
    details: planDetails(state, plan),
    smsConsent,
  };

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseLead(payload);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      const first = FIELDS.find((f) => f.key in parsed.errors);
      if (first) document.getElementById(`quote-${first.key}`)?.focus();
      if (!first && !parsed.spam) setStatus({ kind: 'error', message: 'Something’s missing from the plan.' });
      return;
    }
    setStatus({ kind: 'sending' });
    try {
      const response = await fetch('/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data: { ok?: boolean; message?: string; errors?: Partial<Record<LeadField, string>> } = await response.json().catch(() => ({}));
      if (response.status === 422 && data.errors) {
        setErrors(data.errors);
        setStatus({ kind: 'idle' });
        return;
      }
      setStatus(response.ok && data.ok ? { kind: 'sent' } : { kind: 'error', message: data.message ?? 'That didn’t go through.' });
    } catch {
      setStatus({ kind: 'error', message: 'No connection.' });
    }
  }

  if (status.kind === 'sent') {
    return (
      <div role="status" className="flex items-start gap-3 rounded-sm border border-clover/40 bg-clover/10 p-4 [[data-design=v2]_&]:rounded-2xl">
        <Check className="mt-0.5 size-5 shrink-0 text-clover" aria-hidden="true" />
        <p><strong className="font-semibold">Plan sent.</strong> <span className="text-chalk/75">We’ll text or call with your install quote.</span></p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-3">
      {FIELDS.map((field) => (
        <div key={field.key}>
          <label htmlFor={`quote-${field.key}`} className="mb-1.5 block text-sm font-semibold text-chalk/85">{field.label}</label>
          <input
            id={`quote-${field.key}`}
            type={field.type}
            inputMode={field.inputMode}
            autoComplete={field.autoComplete}
            required
            value={values[field.key]}
            onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
            aria-invalid={Boolean(errors[field.key])}
            aria-describedby={errors[field.key] ? `quote-${field.key}-error` : undefined}
            className={`${INPUT} ${errors[field.key] ? 'border-danger' : ''}`}
          />
          {errors[field.key] && <p id={`quote-${field.key}-error`} className="mt-1 text-sm text-danger">{errors[field.key]}</p>}
        </div>
      ))}
      <div aria-hidden="true" className="absolute -left-[9999px] size-px overflow-hidden">
        <label>Company<input tabIndex={-1} autoComplete="off" value={values.company} onChange={(e) => setValues((v) => ({ ...v, company: e.target.value }))} /></label>
      </div>
      <label className="flex cursor-pointer items-start gap-3 rounded-sm border border-line p-3 text-xs leading-relaxed text-chalk/65 has-[:checked]:border-clover/50 [[data-design=v2]_&]:rounded-xl">
        <input type="checkbox" checked={smsConsent} onChange={(e) => setSmsConsent(e.target.checked)} className="mt-0.5 size-4 shrink-0" />
        <span>{SMS_CONSENT_TEXT} <Link href="/privacy" className="underline underline-offset-2 hover:text-clover">Privacy</Link></span>
      </label>
      {status.kind === 'error' && (
        <p role="alert" className="flex items-start gap-2 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
          <span>{status.message} Call or text <a className="font-semibold underline" href={BUSINESS.phoneHref}>{BUSINESS.phoneDisplay}</a>.</span>
        </p>
      )}
      <button type="submit" disabled={status.kind === 'sending'} className={`${BTN_PRIMARY} w-full`}>
        {status.kind === 'sending' && <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />}
        {status.kind === 'sending' ? 'Sending…' : submitLabel}
      </button>
    </form>
  );
}

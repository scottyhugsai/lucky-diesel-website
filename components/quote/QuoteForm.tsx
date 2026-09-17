'use client';

import Link from 'next/link';
import { Check, LoaderCircle, Mail, MessageSquare, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { parseLead, SMS_CONSENT_TEXT, type Lead, type LeadField } from '@/lib/lead';
import { HEARD_ABOUT_OPTIONS, formatRange, priceRangeFor, type PriceRange } from '@/lib/marketing/engage/rules';
import { BUSINESS, OTHER_PLATFORM, OTHER_SERVICE, PLATFORMS, SERVICES } from '@/lib/site';
import { ReferFriendPrompt } from '@/components/marketing-public/ReferFriendPrompt';
import { Field, inputClass } from './Field';

interface QuoteFormProps {
  initialPlatform: string;
  initialService: string;
}

type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent'; lead: Lead }
  | { kind: 'fallback'; lead: Lead }
  | { kind: 'error'; message: string };

type Values = Record<'name' | 'phone' | 'email' | 'platform' | 'generation' | 'mileage' | 'service' | 'details' | 'company' | 'heardAbout' | 'vin', string>;

const PLATFORM_OPTIONS = [
  ...PLATFORMS.map((p) => ({ id: p.id as string, label: p.name })),
  { id: OTHER_PLATFORM as string, label: 'Other' },
];

function fallbackBody(lead: Lead): string {
  return `Service request\nName: ${lead.name}\nPhone: ${lead.phone}\nTruck: ${lead.platformLabel}\nMileage: ${lead.mileage || '-'}\nService: ${lead.serviceLabel}\n\n${lead.details}`;
}

export function QuoteForm({ initialPlatform, initialService }: QuoteFormProps) {
  const [values, setValues] = useState<Values>({
    name: '',
    phone: '',
    email: '',
    platform: PLATFORM_OPTIONS.some((p) => p.id === initialPlatform) ? initialPlatform : '',
    generation: '',
    mileage: '',
    service: SERVICES.some((s) => s.id === initialService) ? initialService : '',
    details: '',
    company: '',
    heardAbout: '',
    vin: '',
  });
  const [errors, setErrors] = useState<Partial<Record<LeadField, string>>>({});
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [smsConsent, setSmsConsent] = useState(false);
  const [ranges, setRanges] = useState<PriceRange[]>([]);
  const [vinState, setVinState] = useState<{ kind: 'idle' | 'looking' } | { kind: 'error'; message: string } | { kind: 'done'; label: string }>({ kind: 'idle' });

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/marketing/engage', { signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<{ priceRanges?: PriceRange[] }>) : null))
      .then((data) => { if (data?.priceRanges?.length) setRanges(data.priceRanges); })
      .catch(() => { /* no ranges: the form works the same */ });
    return () => controller.abort();
  }, []);

  /** Free NHTSA decode: fills the truck and engine so they don't have to guess. */
  async function decodeVin() {
    const vin = values.vin.trim();
    if (vin.length !== 17) {
      setVinState({ kind: 'error', message: 'VINs are 17 letters and numbers.' });
      return;
    }
    setVinState({ kind: 'looking' });
    try {
      const response = await fetch(`/api/marketing/vin?vin=${encodeURIComponent(vin)}`);
      const data = (await response.json()) as { ok?: boolean; error?: string; year?: number; make?: string; model?: string; platform?: string; generation?: string };
      if (!data.ok) {
        setVinState({ kind: 'error', message: data.error ?? 'Couldn’t decode that VIN.' });
        return;
      }
      setValues((current) => ({
        ...current,
        platform: data.platform && PLATFORM_OPTIONS.some((p) => p.id === data.platform) ? data.platform : current.platform,
        generation: data.generation ?? current.generation,
      }));
      setVinState({ kind: 'done', label: [data.year, data.make, data.model].filter(Boolean).join(' ') || 'Truck found' });
    } catch {
      setVinState({ kind: 'error', message: 'Lookup failed. Pick your truck below.' });
    }
  }

  const platform = PLATFORMS.find((p) => p.id === values.platform);

  const update = (key: keyof Values, value: string) => {
    setValues((current) => ({ ...current, [key]: value, ...(key === 'platform' ? { generation: '' } : {}) }));
    if (key in errors) {
      setErrors((current) => Object.fromEntries(Object.entries(current).filter(([field]) => field !== key)));
    }
  };

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseLead(values);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      const first = Object.keys(parsed.errors)[0];
      if (first) document.getElementById(`field-${first}`)?.focus();
      return;
    }

    setStatus({ kind: 'sending' });
    try {
      const response = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, smsConsent }),
      });
      const data: { ok?: boolean; delivered?: boolean; message?: string; errors?: Partial<Record<LeadField, string>> } =
        await response.json().catch(() => ({}));

      if (response.status === 422 && data.errors) {
        setErrors(data.errors);
        setStatus({ kind: 'idle' });
        return;
      }
      if (!response.ok || !data.ok) {
        setStatus({ kind: 'error', message: data.message ?? 'That didn’t go through.' });
        return;
      }
      setStatus(data.delivered ? { kind: 'sent', lead: parsed.lead } : { kind: 'fallback', lead: parsed.lead });
    } catch {
      setStatus({ kind: 'fallback', lead: parsed.lead });
    }
  }

  if (status.kind === 'sent') return <SentPanel lead={status.lead} />;
  if (status.kind === 'fallback') return <FallbackPanel lead={status.lead} />;

  const isSending = status.kind === 'sending';

  return (
    <form onSubmit={submit} noValidate className="grid gap-5" aria-describedby={status.kind === 'error' ? 'form-error' : undefined}>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="name" label="Name" error={errors.name} className="sm:col-span-2">
          <input id="field-name" name="name" autoComplete="name" required value={values.name} onChange={(e) => update('name', e.target.value)} className={inputClass(errors.name)} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'error-name' : undefined} />
        </Field>
        <Field id="phone" label="Phone" error={errors.phone}>
          <input id="field-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" required value={values.phone} onChange={(e) => update('phone', e.target.value)} className={inputClass(errors.phone)} aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? 'error-phone' : undefined} />
        </Field>
        <Field id="email" label="Email" error={errors.email}>
          <input id="field-email" name="email" type="email" inputMode="email" autoComplete="email" required value={values.email} onChange={(e) => update('email', e.target.value)} className={inputClass(errors.email)} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'error-email' : undefined} />
        </Field>
      </div>

      <fieldset aria-describedby={errors.platform ? 'error-platform' : undefined}>
        <legend className="mb-2 text-sm font-semibold text-chalk/85">Truck</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PLATFORM_OPTIONS.map((option, index) => (
            <label key={option.id} className="relative">
              <input
                id={index === 0 ? 'field-platform' : undefined}
                type="radio"
                name="platform"
                value={option.id}
                checked={values.platform === option.id}
                onChange={() => update('platform', option.id)}
                className="peer sr-only"
              />
              <span className="display flex h-13 cursor-pointer items-center justify-center rounded-sm border border-line bg-carbon text-xl not-italic transition-colors duration-150 hover:border-chalk/40 peer-checked:border-clover peer-checked:bg-clover peer-checked:text-carbon peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-clover">
                {option.label}
              </span>
            </label>
          ))}
        </div>
        {errors.platform && <p id="error-platform" className="mt-1.5 text-sm text-danger">{errors.platform}</p>}
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-[2fr_1fr]">
        {platform && (
          <Field id="generation" label={`${platform.name} engine`} error={errors.generation} optional>
            <select id="field-generation" name="generation" value={values.generation} onChange={(e) => update('generation', e.target.value)} className={inputClass(errors.generation)} aria-invalid={Boolean(errors.generation)}>
              <option value="">Not sure</option>
              {platform.generations.map((generation) => (
                <option key={generation} value={generation}>{generation}</option>
              ))}
            </select>
          </Field>
        )}
        <Field id="mileage" label="Mileage" optional className={platform ? '' : 'sm:col-span-2'}>
          <input id="field-mileage" name="mileage" inputMode="numeric" value={values.mileage} onChange={(e) => update('mileage', e.target.value)} className={inputClass()} maxLength={20} />
        </Field>
      </div>

      <Field id="service" label="What do you need?" error={errors.service}>
        <select id="field-service" name="service" required value={values.service} onChange={(e) => update('service', e.target.value)} className={inputClass(errors.service)} aria-invalid={Boolean(errors.service)} aria-describedby={errors.service ? 'error-service' : undefined}>
          <option value="" disabled>Pick a service</option>
          {SERVICES.map((service) => (
            <option key={service.id} value={service.id}>{service.name}</option>
          ))}
          <option value={OTHER_SERVICE}>Something else</option>
        </select>
      </Field>

      {(() => {
        const range = values.service ? priceRangeFor(ranges, values.service, values.platform || 'any') : null;
        return range ? (
          <p className="-mt-2 text-sm text-chalk/65">
            Most of these start around <strong className="font-mono text-chalk">{formatRange(range)}</strong>. We confirm after we see the truck.
          </p>
        ) : null;
      })()}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="vin" label="VIN" optional>
          <div className="flex gap-2">
            <input id="field-vin" name="vin" value={values.vin} onChange={(e) => { update('vin', e.target.value.toUpperCase()); setVinState({ kind: 'idle' }); }} maxLength={17} autoComplete="off" spellCheck={false} className={inputClass()} placeholder="Optional — fills your truck in" />
            <button type="button" onClick={decodeVin} disabled={vinState.kind === 'looking'} className="h-13 shrink-0 rounded-sm border border-line px-3 text-sm font-semibold text-chalk/80 hover:border-clover hover:text-clover disabled:opacity-60">
              {vinState.kind === 'looking' ? 'Checking…' : 'Look up'}
            </button>
          </div>
          <p aria-live="polite" className={`mt-1 text-xs ${vinState.kind === 'error' ? 'text-danger' : 'text-steel'}`}>
            {vinState.kind === 'error' ? vinState.message : vinState.kind === 'done' ? vinState.label : ''}
          </p>
        </Field>
        <Field id="heardAbout" label="How did you hear about us?" optional>
          <select id="field-heardAbout" name="heardAbout" value={values.heardAbout} onChange={(e) => update('heardAbout', e.target.value)} className={inputClass()}>
            <option value="">Rather not say</option>
            {HEARD_ABOUT_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </Field>
      </div>

      <Field id="details" label="Tell us about it" error={errors.details}>
        <textarea id="field-details" name="details" required rows={4} maxLength={2000} value={values.details} onChange={(e) => update('details', e.target.value)} placeholder="Symptoms, goals, parts you already have…" className={`${inputClass(errors.details)} h-auto resize-y py-3`} aria-invalid={Boolean(errors.details)} aria-describedby={errors.details ? 'error-details' : undefined} />
      </Field>

      <div aria-hidden="true" className="absolute -left-[9999px] size-px overflow-hidden">
        <label>
          Company
          <input tabIndex={-1} autoComplete="off" name="company" value={values.company} onChange={(e) => update('company', e.target.value)} />
        </label>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-sm border border-line bg-carbon p-3 text-xs leading-relaxed text-chalk/65 has-[:checked]:border-clover/50">
        <input
          type="checkbox"
          name="smsConsent"
          checked={smsConsent}
          onChange={(e) => setSmsConsent(e.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-[var(--clover)]"
        />
        <span>
          {SMS_CONSENT_TEXT}{' '}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-clover">Privacy</Link>
        </span>
      </label>

      {status.kind === 'error' && (
        <p id="form-error" role="alert" className="flex items-start gap-2 rounded-sm border border-danger/40 bg-danger/10 p-3 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
          <span>
            {status.message} Call or text <a className="font-semibold underline" href={BUSINESS.phoneHref}>{BUSINESS.phoneDisplay}</a>.
          </span>
        </p>
      )}

      <button type="submit" disabled={isSending} className="btn-go display flex h-15 items-center justify-center gap-3 rounded-sm text-2xl not-italic disabled:cursor-wait disabled:opacity-80">
        {isSending ? <LoaderCircle className="size-6 animate-spin" aria-hidden="true" /> : null}
        {isSending ? 'Sending…' : 'Send service request'}
      </button>
      <p className="text-center text-xs text-steel">We only use your info to get back to you about your truck.</p>
    </form>
  );
}

function SentPanel({ lead }: { lead: Lead }) {
  return (
    <div role="status" className="grid place-items-start gap-4 py-6">
      <span className="grid size-14 place-items-center rounded-full bg-clover text-carbon">
        <Check className="size-7" aria-hidden="true" />
      </span>
      <h3 className="display text-5xl">Got it, {lead.name.split(' ')[0]}.</h3>
      <p className="text-lg text-chalk/75">
        Your request for <strong className="text-chalk">{lead.serviceLabel.toLowerCase()}</strong> is in. We’ll reach out at{' '}
        <strong className="text-chalk tabular-nums">{lead.phone}</strong>.
      </p>
      <p className="text-chalk/60">
        Need us sooner? Call <a className="font-semibold text-clover underline-offset-4 hover:underline" href={BUSINESS.phoneHref}>{BUSINESS.phoneDisplay}</a>.
      </p>
      <ReferFriendPrompt className="w-full" />
    </div>
  );
}

/** Shown when the server could not deliver: hand the visitor a one-tap send. */
function FallbackPanel({ lead }: { lead: Lead }) {
  const body = encodeURIComponent(fallbackBody(lead));
  const subject = encodeURIComponent(`Service request: ${lead.serviceLabel} (${lead.name})`);

  return (
    <div role="status" className="grid gap-4 py-4">
      <h3 className="display text-5xl">One more tap.</h3>
      <p className="text-lg text-chalk/75">
        Our form couldn’t reach the shop just now. Your details are filled in. Send them by text or email:
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <a href={`${BUSINESS.smsHref}?&body=${body}`} className="btn-go display flex h-14 items-center justify-center gap-2 rounded-sm text-xl not-italic">
          <MessageSquare className="size-5" aria-hidden="true" /> Send as text
        </a>
        <a href={`mailto:${BUSINESS.email}?subject=${subject}&body=${body}`} className="flex h-14 items-center justify-center gap-2 rounded-sm border border-chalk/25 font-semibold hover:border-clover hover:text-clover">
          <Mail className="size-5" aria-hidden="true" /> Send as email
        </a>
      </div>
      <p className="text-chalk/60">
        Or call <a className="font-semibold text-clover" href={BUSINESS.phoneHref}>{BUSINESS.phoneDisplay}</a>.
      </p>
    </div>
  );
}

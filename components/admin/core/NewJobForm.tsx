'use client';

import { Check, Search, UserPlus, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { createJob } from '@/app/admin/jobs/actions';
import { fieldClass, labelClass } from '@/components/app/ui';
import { money, vehicleLabel } from '@/lib/format';
import { ActionForm, PendingButton } from './ActionForm';
import { CANNED_JOBS } from './canned-jobs';

export interface CustomerOption {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  vehicles: { id: string; year: number | null; make: string | null; model: string | null; engine_code: string | null; vin: string | null }[];
}

interface NewJobFormProps {
  customers: CustomerOption[];
  techs: { id: string; full_name: string }[];
  bays: string[];
  laborRateCents: number;
  initialCustomerId: string | null;
}

const sectionClass = 'rounded-md border border-line bg-carbon-2 p-4 sm:p-5';
const stepClass = 'display mb-4 flex items-center gap-3 text-2xl not-italic';

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <h2 className={stepClass}>
      <span className="grid size-8 place-items-center rounded-sm bg-clover text-lg text-carbon">{n}</span>
      {children}
    </h2>
  );
}

export function NewJobForm({ customers, techs, bays, laborRateCents, initialCustomerId }: NewJobFormProps) {
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [query, setQuery] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(initialCustomerId);
  const [vehicleId, setVehicleId] = useState<string | null>(() => customers.find((c) => c.id === initialCustomerId)?.vehicles[0]?.id ?? null);
  const [templateId, setTemplateId] = useState<string>('');
  const [title, setTitle] = useState('');

  const selected = customers.find((c) => c.id === customerId) ?? null;
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const digits = needle.replace(/\D/g, '');
    if (!needle) return customers.slice(0, 6);
    return customers
      .filter((c) =>
        c.full_name.toLowerCase().includes(needle) ||
        (c.email ?? '').toLowerCase().includes(needle) ||
        (digits.length >= 3 && (c.phone ?? '').replace(/\D/g, '').includes(digits)) ||
        c.vehicles.some((v) => (v.vin ?? '').toLowerCase().includes(needle) || vehicleLabel(v).toLowerCase().includes(needle)))
      .slice(0, 8);
  }, [customers, query]);

  function pickTemplate(id: string) {
    const next = id === templateId ? '' : id;
    const previous = CANNED_JOBS.find((j) => j.id === templateId);
    const job = CANNED_JOBS.find((j) => j.id === next);
    setTemplateId(next);
    if (!title || title === previous?.title) setTitle(job?.title ?? '');
  }

  const tab = (value: 'existing' | 'new') =>
    `inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-sm text-sm font-semibold sm:flex-none sm:px-4 ${mode === value ? 'bg-gunmetal text-chalk' : 'text-steel hover:text-chalk'}`;

  return (
    <ActionForm action={createJob} className="grid gap-5">
      <input type="hidden" name="customer_mode" value={mode} />
      <input type="hidden" name="template" value={templateId} />

      <section className={sectionClass}>
        <Step n={1}>Customer &amp; truck</Step>
        <div role="tablist" aria-label="Customer" className="mb-4 flex gap-1 rounded-sm border border-line bg-carbon p-1 sm:inline-flex">
          <button type="button" role="tab" aria-selected={mode === 'existing'} className={tab('existing')} onClick={() => setMode('existing')}>
            <Users className="size-4" aria-hidden="true" /> Existing
          </button>
          <button type="button" role="tab" aria-selected={mode === 'new'} className={tab('new')} onClick={() => setMode('new')}>
            <UserPlus className="size-4" aria-hidden="true" /> Quick add
          </button>
        </div>

        {mode === 'existing' ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label htmlFor="customer-search" className={labelClass}>Find customer</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-steel" aria-hidden="true" />
                <input id="customer-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, phone, email, VIN" className={`${fieldClass} pl-9`} autoComplete="off" />
              </div>
              <ul className="mt-2 max-h-72 divide-y divide-line overflow-y-auto rounded-sm border border-line" aria-label="Matching customers">
                {matches.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      aria-pressed={c.id === customerId}
                      onClick={() => { setCustomerId(c.id); setVehicleId(c.vehicles[0]?.id ?? null); }}
                      className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm ${c.id === customerId ? 'bg-clover/10' : 'hover:bg-gunmetal'}`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{c.full_name}</span>
                        <span className="block truncate text-xs text-steel">{[c.phone, c.vehicles.map((v) => vehicleLabel(v)).join(', ')].filter(Boolean).join(' · ')}</span>
                      </span>
                      {c.id === customerId && <Check className="size-4 shrink-0 text-clover" aria-hidden="true" />}
                    </button>
                  </li>
                ))}
                {!matches.length && <li className="px-3 py-4 text-sm text-steel">No match. Use Quick add.</li>}
              </ul>
            </div>
            <fieldset>
              <legend className={labelClass}>Truck</legend>
              <input type="hidden" name="customer_id" value={customerId ?? ''} />
              {selected ? (
                selected.vehicles.length ? (
                  <div className="grid gap-2">
                    {selected.vehicles.map((v) => (
                      <label key={v.id} className={`flex cursor-pointer items-center gap-3 rounded-sm border p-3 ${vehicleId === v.id ? 'border-clover bg-clover/5' : 'border-line hover:border-chalk/30'}`}>
                        <input type="radio" name="vehicle_id" value={v.id} checked={vehicleId === v.id} onChange={() => setVehicleId(v.id)} className="accent-[var(--clover)]" />
                        <span className="min-w-0">
                          <span className="block font-semibold">{vehicleLabel(v)}</span>
                          <span className="block truncate font-mono text-xs text-steel">{v.vin ?? 'No VIN on file'}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-sm border border-dashed border-line p-4 text-sm text-steel">{selected.full_name} has no trucks on file. Add one from their customer page, or use Quick add.</p>
                )
              ) : (
                <p className="rounded-sm border border-dashed border-line p-4 text-sm text-steel">Pick a customer to see their trucks.</p>
              )}
            </fieldset>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2 lg:col-span-1"><label htmlFor="new_full_name" className={labelClass}>Customer name</label><input id="new_full_name" name="new_full_name" required className={fieldClass} autoComplete="off" /></div>
            <div><label htmlFor="new_phone" className={labelClass}>Phone</label><input id="new_phone" name="new_phone" type="tel" inputMode="tel" className={fieldClass} /></div>
            <div><label htmlFor="new_email" className={labelClass}>Email</label><input id="new_email" name="new_email" type="email" className={fieldClass} /></div>
            <div><label htmlFor="new_year" className={labelClass}>Year</label><input id="new_year" name="new_year" inputMode="numeric" placeholder="2019" className={fieldClass} /></div>
            <div><label htmlFor="new_make" className={labelClass}>Make</label><input id="new_make" name="new_make" required placeholder="Ram" className={fieldClass} /></div>
            <div><label htmlFor="new_model" className={labelClass}>Model</label><input id="new_model" name="new_model" required placeholder="2500" className={fieldClass} /></div>
            <div className="sm:col-span-2 lg:col-span-3"><label htmlFor="new_vin" className={labelClass}>VIN <span className="font-normal text-steel">(optional)</span></label><input id="new_vin" name="new_vin" maxLength={17} className={`${fieldClass} font-mono uppercase`} /></div>
          </div>
        )}
      </section>

      <section className={sectionClass}>
        <Step n={2}>Start from a template</Step>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {CANNED_JOBS.map((job) => {
            const total = job.lines.reduce((sum, l) => sum + Math.round(l.quantity * (l.kind === 'labor' ? laborRateCents : l.unitPriceCents ?? 0)), 0);
            const active = templateId === job.id;
            return (
              <button key={job.id} type="button" aria-pressed={active} onClick={() => pickTemplate(job.id)} className={`rounded-sm border p-3 text-left transition-colors ${active ? 'border-clover bg-clover/10' : 'border-line hover:border-chalk/30 hover:bg-gunmetal/50'}`}>
                <span className="flex items-start justify-between gap-2">
                  <span className="font-semibold leading-snug">{job.title}</span>
                  <span className={`shrink-0 text-sm font-bold tabular-nums ${active ? 'text-clover' : 'text-chalk/80'}`}>{money(total, { whole: true })}</span>
                </span>
                <span className="mt-1 block text-xs text-steel">{job.summary}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-steel">Pre-tax. Labor at {money(laborRateCents)}/hr. Every line starts pending customer approval and can be edited on the job.</p>
      </section>

      <section className={sectionClass}>
        <Step n={3}>Job details</Step>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-4"><label htmlFor="title" className={labelClass}>Title</label><input id="title" name="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} placeholder="e.g. DDP Stage 2 turbo upgrade" className={fieldClass} /></div>
          <div className="sm:col-span-2 lg:col-span-4"><label htmlFor="complaint" className={labelClass}>Customer concern</label><textarea id="complaint" name="complaint" rows={3} maxLength={2000} placeholder="What the customer told you" className={`${fieldClass} h-auto py-2`} /></div>
          <div className="sm:col-span-2"><label htmlFor="tech_id" className={labelClass}>Assign tech</label>
            <select id="tech_id" name="tech_id" defaultValue="" className={fieldClass}>
              <option value="">Unassigned</option>
              {techs.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
            </select>
          </div>
          <div><label htmlFor="bay" className={labelClass}>Bay</label>
            <select id="bay" name="bay" defaultValue="" className={fieldClass}>
              <option value="">No bay yet</option>
              {bays.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div><label htmlFor="promised_at" className={labelClass}>Promised</label><input id="promised_at" name="promised_at" type="datetime-local" className={`${fieldClass} [color-scheme:dark]`} /></div>
        </div>
      </section>

      <div className="sticky bottom-20 z-10 flex flex-wrap items-center justify-end gap-3 rounded-md border border-line bg-carbon/95 p-3 backdrop-blur lg:bottom-4">
        <p className="mr-auto text-sm text-steel">Opens as an <span className="font-semibold text-chalk">Estimate</span>. Nothing is sent to the customer yet.</p>
        <PendingButton>Create job</PendingButton>
      </div>
    </ActionForm>
  );
}

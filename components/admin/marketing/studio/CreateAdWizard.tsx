'use client';

import { ArrowLeft, ArrowRight, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import type { ActionState } from '@/components/admin/core/parse';
import { buttonClass, fieldClass, labelClass } from '@/components/app/ui';
import { AD_PLATFORMS, AD_PLATFORM_LABEL, GOAL_OPTIONS, type GoalOption, type SourceKind } from './labels';

export interface WizardData {
  products: { handle: string; title: string; price: string }[];
  builds: { id: string; title: string; vehicle: string }[];
  offers: { slug: string; headline: string; value: string }[];
}

const SOURCES: { kind: SourceKind; label: string; hint: string }[] = [
  { kind: 'auto', label: 'No photos? Auto-design it', hint: 'Branded design, no photo needed.' },
  { kind: 'product', label: 'Store product', hint: 'Real price from the live catalog.' },
  { kind: 'build', label: 'Published build', hint: 'Real dyno numbers.' },
  { kind: 'offer', label: 'Offer page', hint: 'A live deal with terms.' },
];

const DEFAULT_SOURCE: Record<GoalOption['key'], SourceKind> = { bookings: 'build', parts: 'product', tow: 'auto', dyno: 'auto', offer: 'offer' };

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

function Choice({ name, value, checked, onChange, title, hint, disabled }: { name: string; value: string; checked: boolean; onChange: () => void; title: string; hint: string; disabled?: boolean }) {
  return (
    <label className={`flex cursor-pointer flex-col gap-0.5 rounded-sm border p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-clover/50 ${checked ? 'border-clover bg-clover/10' : 'border-line bg-carbon hover:border-chalk/30'} ${disabled ? 'pointer-events-none opacity-40' : ''}`}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="sr-only" disabled={disabled} />
      <span className="font-semibold">{title}</span>
      <span className="text-sm text-chalk/60">{hint}</span>
    </label>
  );
}

export function CreateAdWizard({ data, action }: { data: WizardData; action: Action }) {
  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState<GoalOption['key']>('bookings');
  const [source, setSource] = useState<SourceKind>('build');
  const [ref, setRef] = useState<Record<string, string>>({ product: data.products[0]?.handle ?? '', build: data.builds[0]?.id ?? '', offer: data.offers[0]?.slug ?? '' });
  const empty: Record<SourceKind, boolean> = { auto: false, product: !data.products.length, build: !data.builds.length, offer: !data.offers.length };

  function pickGoal(key: GoalOption['key']) {
    setGoal(key);
    const preferred = DEFAULT_SOURCE[key];
    setSource(empty[preferred] ? 'auto' : preferred);
    setStep(2);
  }

  const stepClass = (n: number) => `rounded-sm px-2 py-1 text-xs font-bold uppercase tracking-widest ${step === n ? 'bg-clover text-carbon' : step > n ? 'text-clover' : 'text-steel'}`;

  return (
    <ActionForm action={action} className="rounded-md border border-line bg-carbon-2 p-4 sm:p-6" aria-label="Create an ad">
      <ol className="mb-5 flex flex-wrap items-center gap-2" aria-label="Steps">
        <li className={stepClass(1)}>1 Goal</li>
        <li className={stepClass(2)}>2 Source</li>
        <li className={stepClass(3)}>3 Generate</li>
      </ol>

      <input type="hidden" name="goal" value={goal} />
      <input type="hidden" name="source" value={source} />
      <input type="hidden" name={`ref_${source}`} value={ref[source] ?? ''} />

      {step === 1 && (
        <fieldset>
          <legend className="display mb-3 text-2xl not-italic">What should it do?</legend>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {GOAL_OPTIONS.map((g) => (
              <Choice key={g.key} name="goal-pick" value={g.key} checked={goal === g.key} onChange={() => pickGoal(g.key)} title={g.label} hint={g.hint} />
            ))}
          </div>
        </fieldset>
      )}

      {step === 2 && (
        <fieldset>
          <legend className="display mb-3 text-2xl not-italic">What should it show?</legend>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {SOURCES.map((s) => (
              <Choice key={s.kind} name="source-pick" value={s.kind} checked={source === s.kind} onChange={() => setSource(s.kind)} title={s.label} hint={empty[s.kind] ? 'None yet.' : s.hint} disabled={empty[s.kind]} />
            ))}
          </div>
          {source !== 'auto' && (
            <div className="mt-4 max-w-xl">
              <label htmlFor="studio-ref" className={labelClass}>Pick one</label>
              <select id="studio-ref" className={fieldClass} value={ref[source]} onChange={(e) => setRef({ ...ref, [source]: e.target.value })}>
                {source === 'product' && data.products.map((p) => <option key={p.handle} value={p.handle}>{p.title} · {p.price}</option>)}
                {source === 'build' && data.builds.map((b) => <option key={b.id} value={b.id}>{b.title} · {b.vehicle}</option>)}
                {source === 'offer' && data.offers.map((o) => <option key={o.slug} value={o.slug}>{o.headline} · {o.value}</option>)}
              </select>
            </div>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" className={buttonClass('ghost')} onClick={() => setStep(1)}><ArrowLeft className="size-4" aria-hidden="true" />Back</button>
            <button type="button" className={buttonClass('primary')} onClick={() => setStep(3)}>Next<ArrowRight className="size-4" aria-hidden="true" /></button>
          </div>
        </fieldset>
      )}

      {step === 3 && (
        <fieldset>
          <legend className="display mb-3 text-2xl not-italic">Where will it run?</legend>
          <div className="max-w-xl">
            <label htmlFor="studio-platform" className={labelClass}>Ad platform</label>
            <select id="studio-platform" name="platform" className={fieldClass} defaultValue="meta">
              {AD_PLATFORMS.map((p) => <option key={p} value={p}>{AD_PLATFORM_LABEL[p]}</option>)}
            </select>
            <p className="mt-2 text-sm text-chalk/60">Makes 4 variants in 4 sizes. Nothing goes live yet.</p>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" className={buttonClass('ghost')} onClick={() => setStep(2)}><ArrowLeft className="size-4" aria-hidden="true" />Back</button>
            <PendingButton><Wand2 className="size-4" aria-hidden="true" />Generate ads</PendingButton>
          </div>
        </fieldset>
      )}
    </ActionForm>
  );
}

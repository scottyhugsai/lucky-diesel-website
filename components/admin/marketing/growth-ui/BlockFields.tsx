'use client';

import type { LandingBlock } from '@/lib/marketing/content/landing-blocks';
import { fieldClass, labelClass } from '@/components/app/ui';
import { areaClass } from './kit';

export const BLOCK_LABEL: Record<LandingBlock['type'], string> = { hero: 'Hero', offer: 'Offer', proof: 'Proof', bullets: 'List', form: 'Form', faq: 'FAQ', cta: 'Button' };

export const NEW_BLOCK: Record<LandingBlock['type'], LandingBlock> = {
  hero: { type: 'hero', kicker: null, headline: 'New headline', subhead: null, image: null, ctaLabel: null },
  offer: { type: 'offer', headline: 'Offer name', valueLabel: '$25 off', terms: null, code: null, endsAt: null },
  proof: { type: 'proof', heading: 'Real numbers', source: 'builds', limit: 3 },
  bullets: { type: 'bullets', heading: 'What you get', items: ['First item'] },
  form: { type: 'form', heading: 'Claim it', service: 'maintenance', offerTag: 'offer', submitLabel: 'Send' },
  faq: { type: 'faq', heading: 'Questions', items: [{ q: 'Question?', a: 'Answer.' }] },
  cta: { type: 'cta', headline: 'Ready?', label: 'Book now', href: '/book' },
};

interface TextProps { id: string; label: string; value: string | null; max: number; onChange: (v: string | null) => void; area?: boolean; hint?: string }

function Text({ id, label, value, max, onChange, area, hint }: TextProps) {
  const common = { id, maxLength: max, value: value ?? '', onChange: (e: { target: { value: string } }) => onChange(e.target.value === '' ? null : e.target.value) };
  return (
    <div>
      <label htmlFor={id} className={labelClass}>{label}</label>
      {area ? <textarea rows={2} className={areaClass} {...common} /> : <input className={fieldClass} {...common} />}
      {hint && <p className="mt-1 text-xs text-steel">{hint}</p>}
    </div>
  );
}

export function BlockFields({ block, id, services, onChange }: { block: LandingBlock; id: string; services: { id: string; name: string }[]; onChange: (b: LandingBlock) => void }) {
  switch (block.type) {
    case 'hero':
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <Text id={`${id}-h`} label="Headline" value={block.headline} max={80} onChange={(v) => onChange({ ...block, headline: v ?? '' })} />
          <Text id={`${id}-k`} label="Small label" value={block.kicker} max={40} onChange={(v) => onChange({ ...block, kicker: v })} />
          <Text id={`${id}-s`} label="Subhead" value={block.subhead} max={240} onChange={(v) => onChange({ ...block, subhead: v })} area />
          <Text id={`${id}-i`} label="Image" value={block.image} max={500} onChange={(v) => onChange({ ...block, image: v })} hint="/images/… or https link" />
          <Text id={`${id}-c`} label="Button" value={block.ctaLabel} max={30} onChange={(v) => onChange({ ...block, ctaLabel: v })} />
        </div>
      );
    case 'offer':
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <Text id={`${id}-h`} label="Offer" value={block.headline} max={80} onChange={(v) => onChange({ ...block, headline: v ?? '' })} />
          <Text id={`${id}-v`} label="Value" value={block.valueLabel} max={40} onChange={(v) => onChange({ ...block, valueLabel: v ?? '' })} />
          <Text id={`${id}-c`} label="Code" value={block.code} max={32} onChange={(v) => onChange({ ...block, code: v ? v.toUpperCase() : null })} />
          <div>
            <label htmlFor={`${id}-e`} className={labelClass}>Ends</label>
            <input id={`${id}-e`} type="date" className={fieldClass} value={block.endsAt?.slice(0, 10) ?? ''} onChange={(e) => onChange({ ...block, endsAt: e.target.value || null })} />
          </div>
          <div className="sm:col-span-2"><Text id={`${id}-t`} label="Terms" value={block.terms} max={400} onChange={(v) => onChange({ ...block, terms: v })} area /></div>
        </div>
      );
    case 'proof':
      return (
        <div className="grid gap-3 sm:grid-cols-3">
          <Text id={`${id}-h`} label="Heading" value={block.heading} max={80} onChange={(v) => onChange({ ...block, heading: v ?? '' })} />
          <div>
            <label htmlFor={`${id}-s`} className={labelClass}>Show</label>
            <select id={`${id}-s`} className={fieldClass} value={block.source} onChange={(e) => onChange({ ...block, source: e.target.value === 'reviews' ? 'reviews' : 'builds' })}>
              <option value="builds">Dyno builds</option><option value="reviews">Real reviews</option>
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-l`} className={labelClass}>How many</label>
            <input id={`${id}-l`} type="number" min={1} max={6} className={fieldClass} value={block.limit} onChange={(e) => onChange({ ...block, limit: Number(e.target.value) || 1 })} />
          </div>
        </div>
      );
    case 'bullets':
      return (
        <div className="grid gap-3">
          <Text id={`${id}-h`} label="Heading" value={block.heading} max={80} onChange={(v) => onChange({ ...block, heading: v ?? '' })} />
          <div>
            <label htmlFor={`${id}-i`} className={labelClass}>Items (one per line)</label>
            <textarea id={`${id}-i`} rows={4} className={areaClass} value={block.items.join('\n')} onChange={(e) => onChange({ ...block, items: e.target.value.split('\n') })} />
          </div>
        </div>
      );
    case 'form':
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <Text id={`${id}-h`} label="Heading" value={block.heading} max={80} onChange={(v) => onChange({ ...block, heading: v ?? '' })} />
          <Text id={`${id}-b`} label="Button" value={block.submitLabel} max={30} onChange={(v) => onChange({ ...block, submitLabel: v ?? '' })} />
          <div>
            <label htmlFor={`${id}-s`} className={labelClass}>Service</label>
            <select id={`${id}-s`} className={fieldClass} value={block.service} onChange={(e) => onChange({ ...block, service: e.target.value })}>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <Text id={`${id}-t`} label="Lead tag" value={block.offerTag} max={60} onChange={(v) => onChange({ ...block, offerTag: (v ?? '').toLowerCase() })} hint="Counts leads from this page." />
        </div>
      );
    case 'faq':
      return (
        <div className="grid gap-3">
          <Text id={`${id}-h`} label="Heading" value={block.heading} max={80} onChange={(v) => onChange({ ...block, heading: v ?? '' })} />
          <div>
            <label htmlFor={`${id}-q`} className={labelClass}>Q and A</label>
            <textarea
              id={`${id}-q`} rows={5} className={areaClass}
              value={block.items.map((i) => `${i.q}\n${i.a}`).join('\n\n')}
              onChange={(e) => onChange({ ...block, items: e.target.value.split(/\n\s*\n/).map((pair) => { const [q = '', ...a] = pair.split('\n'); return { q, a: a.join(' ') }; }) })}
            />
            <p className="mt-1 text-xs text-steel">Question line, answer line. Blank line between.</p>
          </div>
        </div>
      );
    case 'cta':
      return (
        <div className="grid gap-3 sm:grid-cols-3">
          <Text id={`${id}-h`} label="Headline" value={block.headline} max={80} onChange={(v) => onChange({ ...block, headline: v ?? '' })} />
          <Text id={`${id}-l`} label="Button" value={block.label} max={30} onChange={(v) => onChange({ ...block, label: v ?? '' })} />
          <Text id={`${id}-u`} label="Link" value={block.href} max={300} onChange={(v) => onChange({ ...block, href: v ?? '' })} />
        </div>
      );
  }
}

'use client';

import { useState } from 'react';
import { makeShortLink } from '@/app/admin/marketing/pages/actions';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import { fieldClass } from '@/components/app/ui';
import { CopyButton } from './CopyButton';
import { Field } from './kit';

const PRESETS = [
  { label: 'Facebook', source: 'facebook', medium: 'social' },
  { label: 'Instagram', source: 'instagram', medium: 'social' },
  { label: 'Google', source: 'google', medium: 'cpc' },
  { label: 'Text', source: 'sms', medium: 'sms' },
  { label: 'Flyer', source: 'flyer', medium: 'print' },
] as const;

const clean = (v: string) => v.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');

export function UtmBuilder({ slug, baseUrl }: { slug: string; baseUrl: string }) {
  const [source, setSource] = useState('facebook');
  const [medium, setMedium] = useState('social');
  const [campaign, setCampaign] = useState(slug);
  const params = new URLSearchParams({ utm_source: clean(source), utm_medium: clean(medium), utm_campaign: clean(campaign) });
  const path = `/l/${slug}?${params.toString()}`;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick source">
        {PRESETS.map((p) => (
          <button
            key={p.label} type="button" onClick={() => { setSource(p.source); setMedium(p.medium); }}
            aria-pressed={source === p.source}
            className={`h-8 rounded-sm border px-2.5 text-xs font-semibold ${source === p.source ? 'border-clover text-clover' : 'border-line text-chalk/75 hover:text-chalk'}`}
          >{p.label}</button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Source" htmlFor="utm-s"><input id="utm-s" value={source} onChange={(e) => setSource(e.target.value)} className={fieldClass} /></Field>
        <Field label="Medium" htmlFor="utm-m"><input id="utm-m" value={medium} onChange={(e) => setMedium(e.target.value)} className={fieldClass} /></Field>
        <Field label="Campaign" htmlFor="utm-c"><input id="utm-c" value={campaign} onChange={(e) => setCampaign(e.target.value)} className={fieldClass} /></Field>
      </div>
      <p className="break-all rounded-sm border border-line bg-carbon px-3 py-2 font-mono text-xs text-chalk/80">{baseUrl}{path}</p>
      <ActionForm action={makeShortLink} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="target" value={path} />
        <input type="hidden" name="utm_source" value={clean(source)} />
        <input type="hidden" name="utm_medium" value={clean(medium)} />
        <CopyButton value={`${baseUrl}${path}`} label="Copy full link" />
        <PendingButton size="sm" variant="secondary">Make short link</PendingButton>
      </ActionForm>
    </div>
  );
}

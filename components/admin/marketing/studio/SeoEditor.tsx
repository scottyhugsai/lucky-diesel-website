'use client';

import { Save } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import type { ActionState } from '@/components/admin/core/parse';
import { fieldClass, labelClass } from '@/components/app/ui';
import { checkContent } from '@/lib/marketing/content/compliance';

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

export interface SeoFields {
  id: string;
  title: string;
  summary: string;
  meta: string;
  body: string;
  faq: string;
}

/** Plain-text SEO editor: "## Heading" sections and "Q:/A:" FAQ pairs, checked live. */
export function SeoEditor({ fields, action }: { fields: SeoFields; action: Action }) {
  const [values, setValues] = useState(fields);
  const report = useMemo(() => checkContent([values.title, values.summary, values.meta, values.body, values.faq]), [values]);
  const set = (key: keyof SeoFields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValues({ ...values, [key]: e.target.value });

  return (
    <ActionForm action={action} className="grid gap-4" aria-label="SEO draft editor">
      <input type="hidden" name="id" value={fields.id} />
      <div>
        <label className={labelClass} htmlFor="s-title">Page title <span className="font-normal text-steel">({values.title.length}/120)</span></label>
        <input id="s-title" name="title" className={fieldClass} value={values.title} onChange={set('title')} maxLength={120} required />
      </div>
      <div>
        <label className={labelClass} htmlFor="s-meta">Search snippet <span className={`font-normal ${values.meta.length > 155 ? 'text-amber-300' : 'text-steel'}`}>({values.meta.length}/160)</span></label>
        <input id="s-meta" name="meta" className={fieldClass} value={values.meta} onChange={set('meta')} maxLength={160} required />
      </div>
      <div>
        <label className={labelClass} htmlFor="s-summary">Summary</label>
        <textarea id="s-summary" name="summary" rows={3} className={`${fieldClass} h-auto py-2`} value={values.summary} onChange={set('summary')} maxLength={600} required />
      </div>
      <div>
        <label className={labelClass} htmlFor="s-body">Body</label>
        <p className="mb-1.5 text-xs text-chalk/55">Start each section with “## Heading”.</p>
        <textarea id="s-body" name="body" rows={12} className={`${fieldClass} h-auto py-2 font-mono text-sm`} value={values.body} onChange={set('body')} maxLength={20000} required />
      </div>
      <div>
        <label className={labelClass} htmlFor="s-faq">FAQ</label>
        <p className="mb-1.5 text-xs text-chalk/55">Write “Q:” then “A:” on the next line.</p>
        <textarea id="s-faq" name="faq" rows={6} className={`${fieldClass} h-auto py-2 font-mono text-sm`} value={values.faq} onChange={set('faq')} maxLength={8000} />
      </div>
      <p role="status" className={`text-sm font-semibold ${report.status === 'block' ? 'text-danger' : report.status === 'warn' ? 'text-amber-300' : 'text-clover'}`}>
        {report.status === 'pass' ? 'Wording looks clear.' : report.issues.map((i) => `${i.term}: ${i.reason}`).join(' ')}
      </p>
      <div><PendingButton><Save className="size-4" aria-hidden="true" />Save and send for approval</PendingButton></div>
    </ActionForm>
  );
}

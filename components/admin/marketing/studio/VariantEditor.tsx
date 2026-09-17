'use client';

import { Pencil } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import type { ActionState } from '@/components/admin/core/parse';
import { fieldClass, labelClass } from '@/components/app/ui';
import { checkContent } from '@/lib/marketing/content/compliance';

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

interface VariantText {
  id: string;
  headline: string;
  primary: string;
  description: string | null;
  cta: string;
}

/** Inline editor for one ad variant, with a live compliance check as you type. */
export function VariantEditor({ variant, ctas, action, locked }: { variant: VariantText; ctas: readonly string[]; action: Action; locked: boolean }) {
  const [headline, setHeadline] = useState(variant.headline);
  const [primary, setPrimary] = useState(variant.primary);
  const [description, setDescription] = useState(variant.description ?? '');
  const report = useMemo(() => checkContent([headline, primary, description]), [headline, primary, description]);
  const options = ctas.includes(variant.cta) ? ctas : [variant.cta, ...ctas];

  if (locked) return <p className="text-sm text-chalk/55">Running ads can’t change. Make a new one.</p>;

  return (
    <details className="group rounded-sm border border-line">
      <summary className="flex h-10 cursor-pointer list-none items-center gap-2 px-3 text-sm font-semibold text-chalk/80 hover:text-chalk">
        <Pencil className="size-4" aria-hidden="true" />
        Edit text
      </summary>
      <ActionForm action={action} className="grid gap-3 border-t border-line p-3">
        <input type="hidden" name="variantId" value={variant.id} />
        <div>
          <label className={labelClass} htmlFor={`h-${variant.id}`}>Headline <span className="font-normal text-steel">({headline.length})</span></label>
          <input id={`h-${variant.id}`} name="headline" className={fieldClass} value={headline} maxLength={90} onChange={(e) => setHeadline(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass} htmlFor={`p-${variant.id}`}>Main text <span className="font-normal text-steel">({primary.length})</span></label>
          <textarea id={`p-${variant.id}`} name="primary" rows={4} className={`${fieldClass} h-auto py-2`} value={primary} maxLength={500} onChange={(e) => setPrimary(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass} htmlFor={`d-${variant.id}`}>Description</label>
          <input id={`d-${variant.id}`} name="description" className={fieldClass} value={description} maxLength={90} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <label className={labelClass} htmlFor={`c-${variant.id}`}>Button</label>
          <select id={`c-${variant.id}`} name="cta" className={fieldClass} defaultValue={variant.cta}>
            {options.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <p role="status" className={`text-sm font-semibold ${report.status === 'block' ? 'text-danger' : report.status === 'warn' ? 'text-amber-300' : 'text-clover'}`}>
          {report.status === 'pass' ? 'Wording looks clear.' : report.issues.map((i) => `${i.term}: ${i.reason}`).join(' ')}
        </p>
        <PendingButton size="sm">Save and re-queue</PendingButton>
      </ActionForm>
    </details>
  );
}

import { Download } from 'lucide-react';
import { setSkuCompliance } from '@/app/admin/marketing/settings/compliance-actions';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import { Field } from '@/components/admin/marketing/growth-ui/kit';
import { Badge, buttonClass, EmptyState, fieldClass } from '@/components/app/ui';
import { COMPLIANCE_LABEL, COMPLIANCE_STATUSES, type ComplianceStatus } from '@/lib/store/compliance';

export interface ComplianceItem {
  handle: string;
  title: string;
  status: ComplianceStatus;
  eoNumber: string | null;
  note: string | null;
  offRoadOnly: boolean;
}

const TONE: Record<ComplianceStatus, 'good' | 'warn' | 'neutral'> = {
  carb_eo: 'good',
  sema_verified: 'good',
  unverified: 'warn',
  not_applicable: 'neutral',
};

function ComplianceRow({ item }: { item: ComplianceItem }) {
  const id = `sku-${item.handle}`;
  return (
    <li className="bg-carbon">
      <details className="group">
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm hover:text-clover">
          <span className="min-w-0 flex-1 truncate font-semibold">{item.title}</span>
          <span className="flex shrink-0 flex-wrap items-center gap-1.5">
            {item.offRoadOnly && <Badge>Off-road</Badge>}
            <Badge tone={TONE[item.status]}>{COMPLIANCE_LABEL[item.status]}</Badge>
            {item.eoNumber && <span className="font-mono text-xs text-steel">{item.eoNumber}</span>}
          </span>
        </summary>
        <ActionForm action={setSkuCompliance} className="grid gap-3 px-3 pb-4 sm:grid-cols-3" aria-label={`Tag ${item.title}`}>
          <input type="hidden" name="handle" value={item.handle} />
          <Field label="Status" htmlFor={`${id}-status`}>
            <select id={`${id}-status`} name="status" defaultValue={item.status} className={fieldClass}>
              {COMPLIANCE_STATUSES.map((s) => <option key={s} value={s}>{COMPLIANCE_LABEL[s]}</option>)}
            </select>
          </Field>
          <Field label="EO number" htmlFor={`${id}-eo`} hint="Like D-123-45.">
            <input id={`${id}-eo`} name="eo_number" defaultValue={item.eoNumber ?? ''} maxLength={40} className={fieldClass} />
          </Field>
          <Field label="Note" htmlFor={`${id}-note`}>
            <input id={`${id}-note`} name="note" defaultValue={item.note ?? ''} maxLength={300} className={fieldClass} />
          </Field>
          <div className="sm:col-span-3"><PendingButton size="sm">Save tag</PendingButton></div>
        </ActionForm>
      </details>
    </li>
  );
}

/** Emissions-related SKUs and their compliance tags. Untagged parts stay out of promos, ads and feeds. */
export function CompliancePanel({ items, unverified, catalogOk }: { items: ComplianceItem[]; unverified: number; catalogOk: boolean }) {
  if (!catalogOk) return <EmptyState title="Catalog unreachable">Try again once the store responds.</EmptyState>;
  if (items.length === 0) return <EmptyState title="No emissions parts">Nothing in the catalog needs a tag.</EmptyState>;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-chalk/75">{unverified} of {items.length} not verified — held back from promos and feeds.</p>
        <a href="/api/marketing/store/feed" className={buttonClass('secondary', 'sm')} download>
          <Download className="size-4" aria-hidden="true" /> Product feed
        </a>
      </div>
      <ul className="mt-3 grid gap-px overflow-hidden rounded-md border border-line bg-line">
        {items.map((item) => <ComplianceRow key={item.handle} item={item} />)}
      </ul>
    </>
  );
}

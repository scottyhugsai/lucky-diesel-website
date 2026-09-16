'use client';

import { useActionState, useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import { approveEstimate, type PortalActionState } from '@/app/portal/jobs/[id]/actions';
import { SubmitButton } from '@/components/app/SubmitButton';
import { fieldClass, labelClass } from '@/components/app/ui';
import { money } from '@/lib/format';
import { computeTotals, lineAmount } from '@/lib/work-orders/totals';
import { InspectionItemCard, type InspectionGroup } from './InspectionItemCard';
import { formatQuantity, KIND_LABEL, type PortalLine } from './lines';

type Decision = 'approved' | 'declined';

interface EstimateApprovalProps {
  workOrderId: string;
  groups: InspectionGroup[];
  otherLines: PortalLine[];
  taxRate: number;
  summary: React.ReactNode;
}

export function EstimateApproval({ workOrderId, groups, otherLines, taxRate, summary }: EstimateApprovalProps) {
  const [state, action] = useActionState<PortalActionState, FormData>(approveEstimate, {});
  const allLines = useMemo(() => [...groups.flatMap((g) => g.items.flatMap((i) => i.lines)), ...otherLines].filter((l) => l.approval === 'pending'), [groups, otherLines]);
  const [decisions, setDecisions] = useState<Record<string, Decision>>(() => Object.fromEntries(allLines.map((line) => [line.id, 'approved'])));

  const approvedLines = allLines.filter((line) => decisions[line.id] === 'approved');
  const totals = computeTotals(approvedLines, taxRate);
  const declinedCount = allLines.length - approvedLines.length;
  const decide = (id: string, decision: Decision) => setDecisions((current) => ({ ...current, [id]: decision }));

  const renderLine = (line: PortalLine) => (
    <DecisionRow key={line.id} line={line} decision={decisions[line.id] ?? 'approved'} onChange={(d) => decide(line.id, d)} />
  );

  return (
    <form action={action} id="estimate" className="scroll-mt-20 rounded-md border border-clover/40 bg-carbon-2">
      <input type="hidden" name="workOrderId" value={workOrderId} />
      <div className="border-b border-line p-4 sm:p-6">
        <p className="kicker">Estimate · needs your OK</p>
        <h2 className="display mt-2 text-4xl sm:text-5xl">Review &amp; approve</h2>
        <p className="mt-2 text-chalk/70">Approve or decline each item. Nothing gets done without your signature.</p>
        {summary && <div className="mt-5">{summary}</div>}
      </div>

      <div className="space-y-6 p-4 sm:p-6">
        {groups.map((group) => (
          <fieldset key={group.category} className="min-w-0">
            <legend className="mb-2 text-xs font-semibold uppercase tracking-widest text-steel">{group.category}</legend>
            <div className="space-y-3">
              {group.items.map((item) => (
                <InspectionItemCard key={item.id} item={item}>
                  {item.lines.length > 0 && <div className="divide-y divide-line">{item.lines.map(renderLine)}</div>}
                </InspectionItemCard>
              ))}
            </div>
          </fieldset>
        ))}
        {otherLines.length > 0 && (
          <fieldset className="min-w-0">
            <legend className="mb-2 text-xs font-semibold uppercase tracking-widest text-steel">{groups.length ? 'Parts & labor for this job' : 'Estimate items'}</legend>
            <div className="divide-y divide-line rounded-md border border-line bg-carbon">{otherLines.map(renderLine)}</div>
          </fieldset>
        )}
      </div>

      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] z-20 border-y border-line bg-carbon/95 px-4 py-3 backdrop-blur lg:bottom-0 sm:px-6">
        <div className="flex items-center justify-between gap-3" aria-live="polite">
          <p className="text-sm text-chalk/70">
            <span className="font-semibold text-chalk">{approvedLines.length}</span> approved
            {declinedCount > 0 && <> · <span className="font-semibold text-chalk">{declinedCount}</span> declined</>}
          </p>
          <p className="display text-3xl not-italic tabular-nums text-clover">{money(totals.totalCents)}</p>
        </div>
      </div>

      <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[1fr_1.1fr] lg:gap-10">
        <dl className="grid grid-cols-[1fr_auto] content-start gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-chalk/65">Approved subtotal</dt>
          <dd className="text-right tabular-nums">{money(totals.subtotalCents)}</dd>
          <dt className="text-chalk/65">Tax ({(taxRate * 100).toFixed(1).replace(/\.0$/, '')}% on parts)</dt>
          <dd className="text-right tabular-nums">{money(totals.taxCents)}</dd>
          <dt className="display pt-2 text-2xl not-italic">Approved total</dt>
          <dd className="display pt-2 text-right text-2xl not-italic tabular-nums">{money(totals.totalCents)}</dd>
        </dl>
        <div className="space-y-4">
          <div>
            <label htmlFor="signerName" className={labelClass}>Sign with your full name</label>
            <input id="signerName" name="signerName" required autoComplete="name" placeholder="First and last name" className={`${fieldClass} h-14 font-display text-2xl font-extrabold italic`} />
          </div>
          <label className="flex min-h-11 items-start gap-3 text-sm text-chalk/80">
            <input type="checkbox" name="consent" required className="mt-0.5 size-5 shrink-0 accent-[var(--clover)]" />
            <span>I authorize Lucky Diesel to perform the approved items for {money(totals.totalCents)} including tax. Declined items won’t be done.</span>
          </label>
          <SubmitButton pendingLabel="Signing…" className="h-12 w-full text-base">
            {approvedLines.length ? `Approve ${approvedLines.length} item${approvedLines.length === 1 ? '' : 's'} & sign` : 'Decline all & sign'}
          </SubmitButton>
          <p role="status" aria-live="polite" className={`text-sm ${state.error ? 'text-danger' : 'text-clover'}`}>
            {state.error ?? state.message}
          </p>
        </div>
      </div>
    </form>
  );
}

function DecisionRow({ line, decision, onChange }: { line: PortalLine; decision: Decision; onChange: (d: Decision) => void }) {
  const name = `line:${line.id}`;
  const declined = decision === 'declined';
  return (
    <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className={`font-semibold ${declined ? 'text-chalk/45 line-through decoration-chalk/30' : ''}`} id={`${name}-label`}>{line.description}</p>
        <p className="mt-0.5 text-sm text-steel">
          {KIND_LABEL[line.kind]}
          {line.quantity !== 1 && ` · ${formatQuantity(line.quantity)} × ${money(line.unit_price_cents)}`}
          <span className={`ml-2 font-semibold tabular-nums ${declined ? 'text-steel' : 'text-chalk'}`}>{money(lineAmount(line))}</span>
        </p>
      </div>
      <div role="radiogroup" aria-labelledby={`${name}-label`} className="grid shrink-0 grid-cols-2 gap-1 rounded-sm border border-line bg-carbon-2 p-1">
        {(['approved', 'declined'] as const).map((option) => {
          const selected = decision === option;
          const Icon = option === 'approved' ? Check : X;
          return (
            <label
              key={option}
              className={`flex h-11 min-w-[7rem] cursor-pointer items-center justify-center gap-1.5 rounded-sm text-sm font-semibold transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-clover ${
                selected ? (option === 'approved' ? 'bg-clover text-carbon' : 'bg-danger/15 text-danger') : 'text-steel hover:text-chalk'
              }`}
            >
              <input type="radio" name={name} value={option} checked={selected} onChange={() => onChange(option)} className="sr-only" />
              <Icon className="size-4" aria-hidden="true" />
              {option === 'approved' ? 'Approve' : 'Decline'}
            </label>
          );
        })}
      </div>
    </div>
  );
}

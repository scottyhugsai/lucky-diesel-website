import { Badge } from '@/components/app/ui';
import { money } from '@/lib/format';
import { lineAmount } from '@/lib/work-orders/totals';
import { formatQuantity, KIND_LABEL, type PortalLine } from './lines';

const APPROVAL_TONE = { approved: 'good', declined: 'bad', pending: 'warn' } as const;
const APPROVAL_LABEL = { approved: 'Approved', declined: 'Declined', pending: 'Pending' } as const;

/** One priced line, read-only. */
export function LineSummary({ line, showApproval = true }: { line: PortalLine; showApproval?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className={`font-semibold ${line.approval === 'declined' ? 'text-chalk/50 line-through decoration-chalk/30' : ''}`}>{line.description}</p>
        <p className="mt-0.5 text-sm text-steel">
          {KIND_LABEL[line.kind]}
          {line.quantity !== 1 && ` · ${formatQuantity(line.quantity)} × ${money(line.unit_price_cents)}`}
          {line.kind === 'labor' && line.quantity !== 1 ? ' hr' : ''}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="font-semibold tabular-nums">{money(lineAmount(line))}</span>
        {showApproval && <Badge tone={APPROVAL_TONE[line.approval]}>{APPROVAL_LABEL[line.approval]}</Badge>}
      </div>
    </div>
  );
}

export function TotalsRows({ subtotal, tax, total, taxLabel = 'Tax' }: { subtotal: number; tax: number; total: number; taxLabel?: string }) {
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
      <dt className="text-chalk/65">Subtotal</dt>
      <dd className="text-right tabular-nums">{money(subtotal)}</dd>
      <dt className="text-chalk/65">{taxLabel}</dt>
      <dd className="text-right tabular-nums">{money(tax)}</dd>
      <dt className="display pt-2 text-2xl not-italic">Total</dt>
      <dd className="display pt-2 text-right text-2xl not-italic tabular-nums">{money(total)}</dd>
    </dl>
  );
}

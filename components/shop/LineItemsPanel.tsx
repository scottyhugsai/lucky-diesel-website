import type { JobData } from '@/app/shop/jobs/[id]/_data';
import { Badge } from '@/components/app/ui';
import { money } from '@/lib/format';
import { lineAmount, totalsByApproval } from '@/lib/work-orders/totals';

const APPROVAL_TONE = { pending: 'neutral', approved: 'good', declined: 'bad' } as const;

export function LineItemsPanel({ data }: { data: JobData }) {
  const lines = data.lines.map((line) => ({ ...line, quantity: Number(line.quantity) }));
  if (!lines.length) return <p className="text-sm text-chalk/55">No lines on this estimate yet. Recommended work from the inspection lands here.</p>;
  const totals = totalsByApproval(lines, data.taxRate);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <ul className="divide-y divide-line rounded-md border border-line bg-carbon">
        {lines.map((line) => (
          <li key={line.id} className={`grid grid-cols-[1fr_auto] items-start gap-x-3 gap-y-1 p-3 ${line.approval === 'declined' ? 'opacity-60' : ''}`}>
            <div className="min-w-0">
              <p className={`font-semibold text-chalk ${line.approval === 'declined' ? 'line-through decoration-danger/60' : ''}`}>{line.description}</p>
              <p className="mt-0.5 text-xs text-steel">
                <span className="uppercase tracking-wider">{line.kind}</span> · {line.kind === 'labor' ? `${line.quantity} h` : `×${line.quantity}`} @ {money(line.unit_price_cents)}
                {line.recommended && ' · from inspection'}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="font-mono font-semibold tabular-nums">{money(lineAmount(line))}</span>
              <Badge tone={APPROVAL_TONE[line.approval]} className="capitalize">{line.approval}</Badge>
            </div>
          </li>
        ))}
      </ul>
      <dl className="grid grid-cols-3 gap-2 text-center">
        {([['Approved', totals.approved.totalCents, 'text-clover'], ['Pending', totals.pending.totalCents, 'text-chalk'], ['Declined', totals.declined.totalCents, 'text-steel']] as const).map(([label, cents, tone]) => (
          <div key={label} className="rounded-sm border border-line bg-carbon p-2">
            <dt className="text-[0.7rem] font-semibold uppercase tracking-widest text-steel">{label}</dt>
            <dd className={`mt-0.5 font-mono font-semibold tabular-nums ${tone}`}>{money(cents)}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-steel">Totals include tax on taxable lines. Pricing is shop-only on this screen.</p>
    </div>
  );
}

import type { Tables } from '@/lib/db/database.types';
import { money } from '@/lib/format';
import { totalsByApproval } from '@/lib/work-orders/totals';

/** Estimate vs approved totals with tax, and the shop-only profit line. */
export function LineTotals({ lines, taxRate }: { lines: Tables<'line_items'>[]; taxRate: number }) {
  const totals = totalsByApproval(lines, taxRate);
  const live = lines.filter((l) => l.approval !== 'declined');
  const estimate = totalsByApproval(live, taxRate).all;
  const approved = totals.approved;
  const costedRevenue = live.filter((l) => l.unit_cost_cents !== null || l.kind === 'labor');
  const profit = estimate.subtotalCents - estimate.costCents;
  const margin = estimate.subtotalCents ? Math.round((profit / estimate.subtotalCents) * 100) : 0;

  const row = (label: string, value: string, className = '') => (
    <div className={`flex items-baseline justify-between gap-4 ${className}`}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );

  return (
    <div className="grid gap-4 border-t border-line pt-5 md:grid-cols-2">
      <div className="text-sm text-chalk/75">
        <p className="kicker mb-2 text-xs">Estimate (excl. declined)</p>
        <dl className="space-y-1.5">
        {row('Labor', money(estimate.laborCents))}
        {row('Parts', money(estimate.partsCents))}
        {row('Fees', money(estimate.subtotalCents - estimate.laborCents - estimate.partsCents))}
        {row(`Tax (${(taxRate * 100).toFixed(2).replace(/\.?0+$/, '')}% on taxable)`, money(estimate.taxCents))}
        {row('Total', money(estimate.totalCents), 'border-t border-line pt-2 text-base font-bold text-chalk')}
        {totals.declined.subtotalCents > 0 && row('Declined', money(totals.declined.totalCents), 'text-steel')}
        </dl>
      </div>
      <div className="rounded-sm border border-line bg-carbon p-4 text-sm text-chalk/75">
        <p className="mb-2 flex items-center justify-between">
          <span className="kicker text-xs">Shop only</span>
          <span className="text-[0.65rem] font-semibold uppercase tracking-widest text-steel">not shown to customer</span>
        </p>
        <dl className="space-y-1.5">
        {row('Approved total', money(approved.totalCents), 'font-semibold text-chalk')}
        {row('Pending approval', money(totals.pending.totalCents))}
        {row('Parts & fee cost', money(estimate.costCents))}
        {row('Gross profit', `${money(profit)} · ${margin}%`, `border-t border-line pt-2 text-base font-bold ${profit < 0 ? 'text-danger' : 'text-clover'}`)}
        </dl>
        {costedRevenue.length < live.length && <p className="pt-2 text-xs text-amber-300">Some parts have no cost entered, so profit is overstated.</p>}
      </div>
    </div>
  );
}

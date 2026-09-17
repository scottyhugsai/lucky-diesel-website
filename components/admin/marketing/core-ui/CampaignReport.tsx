import { Trophy } from 'lucide-react';
import type { CampaignVariantReport } from '@/lib/marketing/core/analytics';
import { money } from '@/lib/format';
import { pct } from './labels';

const METRICS: { key: 'delivered' | 'clicked' | 'converted'; label: string }[] = [
  { key: 'delivered', label: 'Delivered' },
  { key: 'clicked', label: 'Clicked' },
  { key: 'converted', label: 'Booked' },
];

/** Per-variant sends → deliveries → clicks → bookings → revenue, with the winner flagged. */
export function CampaignReport({ report, winner, metric }: { report: CampaignVariantReport[]; winner: string | null; metric: string }) {
  if (!report.length) return <p className="py-6 text-center text-sm text-steel">No sends yet. Numbers show up after the first send.</p>;
  const totals = report.reduce((t, r) => ({
    sends: t.sends + r.scheduled + r.delivered + r.skipped + r.failed, delivered: t.delivered + r.delivered, clicked: t.clicked + r.clicked,
    converted: t.converted + r.converted, revenue: t.revenue + r.revenueCents, skipped: t.skipped + r.skipped,
  }), { sends: 0, delivered: 0, clicked: 0, converted: 0, revenue: 0, skipped: 0 });
  const max = Math.max(1, ...report.map((r) => r.delivered + r.scheduled));

  return (
    <div className="grid gap-5">
      <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-5">
        {[
          ['Sends', String(totals.sends)], ['Delivered', String(totals.delivered)], ['Clicks', String(totals.clicked)],
          ['Bookings', String(totals.converted)], ['Revenue', money(totals.revenue, { whole: true })],
        ].map(([label, value]) => (
          <div key={label} className="bg-carbon px-3 py-2.5">
            <dt className="text-[0.62rem] font-semibold uppercase tracking-widest text-steel">{label}</dt>
            <dd className={`display text-3xl not-italic tabular-nums ${label === 'Revenue' && totals.revenue ? 'text-clover' : ''}`}>{value}</dd>
          </div>
        ))}
      </dl>

      <ul className="grid gap-4">
        {report.map((r) => {
          const isWinner = winner === r.variant;
          return (
            <li key={r.variant} className={`rounded-md border p-3 ${isWinner ? 'border-clover/50 bg-clover/[0.05]' : 'border-line'}`}>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 font-bold">
                  <span className={`grid size-7 place-items-center rounded-sm text-sm ${isWinner ? 'bg-clover text-carbon' : 'bg-gunmetal'}`}>{r.variant === 'pending' ? '…' : r.variant}</span>
                  {r.variant === 'pending' ? 'Waiting for winner' : `Variant ${r.variant}`}
                  {isWinner && <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-clover"><Trophy className="size-3.5" aria-hidden="true" /> Winner by {metric === 'booking' ? 'bookings' : 'clicks'}</span>}
                </p>
                <p className="text-sm text-steel">
                  Click rate <strong className="text-chalk">{pct(r.clickRate)}</strong> · {money(r.revenueCents, { whole: true })}
                  {r.skipped + r.failed > 0 && ` · ${r.skipped} skipped · ${r.failed} failed`}
                </p>
              </div>
              <svg role="img" aria-label={`Variant ${r.variant}: ${r.delivered} delivered, ${r.clicked} clicked, ${r.converted} booked`} width="100%" height={METRICS.length * 22} className="block">
                {METRICS.map((m, i) => {
                  const value = r[m.key];
                  return (
                    <g key={m.key}>
                      <text x="0" y={i * 22 + 13} fontSize={11} fill="var(--steel)">{m.label}</text>
                      <rect x="22%" y={i * 22 + 3} width="64%" height="12" rx="2" fill="var(--gunmetal)" />
                      <rect x="22%" y={i * 22 + 3} width={`${Math.max(value ? 0.8 : 0, (value / max) * 64)}%`} height="12" rx="2" fill={i === 2 ? 'var(--clover)' : isWinner ? 'var(--clover)' : 'var(--steel)'} opacity={i === 2 ? 1 : 0.8} />
                      <text x="100%" y={i * 22 + 13} textAnchor="end" fontSize={12} fontWeight={700} fill="var(--chalk)" className="tabular-nums">{value}</text>
                    </g>
                  );
                })}
              </svg>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

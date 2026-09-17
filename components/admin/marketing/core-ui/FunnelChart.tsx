import Link from 'next/link';
import type { FunnelRow } from '@/lib/marketing/core/analytics';
import { money } from '@/lib/format';
import { compact, pct, sourceLabel } from './labels';

interface Stage {
  label: string;
  value: number;
}

/** Hand-built SVG funnel: each stage is a centred bar scaled to the widest, with step conversion. */
export function FunnelChart({ stages }: { stages: Stage[] }) {
  const max = Math.max(1, ...stages.map((s) => s.value));
  const rowHeight = 58;
  const height = stages.length * rowHeight;
  const label = stages.map((s) => `${s.label} ${s.value}`).join(', ');

  return (
    <svg role="img" aria-label={`Funnel: ${label}`} width="100%" height={height} className="block overflow-visible">
      {stages.map((stage, index) => {
        const width = Math.max(stage.value > 0 ? 6 : 1.5, (stage.value / max) * 100);
        const prev = stages[index - 1];
        const rate = prev && prev.value > 0 ? stage.value / prev.value : null;
        const y = index * rowHeight;
        return (
          <g key={stage.label}>
            <rect x={`${(100 - width) / 2}%`} y={y + 18} width={`${width}%`} height={30} rx={3} fill="var(--clover)" opacity={1 - index * 0.18} />
            <text x="0" y={y + 12} fontSize={11} fontWeight={700} fill="var(--steel)" letterSpacing="0.12em">{stage.label.toUpperCase()}</text>
            <text x="100%" y={y + 12} textAnchor="end" fontSize={11} fill="var(--steel)">
              {rate === null ? '' : `${pct(rate)} of ${prev!.label.toLowerCase()}`}
            </text>
            <text x="50%" y={y + 38} textAnchor="middle" fontSize={15} fontWeight={800} fill="var(--carbon)" className="tabular-nums">
              {stage.value > 0 ? compact(stage.value) : ''}
            </text>
            {stage.value === 0 && <text x="50%" y={y + 38} textAnchor="middle" fontSize={13} fill="var(--steel)">0</text>}
          </g>
        );
      })}
    </svg>
  );
}

export function ModelToggle({ model }: { model: 'first' | 'last' }) {
  const option = (value: 'first' | 'last', text: string) => (
    <Link
      href={value === 'last' ? '/admin/marketing' : '/admin/marketing?model=first'}
      scroll={false}
      aria-current={model === value ? 'true' : undefined}
      className={`inline-flex h-8 items-center rounded-sm px-3 text-xs font-bold uppercase tracking-widest transition-colors ${
        model === value ? 'bg-clover text-carbon' : 'text-steel hover:text-chalk'
      }`}
    >
      {text}
    </Link>
  );
  return (
    <div role="group" aria-label="Attribution model" className="inline-flex rounded-sm border border-line bg-carbon p-0.5">
      {option('first', 'First touch')}
      {option('last', 'Last touch')}
    </div>
  );
}

/** Revenue by source as SVG bars with CPL and ROAS alongside. */
export function SourceRevenue({ rows }: { rows: FunnelRow[] }) {
  const visible = rows.filter((r) => r.leads || r.revenueCents || r.spendCents).slice(0, 8);
  const max = Math.max(1, ...visible.map((r) => r.revenueCents));
  if (!visible.length) return <p className="py-6 text-center text-sm text-steel">No attributed conversions yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead>
          <tr className="text-[0.68rem] uppercase tracking-widest text-steel">
            <th scope="col" className="pb-2 font-semibold">Source</th>
            <th scope="col" className="w-[38%] pb-2 font-semibold">Revenue</th>
            <th scope="col" className="pb-2 text-right font-semibold">Leads</th>
            <th scope="col" className="pb-2 text-right font-semibold">Cost / lead</th>
            <th scope="col" className="pb-2 text-right font-semibold">ROAS</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => (
            <tr key={row.source} className="border-t border-line">
              <th scope="row" className="py-2.5 pr-3 font-semibold">{sourceLabel(row.source)}</th>
              <td className="py-2.5 pr-3">
                <div className="flex items-center gap-2">
                  <svg width="100%" height="12" className="block min-w-0 flex-1" aria-hidden="true">
                    <rect width="100%" height="12" rx="2" fill="var(--gunmetal)" />
                    <rect width={`${Math.max(row.revenueCents ? 1 : 0, (row.revenueCents / max) * 100)}%`} height="12" rx="2" fill="var(--clover)" />
                  </svg>
                  <span className="w-16 text-right font-bold tabular-nums">{money(row.revenueCents, { whole: true })}</span>
                </div>
              </td>
              <td className="py-2.5 text-right tabular-nums">{row.leads}</td>
              <td className="py-2.5 text-right tabular-nums">{row.costPerLeadCents === null ? '—' : money(row.costPerLeadCents, { whole: true })}</td>
              <td className={`py-2.5 text-right font-bold tabular-nums ${row.roas !== null && row.roas >= 3 ? 'text-clover' : ''}`}>
                {row.roas === null ? '—' : `${row.roas.toFixed(1)}×`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

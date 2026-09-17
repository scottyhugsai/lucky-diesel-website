import type { DayPoint } from './performance-data';

const W = 720;
const H = 220;
const PAD = { top: 16, right: 44, bottom: 28, left: 48 };

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(value));
  const n = value / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

function shortDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** Daily spend as bars with leads as a line on a second axis. Hand-built SVG, scales to its container. */
export function SpendChart({ days, simulated }: { days: readonly DayPoint[]; simulated: boolean }) {
  if (!days.length) return <p className="py-10 text-center text-sm text-chalk/55">No spend yet. Activate a campaign, then sync.</p>;
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const maxSpend = niceMax(Math.max(...days.map((d) => d.spendCents)) / 100);
  const maxLeads = niceMax(Math.max(...days.map((d) => d.leads)));
  const step = plotW / days.length;
  const barW = Math.max(2, step * 0.62);
  const x = (i: number) => PAD.left + i * step + step / 2;
  const ySpend = (cents: number) => PAD.top + plotH - (cents / 100 / maxSpend) * plotH;
  const yLeads = (n: number) => PAD.top + plotH - (n / maxLeads) * plotH;
  const line = days.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${yLeads(d.leads).toFixed(1)}`).join(' ');
  const ticks = [0, 0.5, 1];
  const labelEvery = Math.ceil(days.length / 6);
  const total = days.reduce((t, d) => t + d.spendCents, 0);
  const leads = days.reduce((t, d) => t + d.leads, 0);

  return (
    <figure className="min-w-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${simulated ? 'Simulated ' : ''}daily spend and leads, ${days.length} days: $${(total / 100).toFixed(0)} spent, ${leads} leads.`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + plotH * (1 - t)} y2={PAD.top + plotH * (1 - t)} stroke="var(--line)" />
            <text x={PAD.left - 8} y={PAD.top + plotH * (1 - t) + 4} textAnchor="end" fontSize="11" fill="var(--steel)">${Math.round(maxSpend * t)}</text>
            <text x={W - PAD.right + 8} y={PAD.top + plotH * (1 - t) + 4} fontSize="11" fill="var(--clover)">{Math.round(maxLeads * t)}</text>
          </g>
        ))}
        {days.map((d, i) => (
          <rect key={d.date} x={x(i) - barW / 2} y={ySpend(d.spendCents)} width={barW} height={Math.max(0, PAD.top + plotH - ySpend(d.spendCents))} rx="1.5" fill="var(--gunmetal)" stroke="rgb(238 242 239 / 0.18)">
            <title>{`${shortDate(d.date)}: $${(d.spendCents / 100).toFixed(2)}, ${d.leads} leads`}</title>
          </rect>
        ))}
        <path d={line} fill="none" stroke="var(--clover)" strokeWidth="2.5" strokeLinejoin="round" />
        {days.map((d, i) => (i % labelEvery === 0 ? <text key={d.date} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--steel)">{shortDate(d.date)}</text> : null))}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-4 text-xs text-chalk/60">
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm border border-chalk/20 bg-gunmetal" aria-hidden="true" />Spend ($, left)</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 bg-clover" aria-hidden="true" />Leads (right)</span>
      </figcaption>
    </figure>
  );
}

/** Tiny horizontal share bar for tables. */
export function ShareBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <span className="block h-1.5 w-20 overflow-hidden rounded-full bg-gunmetal" aria-hidden="true">
      <span className="block h-full rounded-full bg-clover" style={{ width: `${pct}%` }} />
    </span>
  );
}

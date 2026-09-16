/*
 * Hand-built, server-rendered SVG charts. Geometry uses percentage x-coordinates
 * so the SVG stretches to its container while text stays at a readable pixel
 * size at any width. One accent (clover) for the primary series, steel for comparison.
 */

interface Datum {
  label: string;
  value: number;
}

const CLOVER = 'var(--clover)';
const STEEL = 'var(--steel)';
const CHALK = 'var(--chalk)';

export function ColumnChart({ data, format, ariaLabel, average = true, height = 240 }: { data: Datum[]; format: (value: number) => string; ariaLabel: string; average?: boolean; height?: number }) {
  const top = 22;
  const bottom = 24;
  const plot = height - top - bottom;
  const max = Math.max(1, ...data.map((d) => d.value));
  const slot = 100 / data.length;
  const mean = data.reduce((sum, d) => sum + d.value, 0) / Math.max(1, data.length);
  const meanY = top + plot - (mean / max) * plot;

  return (
    <svg role="img" aria-label={ariaLabel} width="100%" height={height} className="block overflow-visible">
      {data.map((d, index) => {
        const barHeight = Math.max(d.value > 0 ? 2 : 0, (d.value / max) * plot);
        const y = top + plot - barHeight;
        const isLatest = index === data.length - 1;
        return (
          <g key={`${d.label}-${index}`}>
            <rect x={`${index * slot + slot * 0.16}%`} y={y} width={`${slot * 0.68}%`} height={barHeight} rx={2} fill={CLOVER} opacity={isLatest ? 1 : 0.62} />
            <text x={`${index * slot + slot / 2}%`} y={y - 6} textAnchor="middle" fontSize={11} fontWeight={700} fill={CHALK} className="tabular-nums">
              {d.value > 0 ? format(d.value) : '—'}
            </text>
            <text x={`${index * slot + slot / 2}%`} y={height - 6} textAnchor="middle" fontSize={11} fill={STEEL}>
              {d.label}
            </text>
          </g>
        );
      })}
      <line x1="0" x2="100%" y1={top + plot + 0.5} y2={top + plot + 0.5} stroke="var(--line)" />
      {average && mean > 0 && (
        <g>
          <line x1="0" x2="100%" y1={meanY} y2={meanY} stroke={STEEL} strokeDasharray="3 4" />
        </g>
      )}
    </svg>
  );
}

export function BarList({ data, format, ariaLabel, secondary }: { data: Datum[]; format: (value: number) => string; ariaLabel: string; secondary?: (datum: Datum, index: number) => string | null }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div role="img" aria-label={ariaLabel} className="grid grid-cols-[max-content_minmax(0,1fr)_max-content] items-center gap-x-4 gap-y-2.5">
      {data.map((d, index) => {
        const note = secondary?.(d, index);
        const pct = (d.value / max) * 100;
        return (
          <div key={d.label} className="contents" aria-hidden="true">
            <span className="text-[13px] font-semibold">{d.label}</span>
            <svg width="100%" height="16" className="block">
              <rect x="0" y="0" width="100%" height="16" rx="2" fill="var(--gunmetal)" />
              <rect x="0" y="0" width={`${Math.max(d.value > 0 ? 0.8 : 0, pct)}%`} height="16" rx="2" fill={CLOVER} />
            </svg>
            <span className="text-right text-[13px] font-bold tabular-nums">
              {format(d.value)}
              {note && <span className="ml-1.5 inline-block min-w-[2.2rem] font-medium text-steel">{note}</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

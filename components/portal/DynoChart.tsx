/* Hand-built before/after dyno bars. Percent-based SVG geometry so text stays crisp at any width. */

export interface DynoPoint {
  label: string;
  horsepower: number | null;
  torque: number | null;
}

const BAR_HEIGHT = 30;
const ROW_GAP = 26;
const LABEL_SPACE = 20;
const AXIS_SPACE = 22;

function niceMax(value: number): number {
  const step = value > 800 ? 200 : 100;
  return Math.ceil((value * 1.08) / step) * step;
}

function MetricBars({ title, unit, before, after }: { title: string; unit: string; before: number; after: number }) {
  const max = niceMax(Math.max(before, after));
  const step = max / 4;
  const ticks = [0, 1, 2, 3, 4].map((i) => i * step);
  const rows = [
    { key: 'before', name: 'Stock baseline', value: before, fill: 'var(--steel)', text: 'var(--carbon)' },
    { key: 'after', name: 'After tune', value: after, fill: 'var(--clover)', text: 'var(--carbon)' },
  ];
  const height = rows.length * (LABEL_SPACE + BAR_HEIGHT) + (rows.length - 1) * ROW_GAP + AXIS_SPACE;
  const gain = after - before;
  const pct = before > 0 ? Math.round((gain / before) * 100) : 0;

  return (
    <figure className="min-w-0">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-widest text-steel">{title}</span>
        <span className="display text-2xl not-italic tabular-nums text-clover">
          {gain >= 0 ? '+' : ''}{gain} <span className="text-base text-chalk/60">{unit} · {pct >= 0 ? '+' : ''}{pct}%</span>
        </span>
      </figcaption>
      <svg width="100%" height={height} className="mt-3 overflow-visible" role="img" aria-label={`${title}: stock ${before} ${unit}, after tune ${after} ${unit}`}>
        {ticks.map((tick) => {
          const x = `${(tick / max) * 100}%`;
          return (
            <g key={tick}>
              <line x1={x} x2={x} y1={0} y2={height - AXIS_SPACE + 4} stroke="var(--line)" strokeDasharray={tick === 0 ? undefined : '2 4'} />
              <text x={x} y={height - 4} fill="var(--steel)" fontSize={11} textAnchor={tick === 0 ? 'start' : tick === max ? 'end' : 'middle'} className="tabular-nums">
                {tick}
              </text>
            </g>
          );
        })}
        {rows.map((row, index) => {
          const top = index * (LABEL_SPACE + BAR_HEIGHT + ROW_GAP);
          const width = `${(row.value / max) * 100}%`;
          return (
            <g key={row.key}>
              <text x={0} y={top + 13} fill="var(--chalk)" fillOpacity={0.75} fontSize={12} fontWeight={600}>{row.name}</text>
              <rect x={0} y={top + LABEL_SPACE} width={width} height={BAR_HEIGHT} rx={2} fill={row.fill} />
              <text x={width} dx={-10} y={top + LABEL_SPACE + BAR_HEIGHT / 2} dominantBaseline="central" textAnchor="end" fill={row.text} fontSize={16} fontWeight={800} className="tabular-nums">
                {row.value}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

export function DynoChart({ baseline, after }: { baseline: DynoPoint; after: DynoPoint }) {
  return (
    <div className="grid gap-8 md:grid-cols-2 md:gap-10">
      {baseline.horsepower && after.horsepower ? <MetricBars title="Horsepower" unit="hp" before={baseline.horsepower} after={after.horsepower} /> : null}
      {baseline.torque && after.torque ? <MetricBars title="Torque" unit="lb-ft" before={baseline.torque} after={after.torque} /> : null}
    </div>
  );
}

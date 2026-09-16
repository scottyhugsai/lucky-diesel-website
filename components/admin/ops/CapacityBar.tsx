export function CapacityBar({ utilisation, peak, bays }: { utilisation: number; peak: number; bays: number }) {
  const pct = Math.round(utilisation * 100);
  const tone = peak >= bays ? 'bg-amber-300' : 'bg-clover';
  return (
    <div className="mt-1.5" title={`${pct}% of bay hours booked, ${peak} of ${bays} bays at peak`}>
      <div className="h-1 overflow-hidden rounded-full bg-gunmetal">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(pct, pct ? 4 : 0)}%` }} />
      </div>
      <p className="mt-1 text-[0.65rem] font-semibold tabular-nums text-steel">
        {peak}/{bays} bays · {pct}%
      </p>
    </div>
  );
}

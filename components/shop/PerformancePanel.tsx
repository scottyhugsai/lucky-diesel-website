import { ChevronDown, TrendingUp } from 'lucide-react';
import type { JobData } from '@/app/shop/jobs/[id]/_data';
import { Badge } from '@/components/app/ui';
import { dateOnly, firstName } from '@/lib/format';
import { DynoForm } from './DynoForm';
import { TuneForm } from './TuneForm';

function Disclosure({ title, children, open = false }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group rounded-md border border-line bg-carbon">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 font-semibold text-chalk hover:text-clover [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown className="size-5 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="border-t border-line p-4">{children}</div>
    </details>
  );
}

function GainBar({ label, unit, before, after }: { label: string; unit: string; before: number; after: number }) {
  const max = Math.max(before, after) || 1;
  const gain = after - before;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-widest text-steel">{label}</span>
        <span className={`display whitespace-nowrap text-3xl not-italic tabular-nums ${gain >= 0 ? 'text-clover' : 'text-danger'}`}>
          {gain >= 0 ? '+' : ''}{gain} <span className="text-base text-chalk/60">{unit}</span>
        </span>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-1 font-mono text-xs tabular-nums">
        <div className="flex items-center gap-2">
          <span className="h-3 origin-left rounded-r-sm bg-steel/50" style={{ width: `${(before / max) * 80}%` }} aria-hidden="true" />
          <span className="text-chalk/70">{before}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 origin-left rounded-r-sm bg-clover" style={{ width: `${(after / max) * 80}%` }} aria-hidden="true" />
          <span className="text-chalk">{after}</span>
        </div>
      </div>
    </div>
  );
}

export function PerformancePanel({ data }: { data: JobData }) {
  const { job, tunes, dynoRuns } = data;
  const baseline = [...dynoRuns].reverse().find((run) => run.is_baseline);
  const latest = [...dynoRuns].reverse().find((run) => !run.is_baseline);
  const tuneOptions = tunes.map((tune) => ({ id: tune.id, label: `${tune.tuner_platform} · ${tune.calibrator ?? ''} ${tune.revision ?? ''} · ${dateOnly(tune.flashed_at)}`.replace(/\s+/g, ' ') }));

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
      <div className="grid content-start grid-cols-[minmax(0,1fr)] gap-4">
        <div className="rounded-md border border-line bg-carbon p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-chalk"><TrendingUp className="size-4 text-clover" aria-hidden="true" /> Dyno gains</p>
          {baseline && latest ? (
            <div className="mt-3 grid gap-4">
              {baseline.horsepower && latest.horsepower ? <GainBar label="Horsepower" unit="hp" before={baseline.horsepower} after={latest.horsepower} /> : null}
              {baseline.torque && latest.torque ? <GainBar label="Torque" unit="lb-ft" before={baseline.torque} after={latest.torque} /> : null}
              <p className="text-xs text-steel">“{baseline.label}” → “{latest.label}”</p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-chalk/60">{baseline ? 'Baseline logged. Add the after-tune pull to see the gain.' : 'Log a baseline pull first, then the after-tune run.'}</p>
          )}
        </div>

        {dynoRuns.length > 0 && (
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-2" aria-label="Dyno runs on this truck">
            {[...dynoRuns].reverse().map((run) => (
              <li key={run.id} className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-line px-3 py-2 text-sm">
                <span className="font-semibold">{run.label} {run.is_baseline && <Badge>baseline</Badge>}</span>
                <span className="font-mono tabular-nums text-chalk/80">
                  {run.horsepower ?? '—'} hp · {run.torque ?? '—'} tq{run.boost_psi != null ? ` · ${run.boost_psi} psi` : ''}{run.egt_f != null ? ` · ${run.egt_f}°F` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Disclosure title="Add dyno run">
          <DynoForm workOrderId={job.id} tunes={tuneOptions} hasBaseline={Boolean(baseline)} />
        </Disclosure>
      </div>

      <div className="grid content-start grid-cols-[minmax(0,1fr)] gap-4">
        {tunes.length ? (
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-2" aria-label="Tune history on this truck">
            {tunes.slice(0, 4).map((tune) => (
              <li key={tune.id} className="rounded-md border border-line bg-carbon p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-chalk">{tune.tuner_platform}{tune.calibrator ? ` · ${tune.calibrator}` : ''}</span>
                  <span className="text-xs text-steel">{dateOnly(tune.flashed_at)}{tune.flasher?.full_name ? ` · ${firstName(tune.flasher.full_name)}` : ''}</span>
                </div>
                <p className="mt-1 font-mono text-xs text-chalk/70">{[tune.ecu, tune.file_name, tune.revision].filter(Boolean).join(' · ') || 'No file details'}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {tune.stock_file_backed_up ? <Badge tone="good">Stock backed up</Badge> : <Badge tone="warn">No stock backup</Badge>}
                  <Badge tone={tune.emissions_compliant === false ? 'bad' : tune.emissions_compliant ? 'good' : 'neutral'}>
                    {tune.emissions_compliant === null ? 'Emissions unknown' : tune.emissions_compliant ? 'Emissions compliant' : 'Not emissions compliant'}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-md border border-dashed border-line p-4 text-sm text-chalk/60">No tunes on record for this truck.</p>
        )}
        <Disclosure title="Log a tune">
          <TuneForm workOrderId={job.id} />
        </Disclosure>
      </div>
    </div>
  );
}

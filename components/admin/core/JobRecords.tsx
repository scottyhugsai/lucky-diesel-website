import { Camera, FileSignature, Gauge, ShieldCheck, Timer } from 'lucide-react';
import { Avatar, Badge, TableWrap, tableClass } from '@/components/app/ui';
import { dateOnly, dateTime, money } from '@/lib/format';
import type { JobDetail } from './job-detail-data';

const RATING = {
  green: { tone: 'good', label: 'Good' },
  yellow: { tone: 'warn', label: 'Soon' },
  red: { tone: 'bad', label: 'Now' },
  na: { tone: 'neutral', label: 'N/A' },
} as const;

export function InspectionView({ inspection, photoUrls }: Pick<JobDetail, 'inspection' | 'photoUrls'>) {
  if (!inspection) return <p className="text-sm text-steel">No inspection on this job. Techs record them from the shop app.</p>;
  const items = [...inspection.inspection_items].sort((a, b) => a.sort - b.sort);
  return (
    <div className="grid gap-4">
      <p className="flex flex-wrap items-center gap-2 text-sm text-chalk/70">
        <Badge tone={inspection.status === 'sent' ? 'good' : 'neutral'}>{inspection.status === 'sent' ? 'Sent to customer' : 'Draft'}</Badge>
        {inspection.profiles?.full_name && <span>by {inspection.profiles.full_name}</span>}
        {inspection.sent_at && <span className="text-steel">· {dateTime(inspection.sent_at)}</span>}
      </p>
      {inspection.summary && <p className="border-l-2 border-clover pl-3 text-chalk/85">{inspection.summary}</p>}
      <ul className="divide-y divide-line">
        {items.map((item) => (
          <li key={item.id} className="grid gap-2 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[0.65rem] font-bold uppercase tracking-widest text-steel">{item.category}</p>
                <p className="font-semibold">{item.label}</p>
                {item.notes && <p className="mt-0.5 text-sm text-chalk/65">{item.notes}</p>}
              </div>
              <Badge tone={RATING[item.rating].tone}>{RATING[item.rating].label}</Badge>
            </div>
            {item.media.some((m) => photoUrls[m.path]) && (
              <div className="flex flex-wrap gap-2">
                {item.media.filter((m) => photoUrls[m.path]).map((m) => (
                  <a key={m.id} href={photoUrls[m.path]} target="_blank" rel="noreferrer" className="group relative block overflow-hidden rounded-sm border border-line">
                    {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed Supabase URLs can't go through the image optimizer */}
                    <img src={photoUrls[m.path]} alt={m.caption ?? item.label} width={160} height={120} loading="lazy" className="h-[120px] w-[160px] object-cover transition-transform group-hover:scale-105" />
                    {m.caption && <span className="absolute inset-x-0 bottom-0 truncate bg-carbon/85 px-2 py-1 text-[0.7rem]">{m.caption}</span>}
                  </a>
                ))}
              </div>
            )}
            {item.media.length > 0 && !item.media.some((m) => photoUrls[m.path]) && (
              <p className="flex items-center gap-1.5 text-xs text-steel"><Camera className="size-3.5" aria-hidden="true" /> {item.media.length} file(s), preview unavailable</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SignaturesView({ approvals, acks }: Pick<JobDetail, 'approvals' | 'acks'>) {
  if (!approvals.length && !acks.length) return <p className="text-sm text-steel">No customer approvals or signed acknowledgements yet.</p>;
  return (
    <ul className="grid gap-3">
      {approvals.map((a) => (
        <li key={a.id} className="rounded-sm border border-line bg-carbon p-3 text-sm">
          <p className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2 font-semibold"><FileSignature className="size-4 text-clover" aria-hidden="true" /> Estimate e-signed by {a.signer_name}</span>
            <span className="font-bold tabular-nums">{money(a.approved_total_cents)}</span>
          </p>
          <p className="mt-1 text-chalk/65">{a.approved_item_ids.length} approved · {a.declined_item_ids.length} declined</p>
          <Evidence when={a.created_at} ip={a.ip} extra={a.user_agent} hash={a.snapshot_sha256} />
        </li>
      ))}
      {acks.map((a) => (
        <li key={a.id} className="rounded-sm border border-line bg-carbon p-3 text-sm">
          <p className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-4 text-clover" aria-hidden="true" /> Acknowledgement signed by {a.signer_name}</p>
          <p className="mt-1 line-clamp-3 text-chalk/65">{a.body}</p>
          <Evidence when={a.created_at} ip={a.ip} extra={`Template ${a.template_version}`} />
        </li>
      ))}
    </ul>
  );
}

function Evidence({ when, ip, extra, hash }: { when: string; ip: string | null; extra?: string | null; hash?: string }) {
  return (
    <dl className="mt-2 grid gap-x-4 gap-y-0.5 text-xs text-steel sm:grid-cols-[auto_1fr]">
      <dt>When</dt><dd className="text-chalk/75">{dateTime(when)}</dd>
      <dt>IP</dt><dd className="font-mono text-chalk/75">{ip ?? 'not captured'}</dd>
      {extra && <><dt>Device</dt><dd className="truncate text-chalk/75" title={extra}>{extra}</dd></>}
      {hash && <><dt>SHA-256</dt><dd className="break-all font-mono text-chalk/75">{hash}</dd></>}
    </dl>
  );
}

export function PerformanceRecords({ tunes, dyno }: Pick<JobDetail, 'tunes' | 'dyno'>) {
  if (!tunes.length && !dyno.length) return <p className="text-sm text-steel">No tune flashes or dyno pulls logged on this job.</p>;
  const baseline = dyno.find((d) => d.is_baseline);
  return (
    <div className="grid gap-4">
      {tunes.map((t) => (
        <div key={t.id} className="rounded-sm border border-line bg-carbon p-3 text-sm">
          <p className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold">{t.tuner_platform} · {t.calibrator ?? 'Custom'} {t.revision}</span>
            <span className="flex gap-1.5">
              {t.emissions_compliant !== null && <Badge tone={t.emissions_compliant ? 'good' : 'warn'}>{t.emissions_compliant ? 'Emissions compliant' : 'Check compliance'}</Badge>}
              <Badge tone={t.stock_file_backed_up ? 'good' : 'bad'}>{t.stock_file_backed_up ? 'Stock file saved' : 'No stock backup'}</Badge>
            </span>
          </p>
          <p className="mt-1 text-xs text-steel">
            {[t.ecu && `ECU ${t.ecu}`, t.device_serial && `Serial ${t.device_serial}`, t.file_name, t.profiles?.full_name && `by ${t.profiles.full_name}`, dateOnly(t.flashed_at)].filter(Boolean).join(' · ')}
          </p>
          {t.notes && <p className="mt-1 text-chalk/65">{t.notes}</p>}
        </div>
      ))}
      {dyno.length > 0 && (
        <TableWrap>
          <table className={`${tableClass} min-w-[480px]`}>
            <thead><tr><th scope="col">Pull</th><th scope="col" className="text-right">HP</th><th scope="col" className="text-right">Torque</th><th scope="col" className="text-right">Boost</th><th scope="col" className="text-right">EGT</th></tr></thead>
            <tbody>
              {dyno.map((d) => {
                const gain = baseline && !d.is_baseline && d.horsepower && baseline.horsepower ? d.horsepower - baseline.horsepower : null;
                return (
                  <tr key={d.id}>
                    <td><span className="flex items-center gap-2 font-semibold"><Gauge className={`size-4 ${d.is_baseline ? 'text-steel' : 'text-clover'}`} aria-hidden="true" />{d.label}</span></td>
                    <td className="text-right tabular-nums">{d.horsepower ?? '—'}{gain !== null && <span className="ml-1 text-xs font-bold text-clover">+{gain}</span>}</td>
                    <td className="text-right tabular-nums">{d.torque ?? '—'}</td>
                    <td className="text-right tabular-nums">{d.boost_psi ?? '—'} psi</td>
                    <td className="text-right tabular-nums">{d.egt_f ?? '—'}°F</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      )}
    </div>
  );
}

export function TimeView({ time, billedHours, now }: { time: JobDetail['time']; billedHours: number; now: number }) {
  const hours = (start: string, end: string | null) => ((end ? new Date(end).getTime() : now) - new Date(start).getTime()) / 3_600_000;
  const clocked = time.reduce((sum, t) => sum + hours(t.started_at, t.ended_at), 0);
  const efficiency = clocked > 0 ? Math.round((billedHours / clocked) * 100) : null;
  return (
    <div className="grid gap-3">
      <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-sm border border-line bg-line text-center">
        {[['Clocked', `${clocked.toFixed(1)}h`], ['Billed', `${billedHours.toFixed(1)}h`], ['Efficiency', efficiency === null ? '—' : `${efficiency}%`]].map(([label, value]) => (
          <div key={label} className="bg-carbon p-3">
            <dt className="text-[0.65rem] font-bold uppercase tracking-widest text-steel">{label}</dt>
            <dd className={`display mt-1 text-2xl not-italic tabular-nums ${label === 'Efficiency' && efficiency !== null ? (efficiency >= 100 ? 'text-clover' : 'text-amber-300') : ''}`}>{value}</dd>
          </div>
        ))}
      </dl>
      {time.length ? (
        <ul className="divide-y divide-line text-sm">
          {time.map((t) => (
            <li key={t.id} className="flex items-center gap-3 py-2">
              <Avatar name={t.profiles?.full_name ?? '?'} color={t.profiles?.avatar_color} size={24} />
              <span className="min-w-0 flex-1 truncate">{t.profiles?.full_name} · {dateTime(t.started_at)}</span>
              <span className={`flex items-center gap-1 tabular-nums ${t.ended_at ? 'text-chalk/75' : 'font-bold text-clover'}`}>
                {!t.ended_at && <Timer className="size-3.5" aria-hidden="true" />}
                {hours(t.started_at, t.ended_at).toFixed(1)}h{!t.ended_at && ' · on the clock'}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-steel">No time clocked yet.</p>
      )}
    </div>
  );
}

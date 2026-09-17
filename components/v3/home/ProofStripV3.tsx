import type { BuildStats } from '../data';
import { MONO, WRAP } from '../ui';
import { CountUp } from './CountUp';

interface Stat {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
}

/** Two or three counters straight from the builds table. Says "example" when that is all there is. */
export function ProofStripV3({ stats }: { stats: BuildStats }) {
  const items: Stat[] = [];
  if (stats.avgHpGain !== null) items.push({ label: 'Avg HP gained', value: stats.avgHpGain, prefix: '+' });
  if (stats.trucks > 0) items.push({ label: stats.trucks === 1 ? 'Truck on the dyno' : 'Trucks on the dyno', value: stats.trucks });
  if (stats.topTorque !== null) items.push({ label: 'Top torque lb-ft', value: stats.topTorque });
  if (!items.length) return null;

  return (
    <section aria-label="Shop numbers" className="border-y border-line bg-carbon-2">
      <div className={`${WRAP} py-6 sm:py-8`}>
        <dl className="grid grid-cols-3 divide-x divide-line">
          {items.map((item) => (
            <div key={item.label} className="px-3 first:pl-0 last:pr-0 sm:px-6">
              <dd className={`${MONO} text-[clamp(1.75rem,1rem+3.5vw,3.25rem)] font-medium leading-none text-clover`}>
                <CountUp value={item.value} prefix={item.prefix} suffix={item.suffix} />
              </dd>
              <dt className="mt-2 text-[0.6875rem] uppercase tracking-[0.14em] text-steel sm:text-xs">{item.label}</dt>
            </div>
          ))}
        </dl>
        {stats.allSamples && <p className="mt-4 text-xs text-steel">From the shop’s example builds. Customer dyno sheets are added as trucks roll out.</p>}
      </div>
    </section>
  );
}

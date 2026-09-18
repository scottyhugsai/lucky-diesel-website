import Link from 'next/link';
import { ArrowRight, CalendarClock } from 'lucide-react';
import type { BlockValues } from '@/lib/site-content/fields';
import { str } from '@/lib/site-content/values';
import { BUSINESS } from '@/lib/site';
import type { BuildStats, NextSlot } from '@/components/v3/data';
import { VectorField } from '../VectorField';
import { BTN_GHOST, BTN_PRIMARY, WRAP } from '../ui';

interface HeroV4Props {
  values: BlockValues;
  stats: BuildStats;
  nextSlot: NextSlot | null;
}

/**
 * Asymmetric opener: copy on the left, the airflow field bleeding off the right
 * edge. The figures underneath come from published builds — nothing is claimed
 * that the shop's own data does not hold.
 */
export function HeroV4({ values, stats, nextSlot }: HeroV4Props) {
  const headline = str(values, 'headline').split('\n').filter(Boolean).join(' ');
  const figures = [
    stats.avgHpGain ? { value: `+${stats.avgHpGain}`, unit: 'hp', label: 'Average gain' } : null,
    stats.topTorque ? { value: `${stats.topTorque}`, unit: 'lb-ft', label: 'Highest torque' } : null,
    stats.trucks ? { value: `${stats.trucks}`, unit: '', label: stats.trucks === 1 ? 'Truck on the board' : 'Trucks on the board' } : null,
  ].filter((figure): figure is { value: string; unit: string; label: string } => figure !== null);

  return (
    <section aria-labelledby="hero-heading" className="relative isolate overflow-hidden border-b border-line">
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 -z-10 w-full lg:w-[62%]">
        <div className="absolute inset-0 bg-[radial-gradient(90%_70%_at_75%_35%,var(--gunmetal),transparent_70%)]" />
        <VectorField />
      </div>

      <div className={`${WRAP} grid gap-12 pb-16 pt-14 sm:pb-24 sm:pt-20 lg:grid-cols-12 lg:gap-8 lg:pb-32 lg:pt-28`}>
        <div className="lg:col-span-7">
          <p className="kicker">{str(values, 'eyebrow')}</p>
          <h1 id="hero-heading" className="v4-title mt-5 text-[length:var(--text-mega)]">{headline}</h1>
          <p className="mt-6 max-w-lg text-lg leading-snug text-steel sm:text-xl">{str(values, 'subhead')}</p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href={str(values, 'primaryHref') || '/book'} className={BTN_PRIMARY}>
              {str(values, 'primaryLabel')} <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link href="/build-planner" className={BTN_GHOST}>Plan a build</Link>
          </div>

          {nextSlot && (
            <p className="mt-5 flex items-center gap-2 text-[0.9375rem] text-steel">
              <CalendarClock className="size-4 text-clover" aria-hidden="true" />
              Next opening <span className="v4-num text-chalk">{nextSlot.label}</span>
            </p>
          )}
        </div>

        {figures.length > 0 && (
          <dl className="lg:col-span-5 lg:self-end">
            <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-1">
              {figures.map((figure) => (
                <div key={figure.label} className="bg-carbon-2 px-4 py-5 lg:flex lg:items-baseline lg:justify-between lg:gap-4">
                  <dd className="v4-num text-3xl text-chalk lg:order-2 lg:text-4xl">
                    {figure.value}
                    {figure.unit && <span className="ml-1 text-sm font-medium text-steel">{figure.unit}</span>}
                  </dd>
                  <dt className="mt-1 text-[0.8125rem] text-steel lg:order-1 lg:mt-0">{figure.label}</dt>
                </div>
              ))}
            </div>
            {stats.allSamples && (
              <p className="mt-2 text-[0.75rem] text-steel">Figures from shop example builds, labelled as such.</p>
            )}
          </dl>
        )}
      </div>

      <p className="sr-only">{BUSINESS.legalName} — {BUSINESS.city}, {BUSINESS.region}</p>
    </section>
  );
}

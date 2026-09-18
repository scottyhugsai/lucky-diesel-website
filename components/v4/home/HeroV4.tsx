import Link from 'next/link';
import { Phone } from 'lucide-react';
import type { BlockValues } from '@/lib/site-content/fields';
import { lines, str } from '@/lib/site-content/values';
import type { Fitment } from '@/lib/fitment/select';
import { BUSINESS } from '@/lib/site';
import type { BuildStats } from '@/components/v3/data';
import { FitmentPicker } from '../FitmentPicker';
import { WRAP } from '../ui';

/**
 * The tool takes the space a hero photo would normally take. That is the whole
 * idea of this design, and it is also what makes it viable for a shop with
 * seven photographs: the interface is the imagery.
 */
export function HeroV4({ values, fitment, stats }: { values: BlockValues; fitment: Fitment; stats: BuildStats }) {
  const headline = lines(values, 'headline');
  const proof = [
    stats.avgHpGain ? { value: `+${stats.avgHpGain}`, unit: 'hp', label: 'avg gain' } : null,
    stats.topTorque ? { value: `${stats.topTorque}`, unit: 'lb-ft', label: 'best torque' } : null,
  ].filter((entry): entry is { value: string; unit: string; label: string } => entry !== null);

  return (
    <section aria-labelledby="hero-heading" className="grain relative isolate overflow-hidden border-b border-line">
      <div aria-hidden="true" className="absolute -left-40 top-[-10%] -z-10 size-[44rem] rounded-full opacity-40 blur-3xl" style={{ background: 'radial-gradient(circle, var(--clover-glow), transparent 62%)' }} />

      <div className={`${WRAP} grid items-center gap-8 py-10 sm:py-14 lg:grid-cols-12 lg:gap-12 lg:py-24`}>
        <div className="lg:col-span-7">
          <p className="kicker">{str(values, 'eyebrow')}</p>
          <h1 id="hero-heading" className="v4-title mt-4 text-[length:var(--text-mega)]">
            {headline.map((line, index) => (
              <span key={line} className={`block ${index === headline.length - 1 ? 'text-clover' : ''}`}>{line}</span>
            ))}
          </h1>
          <p className="mt-6 max-w-md text-lg leading-snug text-steel">{str(values, 'subhead')}</p>

          <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
            <a href={BUSINESS.phoneHref} className="flex items-center gap-2 text-lg font-semibold transition-colors hover:text-clover">
              <Phone className="size-4 text-clover" aria-hidden="true" />
              <span className="v4-num">{BUSINESS.phoneDisplay}</span>
            </a>
            <Link href="/book" className="text-lg font-semibold text-steel underline-offset-4 transition-colors hover:text-chalk hover:underline">
              or book online
            </Link>
          </div>

          {proof.length > 0 && (
            <dl className="mt-10 hidden flex-wrap gap-x-10 gap-y-4 border-t border-line pt-6 lg:flex">
              {proof.map((entry) => (
                <div key={entry.label}>
                  <dd className="v4-num v4-title text-3xl text-chalk">
                    {entry.value}<span className="ml-1 text-sm not-italic text-steel">{entry.unit}</span>
                  </dd>
                  <dt className="kicker mt-1">{entry.label}</dt>
                </div>
              ))}
            </dl>
          )}
        </div>

        <div className="lg:col-span-5">
          <FitmentPicker fitment={fitment} />
        </div>
      </div>
    </section>
  );
}

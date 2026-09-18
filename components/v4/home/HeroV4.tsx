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
 *
 * Depth comes from three layers that leave the viewport at different speeds
 * as the page scrolls: the carbon texture (slowest), a large turbo silhouette
 * turning in 3D behind everything, and the type (fastest). All of it is CSS.
 */
export function HeroV4({ values, fitment, stats }: { values: BlockValues; fitment: Fitment; stats: BuildStats }) {
  const headline = lines(values, 'headline');
  // stats.avgHpGain and topTorque are computed over every published build,
  // sample rows included. A hero number has to come from real trucks only,
  // so the proof is re-derived here from the non-sample builds.
  const real = stats.builds.filter((build) => !build.isSample);
  const gains = real.map((build) => build.hpGain).filter((gain): gain is number => gain !== null);
  const torques = real.map((build) => build.afterTorque).filter((torque): torque is number => torque !== null);
  const proof = [
    gains.length ? { value: `+${Math.round(gains.reduce((sum, gain) => sum + gain, 0) / gains.length)}`, unit: 'hp', label: 'avg gain' } : null,
    torques.length ? { value: `${Math.max(...torques)}`, unit: 'lb-ft', label: 'best torque' } : null,
  ].filter((entry): entry is { value: string; unit: string; label: string } => entry !== null);

  return (
    <section aria-labelledby="hero-heading" className="grain relative isolate overflow-hidden">
      {/* Decorative only: an abstract carbon-and-light texture, not a photograph
          of anything, so it makes no claim about a shop or a build. Set as a CSS
          background so the browser fetches it at low priority and the headline
          stays the largest paint. */}
      <div
        aria-hidden="true"
        className="v4-hero-bg absolute -inset-[6%] -z-30 bg-cover bg-center opacity-55"
        style={{ backgroundImage: 'url(/images/texture-carbon.jpg)' }}
      />
      {/* The turbo mark as a silhouette, drawn with mask-image rather than an
          <img> so it is never a largest-paint candidate and can sit at low
          opacity. Layered above the scrim (z-index in CSS) but below the type,
          and it tilts in 3D as the hero scrolls away. */}
      <div aria-hidden="true" className="v4-hero-mark pointer-events-none absolute" />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{ background: 'linear-gradient(100deg, var(--carbon) 22%, rgb(11 13 12 / 0.72) 52%, rgb(11 13 12 / 0.55) 100%)' }}
      />

      <div className={`${WRAP} grid items-center gap-8 py-10 sm:py-14 lg:grid-cols-12 lg:gap-12 lg:py-24`}>
        <div className="v4-hero-type lg:col-span-7">
          <p className="kicker">{str(values, 'eyebrow')}</p>
          <h1 id="hero-heading" className="v4-title mt-4 text-[length:var(--text-mega)]">
            {headline.map((line, index) => (
              <span key={line} className="v4-line block">
                <span className={`v4-line-in block ${index === headline.length - 1 ? 'text-clover' : ''}`}>{line}</span>
              </span>
            ))}
          </h1>
          <p className="mt-6 max-w-md text-lg leading-snug text-steel">{str(values, 'subhead')}</p>

          <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
            <a href={BUSINESS.phoneHref} className="inline-flex min-h-11 items-center gap-2 text-lg font-semibold transition-colors hover:text-clover">
              <Phone className="size-4 text-clover" aria-hidden="true" />
              <span className="v4-num">{BUSINESS.phoneDisplay}</span>
            </a>
            <Link href="/book" className="inline-flex min-h-11 items-center text-lg font-semibold text-steel underline-offset-4 transition-colors hover:text-chalk hover:underline">
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

        <div className="v4-hero-tool lg:col-span-5">
          <FitmentPicker fitment={fitment} />
        </div>
      </div>
    </section>
  );
}

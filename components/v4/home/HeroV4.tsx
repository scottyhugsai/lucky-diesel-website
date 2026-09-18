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
 * Depth comes from two layers that leave the viewport at different speeds as
 * the page scrolls: the art (slowest) and the type (fastest). All of it is CSS.
 *
 * The art is a generated abstract surface, not a photograph: a vertical light
 * shaft on phones, turbine vanes from 1024px up (docs/IMAGERY.md). Where each
 * one sits, and how bright it may be under the copy, is worked out in the
 * .v4-art-hero rules in globals.css.
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
    <section aria-labelledby="hero-heading" className="grain relative isolate overflow-hidden bg-carbon">
      {/* Decorative only: a generated abstract surface, not a photograph of
          anything, so it makes no claim about a shop or a build. A CSS
          background, so the browser fetches it at low priority and the headline
          stays the largest paint; which file, and where, is decided in CSS so
          a phone never downloads the desktop art or vice versa. */}
      <div aria-hidden="true" className="v4-art v4-art-hero v4-hero-bg" />

      <div className={`${WRAP} grid items-center gap-5 py-6 sm:gap-8 sm:py-14 lg:grid-cols-12 lg:gap-12 lg:py-24`}>
        <div className="v4-hero-type lg:col-span-7">
          <p className="kicker">{str(values, 'eyebrow')}</p>
          <h1 id="hero-heading" className="v4-title mt-4 text-[length:var(--text-mega)]">
            {headline.map((line, index) => (
              <span key={line} className="v4-line block">
                <span className={`v4-line-in block ${index === headline.length - 1 ? 'text-clover' : ''}`}>{line}</span>
              </span>
            ))}
          </h1>
          <p className="mt-4 max-w-md text-lg leading-snug text-steel sm:mt-6">{str(values, 'subhead')}</p>

          {/* Hidden on phones, where the action bar pinned to the bottom of the
              screen already offers Call, Text and Book Online. Repeating them
              here cost 136px above the picker — which at 320px was the whole
              reason the picker, the hero of this design, started below the fold. */}
          <div className="mt-8 hidden flex-wrap items-center gap-x-8 gap-y-4 sm:flex">
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

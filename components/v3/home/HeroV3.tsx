import Image from 'next/image';
import Link from 'next/link';
import { CalendarClock } from 'lucide-react';
import type { BlockValues } from '@/lib/site-content/fields';
import { str } from '@/lib/site-content/values';
import type { BuildStats, NextSlot } from '../data';
import { BTN_GHOST, BTN_PRIMARY, CHIP, MONO, WRAP } from '../ui';
import { PlatformSwitch } from './PlatformSwitch';

interface HeroV3Props {
  stats: BuildStats;
  nextSlot: NextSlot | null;
  values: BlockValues;
}

/** Engine bay darkened to a surface; one dyno readout; platform pick in one tap. */
export function HeroV3({ stats, nextSlot, values }: HeroV3Props) {
  const top = stats.leaderboard[0] ?? null;
  const bookHref = nextSlot ? `/book?date=${nextSlot.date}` : '/book';

  return (
    <section aria-labelledby="hero-heading" className="relative isolate overflow-hidden pt-14">
      <Image
        src={str(values, 'image') || '/images/build-l5p-purple.jpg'}
        alt={str(values, 'imageAlt')}
        fill
        priority
        sizes="100vw"
        className="-z-20 object-cover object-[62%_38%] lg:object-[70%_45%]"
      />
      <div aria-hidden="true" className="v3-hero-shade absolute inset-0 -z-10" />

      <div className={`${WRAP} grid gap-10 pb-12 pt-10 sm:pt-16 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-end lg:gap-16 lg:pb-20 lg:pt-24`}>
        <div>
          <p className={`${MONO} text-xs uppercase tracking-[0.18em] text-clover`}>{str(values, 'eyebrow')}</p>
          <h1 id="hero-heading" className="v3-title mt-4 text-[clamp(2.5rem,1.4rem+5.2vw,4.75rem)]">
            {str(values, 'headline').split('\n').filter(Boolean).join(' ')}
          </h1>
          <p className="mt-4 max-w-md text-[1.0625rem] leading-snug text-chalk/75 sm:text-lg">{str(values, 'subhead')}</p>

          <PlatformSwitch className="mt-7 max-w-xl" />

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={bookHref} className={BTN_PRIMARY}>
              <CalendarClock className="size-4" aria-hidden="true" />
              Book
              {nextSlot && <span className={`${MONO} font-medium`}><span aria-hidden="true">· </span><span className="sr-only">next open </span>{nextSlot.label}</span>}
            </Link>
            <Link href="/store" className={BTN_GHOST}>Shop parts</Link>
          </div>
        </div>

        {top && (
          <Link href={`/builds/${top.slug}`} className="v3-readout group block border border-chalk/20 bg-carbon/80 p-5 sm:p-6" aria-label={`${top.title}: ${top.hpGain} horsepower gained. See the build.`}>
            <div className="flex items-center justify-between gap-3">
              <span className={`${MONO} text-xs uppercase tracking-[0.16em] text-steel`}>Latest dyno</span>
              {top.isSample && <span className={CHIP}>Example</span>}
            </div>
            <p className={`${MONO} mt-3 text-[clamp(3.5rem,2rem+7vw,6rem)] font-medium leading-none text-clover`}>
              +{top.hpGain}<span className="ml-2 text-[0.3em] uppercase tracking-[0.1em] text-chalk/80">HP</span>
            </p>
            <dl className={`${MONO} mt-4 grid grid-cols-2 gap-3 border-t border-chalk/15 pt-4 text-sm`}>
              <div>
                <dt className="text-[0.625rem] uppercase tracking-[0.14em] text-steel">Horsepower</dt>
                <dd className="mt-0.5 text-chalk">{top.beforeHp} <span aria-hidden="true" className="text-steel">→</span> <span className="sr-only">to </span>{top.afterHp}</dd>
              </div>
              {top.afterTorque !== null && (
                <div>
                  <dt className="text-[0.625rem] uppercase tracking-[0.14em] text-steel">Torque lb-ft</dt>
                  <dd className="mt-0.5 text-chalk">{top.beforeTorque ?? '—'} <span aria-hidden="true" className="text-steel">→</span> <span className="sr-only">to </span>{top.afterTorque}</dd>
                </div>
              )}
            </dl>
            <p className="mt-4 text-sm text-chalk/70">{top.vehicleLabel}</p>
            <p className="mt-1 text-sm font-semibold text-clover group-hover:underline underline-offset-4">See the build →</p>
          </Link>
        )}
      </div>
    </section>
  );
}

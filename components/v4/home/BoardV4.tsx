import type { CSSProperties } from 'react';
import Link from 'next/link';
import type { BuildStats } from '@/components/v3/data';
import { SECTION, SectionHead, WRAP } from '../ui';

/**
 * The gain numeral. The real number is in the DOM for everyone; where the
 * browser can scrub a registered custom property by scroll, a counter drawn
 * from that property is shown instead and counts up to the same figure as the
 * row comes into view. Nothing here invents a number — it only animates the
 * one the build already has.
 */
function Gain({ value }: { value: number }) {
  return (
    <span className="v4-count" style={{ '--gain': value } as CSSProperties}>
      <span className="v4-count-real">{value}</span>
    </span>
  );
}

/** The dyno board. The gain is set as the biggest thing on the row, because it
 *  is the only number a customer actually cares about. */
export function BoardV4({ stats, step }: { stats: BuildStats; step: string }) {
  const rows = stats.leaderboard.slice(0, 5);
  if (!rows.length) return null;
  // Bars are drawn to the biggest gain on the board, so the ranking is legible
  // at a glance instead of only in the numerals.
  const best = Math.max(...rows.map((build) => build.hpGain ?? 0), 1);

  return (
    <section aria-labelledby="board-v4-heading" className={`${SECTION} border-t border-line`}>
      <div className={WRAP}>
        <SectionHead id="board-v4-heading" index={`${step} — Dyno board`} title="What we made" href="/builds" linkLabel="All builds" />
        <ol className="v4-stagger mt-8">
          {rows.map((build, index) => (
            <li key={build.slug} className="relative isolate border-b border-line">
              {build.hpGain !== null && (
                <span
                  aria-hidden="true"
                  className="v4-bar absolute inset-y-0 left-0 -z-10 bg-clover/10"
                  style={{ width: `${Math.round((build.hpGain / best) * 100)}%` }}
                />
              )}
              <Link href={`/builds/${build.slug}`} className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 py-5 transition-colors hover:bg-carbon-2/60 sm:gap-6">
                <span className="v4-num w-7 pl-1 text-sm text-steel">{String(index + 1).padStart(2, '0')}</span>
                <span className="min-w-0">
                  <span className="v4-title line-clamp-2 text-xl transition-colors group-hover:text-clover sm:text-2xl">{build.title}</span>
                  <span className="mt-0.5 flex items-center gap-2 text-[0.8125rem] text-steel">
                    <span className="min-w-0 truncate">{build.vehicleLabel}</span>
                    {build.isSample && <span className="shrink-0 rounded-[2px] border border-line px-1.5 py-0.5 text-[0.6875rem] uppercase tracking-wide">Example</span>}
                  </span>
                </span>
                {build.hpGain !== null && (
                  <span className="v4-num v4-title shrink-0 pr-1 text-right text-3xl text-clover sm:text-5xl">
                    +<Gain value={build.hpGain} /><span className="ml-1 text-xs not-italic text-steel">hp</span>
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

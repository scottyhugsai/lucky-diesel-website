import Link from 'next/link';
import type { BuildStats } from '@/components/v3/data';
import { SECTION, SectionHead, WRAP } from '../ui';

/** The dyno board. The gain is set as the biggest thing on the row, because it
 *  is the only number a customer actually cares about. */
export function BoardV4({ stats, step }: { stats: BuildStats; step: string }) {
  const rows = stats.leaderboard.slice(0, 5);
  if (!rows.length) return null;

  return (
    <section aria-labelledby="board-v4-heading" className={`${SECTION} border-t border-line`}>
      <div className={WRAP}>
        <SectionHead id="board-v4-heading" index={`${step} — Dyno board`} title="What we made" href="/builds" linkLabel="All builds" />
        <ol className="mt-8">
          {rows.map((build, index) => (
            <li key={build.slug} className="border-b border-line">
              <Link href={`/builds/${build.slug}`} className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 py-5 transition-colors hover:bg-carbon-2 sm:gap-6">
                <span className="v4-num w-7 pl-1 text-sm text-steel">{String(index + 1).padStart(2, '0')}</span>
                <span className="min-w-0">
                  <span className="v4-title block truncate text-xl transition-colors group-hover:text-clover sm:text-2xl">{build.title}</span>
                  <span className="mt-0.5 block truncate text-[0.8125rem] text-steel">
                    {build.vehicleLabel}
                    {build.isSample && <span className="ml-2 rounded-sm border border-line px-1.5 py-0.5 text-[0.6875rem] uppercase tracking-wide">Example</span>}
                  </span>
                </span>
                {build.hpGain !== null && (
                  <span className="v4-num v4-title shrink-0 pr-1 text-right text-3xl text-clover sm:text-5xl">
                    +{build.hpGain}<span className="ml-1 text-xs not-italic text-steel">hp</span>
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

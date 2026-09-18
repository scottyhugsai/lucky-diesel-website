import Link from 'next/link';
import type { BuildStats } from '@/components/v3/data';
import { SECTION, SectionHead, WRAP } from '../ui';

/** The dyno board. Gains are set as the largest thing on the row — the numbers
 *  are the argument, so they get the scale. */
export function BoardV4({ stats }: { stats: BuildStats }) {
  const rows = stats.leaderboard.slice(0, 5);
  if (!rows.length) return null;

  return (
    <section aria-labelledby="board-heading" className={SECTION}>
      <div className={WRAP}>
        <SectionHead id="board-heading" index="03 — Dyno board" title="Biggest gains" href="/builds" linkLabel="All builds" />
        <ol className="mt-9 border-t border-line">
          {rows.map((build, index) => (
            <li key={build.slug} className="v4-row">
              <Link href={`/builds/${build.slug}`} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 py-5 sm:gap-6">
                <span className="v4-num w-6 text-sm text-steel">{String(index + 1).padStart(2, '0')}</span>
                <span className="min-w-0">
                  <span className="v4-title block truncate text-lg sm:text-xl">{build.title}</span>
                  <span className="mt-0.5 block truncate text-[0.8125rem] text-steel">
                    {build.vehicleLabel}
                    {build.isSample && <span className="ml-2 rounded-full border border-line px-1.5 py-0.5 text-[0.6875rem]">Example</span>}
                  </span>
                </span>
                {build.hpGain !== null && (
                  <span className="v4-num shrink-0 text-right text-2xl text-chalk sm:text-4xl">
                    +{build.hpGain}
                    <span className="ml-1 text-xs font-medium text-steel">hp</span>
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

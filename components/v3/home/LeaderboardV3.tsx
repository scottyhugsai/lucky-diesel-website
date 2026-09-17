import Image from 'next/image';
import Link from 'next/link';
import type { BuildStats } from '../data';
import { CHIP, MONO, SECTION, SectionHead, WRAP } from '../ui';

const LIMIT = 3;

/** Dyno leaderboard: builds ranked by horsepower gained. Zero-radius readouts, mono numbers. */
export function LeaderboardV3({ stats }: { stats: BuildStats }) {
  const rows = stats.leaderboard.slice(0, LIMIT);
  if (!rows.length) return null;

  return (
    <section aria-labelledby="leaderboard-heading" className={`${SECTION} border-t border-line bg-carbon-2`}>
      <div className={WRAP}>
        <SectionHead id="leaderboard-heading" index="03 / DYNO BOARD" title="Biggest gains" line="Ranked by horsepower added." href="/builds" linkLabel="All builds" />
        <ol className="mt-8 grid grid-cols-1 gap-3 lg:grid-cols-3">
          {rows.map((build, index) => (
            <li key={build.slug}>
              <Link href={`/builds/${build.slug}`} className="v3-tile group flex h-full gap-4 rounded-[8px] border border-line bg-carbon p-3 hover:border-clover lg:flex-col lg:p-4">
                <div className="relative aspect-square w-24 shrink-0 overflow-hidden rounded-[6px] bg-gunmetal lg:aspect-[16/10] lg:w-full">
                  <Image src={build.heroImage} alt={build.title} fill sizes="(min-width: 1024px) 380px, 96px" className="object-cover" />
                  <span className={`${MONO} absolute left-0 top-0 bg-clover px-2 py-1 text-xs font-semibold text-carbon`}>#{String(index + 1).padStart(2, '0')}</span>
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[0.9375rem] font-semibold text-chalk group-hover:text-clover">{build.title}</p>
                      <p className="truncate text-xs text-steel">{build.vehicleLabel}</p>
                    </div>
                    {build.isSample && <span className={CHIP}>Example</span>}
                  </div>
                  <dl className={`${MONO} mt-auto grid grid-cols-2 gap-2 pt-3 text-xs sm:text-sm`}>
                    <div className="v3-chip min-w-0 border border-line px-2 py-1.5">
                      <dt className="text-[0.625rem] uppercase tracking-[0.12em] text-steel">HP</dt>
                      <dd className="break-words text-chalk">{build.beforeHp}<span className="text-steel">→</span>{build.afterHp} <span className="text-clover">+{build.hpGain}</span></dd>
                    </div>
                    <div className="v3-chip min-w-0 border border-line px-2 py-1.5">
                      <dt className="text-[0.625rem] uppercase tracking-[0.12em] text-steel">lb-ft</dt>
                      <dd className="break-words text-chalk">{build.torqueGain !== null ? <>{build.beforeTorque}<span className="text-steel">→</span>{build.afterTorque} <span className="text-clover">+{build.torqueGain}</span></> : '—'}</dd>
                    </div>
                  </dl>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { PLATFORMS } from '@/lib/site';
import { SECTION, SectionHead, WRAP } from '../ui';

/** Three platforms, three cards, the engine codes doing the talking. */
export function LineupV4() {
  return (
    <section id="trucks" aria-labelledby="lineup-heading" className={SECTION}>
      <div className={WRAP}>
        <SectionHead id="lineup-heading" index="01 — Trucks" title="What are you driving?" />
        <ul className="mt-9 grid gap-4 md:grid-cols-3">
          {PLATFORMS.map((platform) => (
            <li key={platform.id} className="v4-card relative p-6">
              <p className="kicker">{platform.make}</p>
              <h3 className="v4-title mt-2 text-3xl">
                <Link href={`/${platform.id}`} className="after:absolute after:inset-0 focus-visible:outline-none">
                  {platform.name}
                </Link>
              </h3>
              <ul className="v4-num mt-5 space-y-1.5 text-[0.8125rem] text-steel">
                {platform.generations.slice(0, 3).map((generation) => <li key={generation}>{generation}</li>)}
                {platform.generations.length > 3 && <li>+{platform.generations.length - 3} more</li>}
              </ul>
              <ArrowUpRight className="absolute right-5 top-5 size-4 text-steel" aria-hidden="true" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

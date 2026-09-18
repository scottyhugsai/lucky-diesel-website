import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { PLATFORMS } from '@/lib/site';
import { SECTION, SectionHead, WRAP } from '../ui';

/** Three platforms, with the engine codes people actually search for. */
export function PlatformsV4({ step }: { step: string }) {
  return (
    <section id="trucks" aria-labelledby="platforms-v4-heading" className={`v4-rise ${SECTION} border-t border-line`}>
      <div className={WRAP}>
        <SectionHead id="platforms-v4-heading" index={`${step} — Platforms`} title="What we work on" />
        {/* The list carries the perspective; each tile flips up out of the floor
            as it scrolls into view. The tile itself keeps the hover lift, which
            is why the 3D motion sits on the wrapper and not on .v4-tier. */}
        <ul className="v4-deck mt-8 grid gap-3 md:grid-cols-3">
          {PLATFORMS.map((platform) => (
            <li key={platform.id} className="v4-flip">
              <div className="v4-tier v4-sheen group relative h-full p-5">
                <p className="kicker">{platform.make}</p>
                <h3 className="v4-title mt-2 text-3xl">
                  <Link href={`/${platform.id}`} className="after:absolute after:inset-0 focus-visible:outline-none">{platform.name}</Link>
                </h3>
                <ul className="v4-num mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-[0.8125rem] text-steel md:grid-cols-1">
                  {platform.generations.map((generation) => <li key={generation}>{generation}</li>)}
                </ul>
                <ArrowUpRight className="absolute right-4 top-4 size-4 text-steel transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-clover" aria-hidden="true" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

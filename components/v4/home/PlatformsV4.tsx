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
        <ul className="mt-8 grid gap-3 md:grid-cols-3">
          {PLATFORMS.map((platform) => (
            <li key={platform.id} className="v4-tier relative p-5">
              <p className="kicker">{platform.make}</p>
              <h3 className="v4-title mt-2 text-3xl">
                <Link href={`/${platform.id}`} className="after:absolute after:inset-0 focus-visible:outline-none">{platform.name}</Link>
              </h3>
              <ul className="v4-num mt-4 grid gap-1 text-[0.8125rem] text-steel">
                {platform.generations.map((generation) => <li key={generation}>{generation}</li>)}
              </ul>
              <ArrowUpRight className="absolute right-4 top-4 size-4 text-steel" aria-hidden="true" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

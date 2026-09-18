import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { PLATFORMS } from '@/lib/site';

/**
 * The way in for someone who already knows what they drive. The picker asks four
 * questions to reach a platform page; anybody who can say "it's an L5P" should
 * not have to answer them, and before a truck is chosen this is the only useful
 * thing that can stand where the answer will go.
 */
export function PlatformShortcuts() {
  return (
    <section aria-labelledby="platforms-heading">
      <h2 id="platforms-heading" className="v4-title text-2xl">Know the engine already?</h2>
      <p className="mt-2 text-steel">Skip the picker and go straight to the platform.</p>

      <ul className="mt-5 grid gap-3 sm:grid-cols-3">
        {PLATFORMS.map((platform) => (
          <li key={platform.id}>
            <Link
              href={`/${platform.id}`}
              className="v4-tier group relative flex h-full flex-col p-5 transition-colors hover:border-clover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clover"
            >
              <ArrowUpRight
                className="absolute right-4 top-4 size-4 text-steel transition-colors group-hover:text-clover"
                aria-hidden="true"
              />
              <p className="kicker pr-6 text-[0.8125rem]">{platform.make}</p>
              <p className="v4-title mt-2 text-2xl">{platform.name}</p>
              <p className="mt-2 text-sm leading-snug text-steel">{platform.tagline}</p>
              <p className="v4-num mt-auto pt-4 text-sm text-chalk/70 tabular-nums">
                {platform.generations.length} generations
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

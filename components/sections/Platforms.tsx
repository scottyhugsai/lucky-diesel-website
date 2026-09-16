import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Reveal } from '@/components/ui/Reveal';
import { PLATFORMS } from '@/lib/site';

export function Platforms() {
  return (
    <section id="trucks" aria-labelledby="trucks-heading" className="border-t border-line py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="kicker">Trucks we work on</p>
            <h2 id="trucks-heading" className="display mt-3 text-[length:var(--text-display)]">
              Every generation.
            </h2>
          </div>
          <p className="max-w-xs text-chalk/65">From a ’89 12-valve to a brand-new 6.7. Pick yours to start a quote.</p>
        </Reveal>

        <ul className="mt-12 border-t border-line">
          {PLATFORMS.map((platform, index) => (
            <Reveal as="li" key={platform.id} delayMs={index * 90} className="border-b border-line">
              <Link
                href={`/?truck=${platform.id}#quote`}
                scroll={false}
                className="group relative grid gap-4 overflow-hidden py-8 sm:grid-cols-[minmax(0,5fr)_minmax(0,6fr)_auto] sm:items-center sm:gap-8 sm:py-10"
              >
                <span aria-hidden="true" className="absolute inset-0 -z-10 origin-left scale-x-0 bg-clover transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:scale-x-100 group-focus-visible:scale-x-100" />
                <span className="flex items-baseline gap-4 transition-[padding] duration-500 group-hover:text-carbon sm:group-hover:pl-6">
                  <span className="display text-6xl sm:text-7xl lg:text-8xl">{platform.name}</span>
                  <span className="text-sm font-medium text-steel group-hover:text-carbon/70">{platform.make}</span>
                </span>
                <span className="flex flex-wrap gap-1.5">
                  {platform.generations.map((generation) => (
                    <span key={generation} className="rounded-sm border border-line px-2 py-1 text-xs tabular-nums text-chalk/70 group-hover:border-carbon/25 group-hover:text-carbon">
                      {generation}
                    </span>
                  ))}
                </span>
                <span className="flex items-center gap-2 font-semibold text-clover group-hover:text-carbon sm:pr-6">
                  <span className="sm:sr-only">Get a {platform.name} quote</span>
                  <ArrowUpRight className="size-8 transition-transform duration-300 group-hover:rotate-45" aria-hidden="true" />
                </span>
              </Link>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

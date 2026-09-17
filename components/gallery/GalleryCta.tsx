import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { BUSINESS } from '@/lib/site';

export function GalleryCta() {
  return (
    <section
      aria-labelledby="gallery-cta"
      className="grain relative mx-4 mt-20 overflow-hidden border border-line bg-carbon-2 sm:mx-6 sm:mt-28 lg:mx-auto lg:max-w-7xl [[data-design=v2]_&]:rounded-[2rem] [[data-design=v2]_&]:border-0"
    >
      <div className="speed-stripes absolute -right-10 top-0 h-full w-40 opacity-15 sm:w-72" aria-hidden="true" />
      <div className="relative flex flex-col gap-8 px-6 py-12 sm:px-12 sm:py-16 lg:flex-row lg:items-end lg:justify-between [[data-design=v2]_&]:items-center [[data-design=v2]_&]:text-center lg:[[data-design=v2]_&]:flex-col">
        <h2 id="gallery-cta" className="display max-w-xl text-5xl sm:text-6xl">
          Your truck belongs up there.
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/build-planner" className="btn-go inline-flex h-12 items-center justify-center gap-2 rounded-sm px-6 font-bold">
            Build yours <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          <a
            href={BUSINESS.social.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-sm border border-chalk/20 px-6 font-semibold text-chalk transition-colors hover:border-clover hover:text-clover [[data-design=v2]_&]:rounded-full"
          >
            See more on Instagram <ArrowUpRight className="size-4" aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}

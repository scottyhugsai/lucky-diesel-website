import Image from 'next/image';
import { ArrowUpRight } from 'lucide-react';
import { Reveal } from '@/components/ui/Reveal';
import { BUSINESS } from '@/lib/site';

export function FeaturedBuild() {
  return (
    <section aria-labelledby="build-heading" className="grain relative isolate overflow-hidden py-20 sm:py-28">
      <div
        aria-hidden="true"
        className="absolute right-[-10%] top-1/4 -z-10 size-[36rem] rounded-full opacity-40 blur-3xl"
        style={{ background: 'radial-gradient(circle, rgb(107 44 245 / 0.45), transparent 65%)' }}
      />
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:gap-16">
        <Reveal className="relative lg:col-span-7">
          <figure className="relative overflow-hidden rounded-sm">
            <Image
              src="/images/build-l5p-purple.jpg"
              alt="GMC Duramax L5P engine bay with purple-coated intake and charge pipes"
              width={1300}
              height={1400}
              sizes="(min-width: 1024px) 55vw, 100vw"
              className="aspect-[4/3] w-full object-cover object-[50%_40%] transition-transform duration-[1.2s] ease-[var(--ease-out-expo)] hover:scale-[1.03] lg:aspect-[5/4]"
            />
          </figure>
          <p className="display absolute -bottom-6 left-4 bg-violet px-4 py-2 text-2xl sm:left-8">L5P Duramax</p>
        </Reveal>

        <Reveal delayMs={120} className="lg:col-span-5">
          <p className="kicker">From the shop</p>
          <h2 id="build-heading" className="display mt-3 text-[length:var(--text-display)]">
            Built,
            <span className="block">not just</span>
            <span className="block text-clover">bolted on.</span>
          </h2>
          <p className="mt-6 max-w-md text-lg text-chalk/70">
            Clean installs, parts that match the tune, and a truck that runs as good as it looks.
          </p>
          <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-line bg-line">
            <div className="bg-carbon p-4">
              <dt className="text-xs uppercase tracking-widest text-steel">Platform</dt>
              <dd className="display mt-1 text-2xl not-italic">GMC L5P</dd>
            </div>
            <div className="bg-carbon p-4">
              <dt className="text-xs uppercase tracking-widest text-steel">Work</dt>
              <dd className="display mt-1 text-2xl not-italic">Intake &amp; charge pipes</dd>
            </div>
          </dl>
          <a
            href={BUSINESS.social.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="group mt-8 inline-flex items-center gap-2 font-semibold text-chalk transition-colors hover:text-clover"
          >
            See more builds on Instagram
            <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
          </a>
        </Reveal>
      </div>
    </section>
  );
}

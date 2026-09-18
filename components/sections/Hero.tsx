import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Phone } from 'lucide-react';
import type { BlockValues } from '@/lib/site-content/fields';
import { lines, str } from '@/lib/site-content/values';
import { BUSINESS, PLATFORMS } from '@/lib/site';

export function Hero({ values }: { values: BlockValues }) {
  const HEADLINE = lines(values, 'headline');
  const image = str(values, 'image') || '/images/shop-card.jpg';
  return (
    <section aria-labelledby="hero-heading" className="grain relative isolate overflow-hidden pb-16 pt-28 sm:pt-32 lg:min-h-[100svh] lg:pb-24">
      <div
        aria-hidden="true"
        className="absolute -left-40 bottom-[-20%] -z-10 size-[42rem] rounded-full opacity-60 blur-3xl"
        style={{ background: 'radial-gradient(circle, var(--clover-glow), transparent 65%)' }}
      />
      <div aria-hidden="true" className="speed-stripes absolute -right-24 top-24 -z-10 hidden h-[140%] w-64 -skew-x-[20deg] opacity-[0.08] lg:block" />

      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-12 lg:gap-6">
        <div className="lg:col-span-7">
          <p className="kicker rise">{str(values, 'eyebrow')}</p>

          <h1 id="hero-heading" className="display mt-5 text-[length:var(--text-mega)]">
            {HEADLINE.map((line, index) => (
              <span
                key={line}
                className={`rise block ${index === HEADLINE.length - 1 ? 'text-clover' : ''}`}
                style={{ '--rise-delay': `${120 + index * 110}ms` } as React.CSSProperties}
              >
                {line}
              </span>
            ))}
          </h1>

          <p className="rise mt-7 max-w-md text-lg leading-relaxed text-chalk/75 sm:text-xl" style={{ '--rise-delay': '480ms' } as React.CSSProperties}>
            {str(values, 'subhead')}
          </p>

          <div className="rise mt-9 flex flex-col gap-3 sm:flex-row" style={{ '--rise-delay': '580ms' } as React.CSSProperties}>
            <Link href={str(values, 'primaryHref') || '/#quote'} className="btn-go display group flex items-center justify-center gap-3 rounded-sm px-8 py-4 text-2xl not-italic">
              {str(values, 'primaryLabel')}
              <ArrowRight className="size-5 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
            </Link>
            <a
              href={BUSINESS.phoneHref}
              className="flex items-center justify-center gap-3 rounded-sm border border-chalk/25 px-7 py-4 text-lg font-semibold tabular-nums transition-colors duration-200 hover:border-clover hover:text-clover"
            >
              <Phone className="size-5" aria-hidden="true" />
              {BUSINESS.phoneDisplay}
            </a>
          </div>

          <div className="rise mt-12 border-t border-line pt-6" style={{ '--rise-delay': '700ms' } as React.CSSProperties}>
            <p className="text-sm text-steel">What are you driving?</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {PLATFORMS.map((platform) => (
                <li key={platform.id}>
                  <Link
                    href={`/${platform.id}`}
                    className="display inline-flex items-baseline gap-2 rounded-sm border border-line bg-carbon-2 px-4 py-2.5 text-xl not-italic transition-colors duration-200 hover:border-clover hover:bg-clover hover:text-carbon"
                  >
                    {platform.name}
                    <span className="font-sans text-xs font-semibold normal-case tracking-normal opacity-60">{platform.make}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="relative lg:col-span-5">
          <div aria-hidden="true" className="speed-stripes absolute -bottom-5 -left-5 h-2/3 w-2/3 opacity-90 [clip-path:polygon(12%_0,100%_0,88%_100%,0_100%)]" />
          <figure className="relative [clip-path:polygon(12%_0,100%_0,88%_100%,0_100%)]">
            <Image
              src={image}
              alt={str(values, 'imageAlt')}
              width={1600}
              height={900}
              priority
              sizes="(min-width: 1024px) 40vw, 100vw"
              className="aspect-[4/5] w-full object-cover object-[46%_center] sm:aspect-[16/11] lg:aspect-[4/5]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-carbon/70 via-transparent to-transparent" />
          </figure>
          <div className="absolute -bottom-6 right-4 flex items-center gap-3 rounded-sm border border-line bg-carbon/90 px-4 py-3 shadow-2xl backdrop-blur sm:right-10">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-clover opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2.5 rounded-full bg-clover" />
            </span>
            <span className="text-sm font-semibold">{str(values, 'badge')}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

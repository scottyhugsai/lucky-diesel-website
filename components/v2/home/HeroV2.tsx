import Image from 'next/image';
import type { BlockValues } from '@/lib/site-content/fields';
import { str } from '@/lib/site-content/values';
import { PillLink, TextLink } from '../ui';

/** Apple product-page opener: headline, one line, two links, then the photo presented big. */
export function HeroV2({ values }: { values: BlockValues }) {
  const headline = str(values, 'headline').split('\n').filter(Boolean).join(' ');
  return (
    <section aria-labelledby="hero-heading" className="bg-carbon pt-12">
      <div className="mx-auto max-w-3xl px-6 pt-16 text-center sm:pt-24">
        <p className="text-[15px] font-medium text-clover">{str(values, 'eyebrow')}</p>
        <h1 id="hero-heading" className="v2-title mt-3 text-[clamp(3rem,1.6rem+6.5vw,6.5rem)]">{headline}</h1>
        <p className="mx-auto mt-5 max-w-xl text-[19px] leading-snug text-chalk/70 sm:text-[24px]">{str(values, 'subhead')}</p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
          <PillLink href={str(values, 'primaryHref') || '/book'} size="lg">{str(values, 'primaryLabel')}</PillLink>
          <TextLink href="/store" size="lg">Shop parts</TextLink>
        </div>
      </div>

      <figure className="relative mx-auto mt-12 max-w-[1440px] sm:mt-16">
        <div className="v2-hero-photo relative aspect-[4/3] w-full overflow-hidden sm:aspect-[16/8.5]">
          <Image
            src={str(values, 'image') || '/images/build-l5p-purple.jpg'}
            alt={str(values, 'imageAlt')}
            fill
            priority
            sizes="100vw"
            className="object-cover object-[center_42%]"
          />
          {/* Soft vignette so the photo sits in the band instead of on it. */}
          <div aria-hidden="true" className="absolute inset-0 shadow-[inset_0_0_140px_70px_var(--carbon)]" />
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-carbon to-transparent" />
        </div>
        <figcaption className="mx-auto -mt-8 max-w-3xl px-6 pb-16 text-center text-[13px] text-steel sm:pb-20">{str(values, 'badge')}</figcaption>
      </figure>
    </section>
  );
}

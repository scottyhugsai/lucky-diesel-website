import { Reveal } from '@/components/ui/Reveal';
import { BUSINESS } from '@/lib/site';
import { PillLink, TextLink } from '../ui';

/** Closing call to action before the quote form. */
export function CtaBandV2() {
  return (
    <section aria-labelledby="cta-heading" className="bg-carbon-2 py-24 sm:py-32">
      <Reveal className="mx-auto max-w-3xl px-6 text-center">
        <h2 id="cta-heading" className="v2-title text-[clamp(2.5rem,1.4rem+4.5vw,5rem)]">
          Ready when you are.
        </h2>
        <p className="mt-4 text-[19px] text-chalk/70 sm:text-[22px]">Book online, or send us the details below.</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
          <PillLink href="/book" size="lg">Book now</PillLink>
          <TextLink href={BUSINESS.phoneHref} size="lg">Call {BUSINESS.phoneDisplay}</TextLink>
        </div>
      </Reveal>
    </section>
  );
}

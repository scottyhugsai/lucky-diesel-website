import { Reveal } from '@/components/ui/Reveal';
import { PLATFORMS } from '@/lib/site';
import { Band, SectionHeading, TextLink } from '../ui';

/** Three platform tiles, Apple "compare the lineup" style. */
export function LineupV2() {
  return (
    <Band id="trucks" tone="carbon-2" labelledBy="trucks-heading">
      <div className="mx-auto max-w-[1024px] px-4 sm:px-6">
        <Reveal>
          <SectionHeading id="trucks-heading" title="Pick your truck." line="Every generation. Every platform." />
        </Reveal>
        <ul className="mt-12 grid gap-4 sm:mt-16 md:grid-cols-3">
          {PLATFORMS.map((platform, index) => (
            <Reveal as="li" key={platform.id} delayMs={index * 80} className="flex">
              <div className="flex w-full flex-col items-center rounded-[28px] bg-carbon px-6 py-12 text-center">
                <p className="text-[13px] font-medium text-steel">{platform.make}</p>
                <h3 className="v2-title mt-1 text-[34px]">{platform.name}</h3>
                <p className="mt-3 text-[15px] text-chalk/60">{platform.generations.length} generations</p>
                <div className="mt-6 flex items-center gap-6">
                  <TextLink href={`/${platform.id}`}>Learn more</TextLink>
                  <TextLink href={`/store/products?platform=${platform.id}`}>Shop</TextLink>
                </div>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </Band>
  );
}

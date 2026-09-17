import Link from 'next/link';
import { Reveal } from '@/components/ui/Reveal';
import { money } from '@/lib/format';
import { SERVICES } from '@/lib/site';
import { Band, SectionHeading } from '../ui';

/** One line each, eight words or fewer. The long blurbs stay on v1. */
const SHORT_LINE: Record<string, string> = {
  tuning: 'EZ-Lynk engine and transmission tunes.',
  diagnostics: 'Find the real fault first.',
  turbo: 'Stock to Stage 2, installed.',
  fuel: 'Injectors, CP3 pumps and kits.',
  exhaust: '5-inch stainless, fitted right.',
  transmission: 'Built to hold the power.',
  engine: 'Fix it. Or build it.',
  maintenance: 'Keep a working truck working.',
  install: 'Your parts, put on right.',
};

export function ServicesV2() {
  return (
    <Band id="services" tone="carbon" labelledBy="services-heading">
      <div className="mx-auto max-w-[1024px] px-4 sm:px-6">
        <Reveal>
          <SectionHeading id="services-heading" title="Why Lucky." line="Nine ways we keep diesels working hard." />
        </Reveal>
        <ul className="mt-12 grid gap-3 sm:mt-16 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {SERVICES.map((service, index) => (
            <Reveal as="li" key={service.id} delayMs={(index % 3) * 60} className="flex">
              <Link href={`/?service=${service.id}#quote`} className="v2-tile flex w-full flex-col rounded-[24px] bg-carbon-2 p-6 sm:p-7">
                <h3 className="text-[21px] font-semibold tracking-tight text-chalk">{service.name}</h3>
                <p className="mt-1.5 text-[15px] text-chalk/60">{SHORT_LINE[service.id] ?? service.blurb}</p>
                <div className="mt-6 flex items-center justify-between gap-3">
                  <span className="text-[15px] font-medium text-clover">
                    Request <span aria-hidden="true">›</span>
                  </span>
                  {service.partsFrom && (
                    <span className="rounded-full bg-chalk/8 px-3 py-1 text-[12px] font-medium text-chalk/80 tabular-nums">
                      Parts from {money(service.partsFrom * 100, { whole: true })}
                    </span>
                  )}
                </div>
              </Link>
            </Reveal>
          ))}
        </ul>
      </div>
    </Band>
  );
}

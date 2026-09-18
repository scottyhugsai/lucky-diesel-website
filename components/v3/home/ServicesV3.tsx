import Link from 'next/link';
import { Activity, ClipboardCheck, Cog, Fan, Fuel, Gauge, Hammer, PackageCheck, Wind, type LucideIcon } from 'lucide-react';
import { money } from '@/lib/format';
import type { BlockValues } from '@/lib/site-content/fields';
import { str } from '@/lib/site-content/values';
import { SERVICES } from '@/lib/site';
import { MONO, SECTION, SectionHead, WRAP } from '../ui';

const ICONS: Record<string, LucideIcon> = {
  tuning: Gauge, diagnostics: Activity, turbo: Fan, fuel: Fuel, exhaust: Wind, transmission: Cog, engine: Hammer, maintenance: ClipboardCheck, install: PackageCheck,
};

/** Nine services, one icon and at most five words each. Each tile preselects the quote form. */
export function ServicesV3({ values }: { values: BlockValues }) {
  return (
    <section id="services" aria-labelledby="services-heading" className={`${SECTION} scroll-mt-14`}>
      <div className={WRAP}>
        <SectionHead id="services-heading" index={str(values, 'kicker')} title={str(values, 'heading')} line={str(values, 'intro')} />
        <ul className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
          {SERVICES.map((service) => {
            const Icon = ICONS[service.id] ?? Cog;
            return (
              <li key={service.id}>
                <Link href={`/?service=${service.id}#quote`} className="v3-tile flex h-full min-h-28 flex-col justify-between rounded-[8px] border border-line bg-carbon-2 p-4 hover:border-clover">
                  <Icon className="size-6 text-clover" strokeWidth={1.75} aria-hidden="true" />
                  <div className="mt-4">
                    <p className="text-[0.9375rem] font-semibold leading-tight text-chalk">{service.name}</p>
                    <p className={`${MONO} mt-1 text-xs text-steel`}>{service.partsFrom ? `parts from ${money(service.partsFrom * 100, { whole: true })}` : 'quoted per truck'}</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

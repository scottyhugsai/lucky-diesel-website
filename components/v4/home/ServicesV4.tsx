import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { money } from '@/lib/format';
import { SERVICES } from '@/lib/site';
import type { BlockValues } from '@/lib/site-content/fields';
import { str } from '@/lib/site-content/values';
import { SECTION, SectionHead, WRAP } from '../ui';

/** A list, not a grid of boxes: rows read faster and stay short. */
export function ServicesV4({ values }: { values: BlockValues }) {
  return (
    <section id="services" aria-labelledby="services-heading" className={`${SECTION} scroll-mt-16`}>
      <div className={WRAP}>
        <SectionHead
          id="services-heading"
          index="02 — Services"
          title={str(values, 'heading').split('\n').filter(Boolean).join(' ')}
          line={str(values, 'intro')}
        />
        <ul className="mt-9 border-t border-line">
          {SERVICES.map((service) => (
            <li key={service.id} className="v4-row">
              <Link href={`/?service=${service.id}#quote`} className="group flex min-h-16 items-center justify-between gap-5 py-4">
                <span className="v4-title text-xl sm:text-2xl">{service.name}</span>
                <span className="flex items-center gap-4">
                  {service.partsFrom && (
                    <span className="v4-num hidden text-[0.8125rem] text-steel sm:inline">
                      parts from {money(service.partsFrom * 100, { whole: true })}
                    </span>
                  )}
                  <ArrowRight className="size-4 shrink-0 text-steel transition-transform duration-300 group-hover:translate-x-1 group-hover:text-clover" aria-hidden="true" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

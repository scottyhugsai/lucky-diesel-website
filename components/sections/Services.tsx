import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Reveal } from '@/components/ui/Reveal';
import { SERVICES } from '@/lib/site';

export function Services() {
  return (
    <section id="services" aria-labelledby="services-heading" className="relative bg-carbon-2 py-20 sm:py-28">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-12">
        <Reveal className="lg:col-span-4">
          <div className="lg:sticky lg:top-28">
            <p className="kicker">What we do</p>
            <h2 id="services-heading" className="display mt-3 text-[length:var(--text-display)]">
              More power.
              <span className="block text-steel">Less guessing.</span>
            </h2>
            <p className="mt-6 max-w-sm text-chalk/65">
              One shop for the tune, the parts and the install. Tap a service to start a request.
            </p>
            <Link href="/#quote" className="btn-go display mt-8 inline-flex items-center gap-3 rounded-sm px-6 py-3 text-xl not-italic">
              Request service <ArrowRight className="size-5" aria-hidden="true" />
            </Link>
          </div>
        </Reveal>

        <ol className="lg:col-span-8">
          {SERVICES.map((service, index) => (
            <Reveal as="li" key={service.id} delayMs={index * 40}>
              <Link
                href={`/?service=${service.id}#quote`}
                scroll={false}
                className="group grid grid-cols-[3rem_1fr_auto] items-center gap-4 border-b border-line py-6 transition-colors duration-200 hover:border-clover sm:grid-cols-[4.5rem_1fr_auto] sm:py-7"
              >
                <span className="display text-3xl text-steel/50 tabular-nums transition-colors group-hover:text-clover sm:text-4xl">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span>
                  <span className="display block text-3xl not-italic sm:text-4xl">{service.name}</span>
                  <span className="mt-1 block text-[0.95rem] text-chalk/60">{service.blurb}</span>
                  {service.partsFrom && (
                    <span className="mt-2 inline-block rounded-sm bg-clover/10 px-2 py-0.5 text-xs font-semibold text-clover tabular-nums">
                      Parts from ${service.partsFrom.toLocaleString('en-US')}
                    </span>
                  )}
                </span>
                <span className="grid size-11 place-items-center rounded-full border border-line transition-all duration-300 group-hover:border-clover group-hover:bg-clover group-hover:text-carbon">
                  <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden="true" />
                  <span className="sr-only">Request {service.name.toLowerCase()}</span>
                </span>
              </Link>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

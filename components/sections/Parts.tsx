import Image from 'next/image';
import { ArrowUpRight } from 'lucide-react';
import { Reveal } from '@/components/ui/Reveal';
import Link from 'next/link';
import { PART_LINES, TUNING_BRANDS } from '@/lib/site';

export function Parts() {
  const [lead, ...rest] = PART_LINES;

  return (
    <section id="parts" aria-labelledby="parts-heading" className="border-t border-line bg-carbon-2 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="kicker">Parts &amp; tuning</p>
            <h2 id="parts-heading" className="display mt-3 text-[length:var(--text-display)]">
              The good stuff, in stock.
            </h2>
          </div>
          <Link
            href="/store"
            className="group inline-flex items-center gap-2 rounded-sm border border-chalk/25 px-5 py-3 font-semibold transition-colors hover:border-clover hover:text-clover"
          >
            Shop all parts
            <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        </Reveal>

        <div className="mt-12 grid gap-4 md:grid-cols-3 md:grid-rows-2">
          {lead && (
            <Reveal className="md:col-span-2 md:row-span-2">
              <PartCard {...lead} isFeatured />
            </Reveal>
          )}
          {rest.map((part, index) => (
            <Reveal key={part.title} delayMs={(index + 1) * 100}>
              <PartCard {...part} />
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-4 grid gap-6 rounded-sm border border-line bg-carbon p-6 sm:p-8 lg:grid-cols-[auto_1fr_auto] lg:items-center lg:gap-10">
          <p className="kicker">Tuning platforms</p>
          <ul className="flex flex-wrap gap-x-8 gap-y-2">
            {TUNING_BRANDS.map((brand) => (
              <li key={brand} className="display text-3xl not-italic sm:text-4xl">
                {brand}
              </li>
            ))}
          </ul>
          <Link
            href="/store/products?category=tuning"
            className="btn-go display inline-flex items-center justify-center gap-2 rounded-sm px-6 py-3 text-xl not-italic"
          >
            Find a tune <ArrowUpRight className="size-5" aria-hidden="true" />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

interface PartCardProps {
  title: string;
  brand: string;
  image: string;
  href: string;
  isFeatured?: boolean;
}

function PartCard({ title, brand, image, href, isFeatured = false }: PartCardProps) {
  return (
    <Link
      href={href}
      className="group relative flex h-full flex-col overflow-hidden rounded-sm bg-chalk text-carbon"
    >
      <div className={`relative flex flex-1 items-center justify-center p-6 ${isFeatured ? 'min-h-72 md:min-h-0' : 'min-h-52'}`}>
        <Image
          src={image}
          alt={title}
          width={900}
          height={600}
          sizes={isFeatured ? '(min-width: 768px) 60vw, 100vw' : '(min-width: 768px) 30vw, 100vw'}
          className="h-auto max-h-full w-full object-contain mix-blend-multiply transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:-rotate-2 group-hover:scale-105"
        />
      </div>
      <div className="flex items-end justify-between gap-4 border-t border-carbon/10 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-carbon/55">{brand}</p>
          <h3 className={`display mt-1 not-italic ${isFeatured ? 'text-4xl sm:text-5xl' : 'text-3xl'}`}>{title}</h3>
        </div>
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-carbon text-chalk transition-colors duration-300 group-hover:bg-clover-deep">
          <ArrowUpRight className="size-5" aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}

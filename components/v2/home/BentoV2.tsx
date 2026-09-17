import Image from 'next/image';
import Link from 'next/link';
import { Reveal } from '@/components/ui/Reveal';
import { TUNING_BRANDS } from '@/lib/site';
import { createClient } from '@/lib/supabase/server';
import { Band, SectionHeading } from '../ui';

/** Biggest published dyno gain, or null when there is no data (never invent a number). */
async function getBestGain(): Promise<{ hp: number; count: number } | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from('builds').select('before_hp, after_hp').eq('published', true);
    if (!data?.length) return null;
    const gains = data
      .map((build) => (build.after_hp ?? 0) - (build.before_hp ?? 0))
      .filter((gain) => gain > 0);
    if (!gains.length) return null;
    return { hp: Math.max(...gains), count: data.length };
  } catch {
    return null;
  }
}

interface TileProps {
  href: string;
  label: string;
  title: string;
  action: string;
  className?: string;
  children?: React.ReactNode;
}

function Tile({ href, label, title, action, className = '', children }: TileProps) {
  return (
    <Link
      href={href}
      className={`v2-tile group relative flex min-h-[220px] flex-col justify-between overflow-hidden rounded-[28px] p-7 sm:p-8 ${className}`}
    >
      <div className="relative z-10">
        <p className="text-[13px] font-medium opacity-80">{label}</p>
        <h3 className="v2-title mt-1 text-[26px] sm:text-[30px]">{title}</h3>
      </div>
      {children}
      <p className="relative z-10 mt-6 text-[15px] font-medium">
        {action} <span aria-hidden="true">›</span>
      </p>
    </Link>
  );
}

export async function BentoV2() {
  const best = await getBestGain();
  return (
    <Band id="explore" tone="carbon" labelledBy="explore-heading">
      <div className="mx-auto max-w-[1024px] px-4 sm:px-6">
        <Reveal>
          <SectionHeading id="explore-heading" title="Everything for your diesel." line="Parts, planning, proof and a time on the lift." />
        </Reveal>
        <div className="mt-12 grid grid-cols-2 gap-3 sm:mt-16 sm:gap-4 lg:grid-cols-4">
          <Reveal className="col-span-2">
            <Tile href="/store" label="Store" title="Parts, shipped." action="Shop" className="h-full bg-white text-carbon">
              <Image
                src="/images/part-turbo.png"
                alt=""
                width={900}
                height={599}
                sizes="(min-width: 1024px) 480px, 90vw"
                className="pointer-events-none absolute -bottom-6 -right-6 w-[62%] max-w-[360px] transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none"
              />
            </Tile>
          </Reveal>
          <Reveal className="col-span-2" delayMs={60}>
            <Tile href="/builds" label="Builds & dyno" title={best ? 'Real numbers.' : 'Dyno proven.'} action="See the builds" className="h-full bg-gunmetal text-chalk">
              {best && (
                <p className="relative z-10 mt-4 text-[64px] font-semibold leading-none tracking-tight text-clover tabular-nums sm:text-[88px]">
                  +{best.hp}<span className="ml-1 text-[22px] font-medium text-chalk/60 sm:text-[28px]">hp</span>
                </p>
              )}
            </Tile>
          </Reveal>
          <Reveal delayMs={120}>
            <Tile href="/build-planner" label="Build planner" title="Plan it." action="Start" className="h-full bg-carbon-2 text-chalk" />
          </Reveal>
          <Reveal delayMs={160}>
            <Tile href="/gallery" label="Gallery" title="Shop life." action="Look" className="h-full bg-carbon-2 text-chalk" />
          </Reveal>
          <Reveal delayMs={200}>
            <Tile href="/book" label="Book online" title="Pick a time." action="Book" className="h-full bg-clover text-carbon" />
          </Reveal>
          <Reveal delayMs={240}>
            <Tile href="/store/products?category=tuning" label="Tuning" title={TUNING_BRANDS.map((brand) => brand.split(' ')[0]).join('. ') + '.'} action="Tunes" className="h-full bg-carbon-2 text-chalk" />
          </Reveal>
        </div>
      </div>
    </Band>
  );
}

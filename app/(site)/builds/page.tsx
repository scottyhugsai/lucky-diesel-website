import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Reveal } from '@/components/ui/Reveal';
import { BUSINESS } from '@/lib/site';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: `Diesel Builds & Dyno Results | Lucky Diesel ${BUSINESS.city}`,
  description: 'Duramax, Powerstroke and Cummins builds from the shop, with before-and-after dyno numbers and the parts that got them there.',
  alternates: { canonical: '/builds' },
};

export const revalidate = 300;

export default async function BuildsPage() {
  const supabase = await createClient();
  const { data: builds } = await supabase.from('builds').select('*').eq('published', true).order('created_at', { ascending: false });

  return (
    <div className="pb-24 pt-32 sm:pt-40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <p className="kicker">From the shop</p>
        <h1 className="display mt-4 text-[length:var(--text-display)]">Builds &amp; dyno numbers</h1>
        <p className="mt-4 max-w-xl text-lg text-chalk/70">Real trucks, the parts that went on them, and what they made on the dyno before and after.</p>

        <ul className="mt-14 grid gap-6 md:grid-cols-2">
          {(builds ?? []).map((build, index) => {
            const hpGain = build.before_hp && build.after_hp ? build.after_hp - build.before_hp : null;
            const tqGain = build.before_torque && build.after_torque ? build.after_torque - build.before_torque : null;
            return (
              <Reveal as="li" key={build.id} delayMs={index * 80}>
                <Link href={`/builds/${build.slug}`} className="group block overflow-hidden rounded-md border border-line bg-carbon-2 transition-colors hover:border-clover">
                  <div className="relative aspect-[16/10] overflow-hidden bg-chalk">
                    <Image src={build.hero_image} alt={build.title} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
                    {build.is_sample && <span className="absolute left-3 top-3 rounded-sm bg-carbon/85 px-2 py-1 text-xs font-semibold text-steel backdrop-blur">Example build</span>}
                  </div>
                  <div className="flex items-end justify-between gap-4 p-5">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-steel">{build.vehicle_label}</p>
                      <h2 className="display mt-1 text-4xl">{build.title}</h2>
                      <div className="mt-3 flex gap-4 text-sm font-semibold tabular-nums">
                        {hpGain !== null && <span className="text-clover">+{hpGain} HP</span>}
                        {tqGain !== null && <span className="text-clover">+{tqGain} lb-ft</span>}
                      </div>
                    </div>
                    <ArrowUpRight className="size-7 shrink-0 text-clover transition-transform duration-300 group-hover:rotate-45" aria-hidden="true" />
                  </div>
                </Link>
              </Reveal>
            );
          })}
        </ul>
        {!builds?.length && <p className="mt-10 text-steel">Builds are on the way. Follow along on Instagram in the meantime.</p>}
      </div>
    </div>
  );
}

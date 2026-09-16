import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { BUSINESS } from '@/lib/site';
import { createClient } from '@/lib/supabase/server';

interface BuildPageProps {
  params: Promise<{ slug: string }>;
}

export const revalidate = 300;

async function loadBuild(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase.from('builds').select('*').eq('slug', slug).eq('published', true).maybeSingle();
  return data;
}

export async function generateMetadata({ params }: BuildPageProps): Promise<Metadata> {
  const build = await loadBuild((await params).slug);
  if (!build) return {};
  return {
    title: `${build.title} — ${build.vehicle_label} | Lucky Diesel`,
    description: build.summary,
    alternates: { canonical: `/builds/${build.slug}` },
    openGraph: { images: [{ url: build.hero_image }] },
  };
}

function DynoBar({ label, before, after, unit }: { label: string; before: number; after: number; unit: string }) {
  const max = Math.max(before, after);
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="kicker">{label}</p>
        <p className="display text-3xl not-italic text-clover tabular-nums">+{after - before} <span className="text-lg">{unit}</span></p>
      </div>
      <div className="mt-3 grid gap-2">
        {[['Stock', before, 'bg-steel/60'], ['After', after, 'bg-clover']] .map(([name, value, color]) => (
          <div key={String(name)} className="grid grid-cols-[3.5rem_1fr_4rem] items-center gap-3 text-sm">
            <span className="text-steel">{name}</span>
            <span className="h-3 overflow-hidden rounded-full bg-gunmetal">
              <span className={`block h-full rounded-full ${color}`} style={{ width: `${(Number(value) / max) * 100}%` }} />
            </span>
            <span className="text-right font-semibold tabular-nums">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function BuildPage({ params }: BuildPageProps) {
  const build = await loadBuild((await params).slug);
  if (!build) notFound();

  return (
    <article className="pb-24 pt-28 sm:pt-36">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <nav aria-label="Breadcrumb" className="text-sm text-steel">
          <Link href="/builds" className="hover:text-clover">Builds</Link> <span aria-hidden="true">/</span> <span className="text-chalk/80">{build.title}</span>
        </nav>
        <p className="kicker mt-8">{build.vehicle_label}</p>
        <h1 className="display mt-3 text-[length:var(--text-display)]">{build.title}</h1>
        {build.is_sample && <p className="mt-3 text-sm text-steel">Example build shown for the website preview.</p>}

        <div className="mt-10 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-chalk">
            <Image src={build.hero_image} alt={build.title} fill priority sizes="(min-width: 1024px) 60vw, 100vw" className="object-cover" />
          </div>
          <div className="grid content-start gap-8">
            <p className="text-lg leading-relaxed text-chalk/75">{build.story ?? build.summary}</p>
            {build.before_hp && build.after_hp && <DynoBar label="Horsepower" before={build.before_hp} after={build.after_hp} unit="HP" />}
            {build.before_torque && build.after_torque && <DynoBar label="Torque" before={build.before_torque} after={build.after_torque} unit="lb-ft" />}
            {build.parts.length > 0 && (
              <div>
                <p className="kicker">Parts list</p>
                <ul className="mt-3 divide-y divide-line border-y border-line">
                  {build.parts.map((part) => <li key={part} className="py-2.5 text-chalk/85">{part}</li>)}
                </ul>
              </div>
            )}
            <Link href={`/?truck=${build.platform}#quote`} className="btn-go display inline-flex items-center justify-center gap-2 rounded-sm px-6 py-3.5 text-xl not-italic">
              Build mine <ArrowRight className="size-5" aria-hidden="true" />
            </Link>
            <p className="text-sm text-steel">Dyno results vary by truck, fuel, conditions and parts. Ask us what’s realistic for yours: {BUSINESS.phoneDisplay}.</p>
          </div>
        </div>
      </div>
    </article>
  );
}

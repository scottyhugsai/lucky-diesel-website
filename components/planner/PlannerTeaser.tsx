'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '@/components/store/CartProvider';
import { PLATFORMS } from '@/lib/site';
import { GOALS, type GoalId } from './options';
import { SURFACE } from './ui';

const SELECT =
  'h-12 w-full min-w-0 rounded-sm border border-line bg-carbon px-3 text-base text-chalk hover:border-chalk/30 focus:border-clover focus:outline-none [[data-design=v2]_&]:rounded-full [[data-design=v2]_&]:px-4';

/** Quick start for the build planner: truck + goal, then straight into the flow. Placement is up to the page owner. */
export function PlannerTeaser({ className = '' }: { className?: string }) {
  const { truck } = useStore();
  const [picked, setPicked] = useState<string | null>(null);
  const [goal, setGoal] = useState<GoalId | ''>('');

  const savedValue = truck?.generationCollection ? `${truck.platform}|${truck.generationCollection}` : '';
  const truckValue = picked ?? savedValue;
  const [platform, gen] = truckValue.split('|');

  const params = new URLSearchParams();
  if (platform) params.set('platform', platform);
  if (gen) params.set('gen', gen);
  if (goal) params.set('goal', goal);
  params.set('step', !gen ? 'platform' : goal ? 'budget' : 'goal');

  return (
    <section aria-labelledby="planner-teaser" className={`${SURFACE} grid gap-5 p-5 sm:p-7 ${className}`}>
      <div>
        <p className="kicker">Build planner</p>
        <h2 id="planner-teaser" className="display mt-2 text-5xl [[data-design=v2]_&]:text-3xl">Help me build my truck</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="teaser-truck" className="mb-1.5 block text-sm font-semibold text-chalk/85">Truck</label>
          <select id="teaser-truck" value={truckValue} onChange={(e) => setPicked(e.target.value)} className={SELECT}>
            <option value="">Pick your truck</option>
            {PLATFORMS.map((p) => (
              <optgroup key={p.id} label={p.name}>
                {p.generationCollections.map((handle, i) => (
                  <option key={handle} value={`${p.id}|${handle}`}>{p.name} {p.generations[i]}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="teaser-goal" className="mb-1.5 block text-sm font-semibold text-chalk/85">Goal</label>
          <select id="teaser-goal" value={goal} onChange={(e) => setGoal(e.target.value as GoalId | '')} className={SELECT}>
            <option value="">Pick a goal</option>
            {GOALS.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
      </div>
      <Link href={`/build-planner?${params.toString()}`} className="btn-go display inline-flex min-h-13 items-center justify-center gap-2 rounded-sm px-6 text-2xl not-italic sm:justify-self-start [[data-design=v2]_&]:text-lg">
        Plan my build <ArrowRight className="size-5" aria-hidden="true" />
      </Link>
    </section>
  );
}

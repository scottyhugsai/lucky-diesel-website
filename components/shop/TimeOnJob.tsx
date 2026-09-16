import { formatHours, hoursBetween } from '@/app/shop/_lib/time';
import { firstName } from '@/lib/format';

interface TimeOnJobProps {
  entries: { id: string; tech_id: string; started_at: string; ended_at: string | null; tech: { full_name: string } | null }[];
  userId: string;
  now: number;
}

/** Clocked hours on this job, split by tech. Running entries count up to page load. */
export function TimeOnJob({ entries, userId, now }: TimeOnJobProps) {
  const byTech = new Map<string, { name: string; hours: number; running: boolean }>();
  for (const entry of entries) {
    const current = byTech.get(entry.tech_id) ?? { name: entry.tech_id === userId ? 'You' : firstName(entry.tech?.full_name) || 'Tech', hours: 0, running: false };
    byTech.set(entry.tech_id, {
      ...current,
      hours: current.hours + hoursBetween(entry.started_at, entry.ended_at, now),
      running: current.running || !entry.ended_at,
    });
  }
  const total = [...byTech.values()].reduce((sum, tech) => sum + tech.hours, 0);

  return (
    <div className="mt-3 border-t border-line pt-3 lg:mt-4">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-steel">Total on job</span>
        <span className="display text-3xl not-italic tabular-nums">{formatHours(total)}</span>
      </div>
      {byTech.size > 0 && (
        <ul className="mt-2 grid gap-1 text-sm">
          {[...byTech.entries()].map(([techId, tech]) => (
            <li key={techId} className="flex justify-between">
              <span className="text-chalk/75">{tech.name}{tech.running && <span className="ml-1.5 text-xs font-semibold text-clover">● live</span>}</span>
              <span className="font-mono tabular-nums">{formatHours(tech.hours)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

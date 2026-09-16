import { Badge } from '@/components/app/ui';
import type { Tables } from '@/lib/db/database.types';
import { dateOnly } from '@/lib/format';

const DAY = 86_400_000;

function warranty(until: string | null, now = Date.now()) {
  if (!until) return <Badge>No warranty on file</Badge>;
  const end = new Date(`${until}T23:59:59`).getTime();
  if (end < now) return <Badge>Warranty ended {dateOnly(until)}</Badge>;
  if (end - now < 30 * DAY) return <Badge tone="warn">Warranty ends {dateOnly(until)}</Badge>;
  return <Badge tone="good">Warranty to {dateOnly(until)}</Badge>;
}

export function BuildSheet({ groups }: { groups: [string, Tables<'build_items'>[]][] }) {
  return (
    <div className="space-y-5">
      {groups.map(([category, items]) => (
        <div key={category}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-steel">{category}</h3>
          <ul className="divide-y divide-line rounded-md border border-line bg-carbon">
            {items.map((item) => (
              <li key={item.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold">{item.part_name}</p>
                  <p className="text-sm text-steel">
                    {[item.brand, item.installed_at ? `Installed ${dateOnly(item.installed_at)}` : null].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="shrink-0">{warranty(item.warranty_until)}</div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

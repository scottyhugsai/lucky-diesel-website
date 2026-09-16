import Link from 'next/link';
import { PageHeader, StatTile } from '@/components/app/ui';
import { ElapsedTimer } from '@/components/shop/ElapsedTimer';
import { requireRole } from '@/lib/auth';
import { timeOnly } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import { truckName } from '../_lib/labels';
import { addDays, dayHeading, formatHours, hoursBetween, serverNow, shopDateKey, shopMidnight, weekStartKey } from '../_lib/time';

export const metadata = { title: 'My time | Lucky Diesel Shop' };

export default async function TimePage() {
  const viewer = await requireRole('employee', 'admin');
  const now = serverNow();
  const todayKey = shopDateKey(new Date(now));
  const weekStart = weekStartKey(todayKey);
  const supabase = await createClient();

  const { data: entries, error } = await supabase
    .from('time_entries')
    .select('id, work_order_id, started_at, ended_at, work_orders(number, title, vehicles(year, make, model))')
    .eq('tech_id', viewer.userId)
    .gte('started_at', shopMidnight(weekStart).toISOString())
    .lt('started_at', shopMidnight(addDays(weekStart, 7)).toISOString())
    .order('started_at');

  const week = entries ?? [];
  const jobIds = [...new Set(week.map((entry) => entry.work_order_id))];

  const [{ data: allMine }, { data: laborLines }] = jobIds.length
    ? await Promise.all([
        supabase.from('time_entries').select('work_order_id, started_at, ended_at').eq('tech_id', viewer.userId).in('work_order_id', jobIds),
        supabase.from('line_items').select('work_order_id, quantity').eq('kind', 'labor').eq('approval', 'approved').in('work_order_id', jobIds),
      ])
    : [{ data: [] }, { data: [] }];

  const clockedOnJobs = (allMine ?? []).reduce((sum, entry) => sum + hoursBetween(entry.started_at, entry.ended_at, now), 0);
  const billedOnJobs = (laborLines ?? []).reduce((sum, line) => sum + Number(line.quantity), 0);
  const efficiency = clockedOnJobs > 0 ? Math.round((billedOnJobs / clockedOnJobs) * 100) : null;
  const weekHours = week.reduce((sum, entry) => sum + hoursBetween(entry.started_at, entry.ended_at, now), 0);

  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
    .filter((key) => key <= todayKey)
    .reverse()
    .map((key) => {
      const items = week.filter((entry) => shopDateKey(entry.started_at) === key);
      return { key, items, hours: items.reduce((sum, entry) => sum + hoursBetween(entry.started_at, entry.ended_at, now), 0) };
    });

  return (
    <div className="grid gap-8">
      <PageHeader kicker={`Week of ${dayHeading(weekStart).date}`} title="My time" description="Clocked hours by day, and how your billed labor stacks up against the clock." />
      {error && <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 p-4 text-danger">Couldn’t load your time.</p>}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Clocked this week" value={formatHours(weekHours)} hint={`${week.length} entr${week.length === 1 ? 'y' : 'ies'} · ${jobIds.length} job${jobIds.length === 1 ? '' : 's'}`} />
        <StatTile label="Billed labor" value={`${billedOnJobs.toFixed(1)}h`} hint={`vs ${clockedOnJobs.toFixed(1)}h you clocked on those jobs`} />
        <StatTile
          label="Efficiency"
          value={efficiency === null ? '—' : `${efficiency}%`}
          tone={efficiency === null ? 'neutral' : efficiency >= 100 ? 'good' : 'warn'}
          hint="Approved labor hours ÷ your clocked hours"
        />
      </div>

      <section aria-labelledby="days-heading" className="grid gap-5">
        <h2 id="days-heading" className="sr-only">Time by day</h2>
        {days.map((day) => {
          const heading = dayHeading(day.key);
          return (
            <div key={day.key}>
              <div className="mb-2 flex items-baseline justify-between gap-3 border-b border-line pb-2">
                <h3 className="flex items-baseline gap-2">
                  <span className={`display text-2xl not-italic ${day.key === todayKey ? 'text-clover' : ''}`}>{day.key === todayKey ? 'Today' : heading.weekday}</span>
                  <span className="text-sm font-semibold text-steel">{heading.date}</span>
                </h3>
                <span className="font-mono font-semibold tabular-nums">{formatHours(day.hours)}</span>
              </div>
              {day.items.length ? (
                <ul className="grid gap-2">
                  {day.items.map((entry) => (
                    <li key={entry.id}>
                      <Link href={`/shop/jobs/${entry.work_order_id}`} className="grid min-h-14 grid-cols-[1fr_auto] items-center gap-3 rounded-md border border-line bg-carbon-2 px-3 py-2 transition-colors hover:border-clover sm:px-4">
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">WO #{entry.work_orders?.number} · {entry.work_orders?.title}</span>
                          <span className="block truncate text-sm text-steel">
                            {truckName(entry.work_orders?.vehicles)} · {timeOnly(entry.started_at)}–{entry.ended_at ? timeOnly(entry.ended_at) : 'now'}
                          </span>
                        </span>
                        {entry.ended_at ? (
                          <span className="font-mono tabular-nums">{formatHours(hoursBetween(entry.started_at, entry.ended_at, now))}</span>
                        ) : (
                          <ElapsedTimer startedAt={entry.started_at} serverNow={now} className="font-mono font-semibold text-clover" />
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-chalk/40">No time logged.</p>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}

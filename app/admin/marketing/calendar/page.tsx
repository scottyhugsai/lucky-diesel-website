import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MarketingSectionTabs } from '@/components/admin/marketing/core-ui/MarketingNav';
import { Badge, Card, PageHeader } from '@/components/app/ui';
import { requireRole } from '@/lib/auth';
import { dayKey } from '@/lib/marketing/core/analytics-math';
import { loadCalendar } from '@/lib/marketing/core/calendar-data';
import { CALENDAR_KINDS, monthBounds, monthGrid, parseMonth, placeEntries, shiftMonth, type CalendarKind } from '@/lib/marketing/core/marketing-calendar';

export const metadata = { title: 'Calendar | Marketing' };

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const TONE: Record<CalendarKind, 'neutral' | 'info' | 'warn' | 'good' | 'bad' | 'violet'> = {
  campaign: 'info',
  post: 'violet',
  event: 'good',
  offer: 'warn',
  ad: 'bad',
  season: 'neutral',
  plan: 'neutral',
};

function monthLabel(month: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T12:00:00Z`));
}

export default async function MarketingCalendarPage({ searchParams }: { searchParams: Promise<{ month?: string | string[] }> }) {
  await requireRole('admin');
  const raw = (await searchParams).month;
  const today = dayKey(new Date());
  const month = parseMonth(Array.isArray(raw) ? raw[0] : raw, today);
  const { entries, days } = await loadCalendar(month);
  const grid = monthGrid(month);
  const placed = placeEntries(entries, grid.flat());
  const { first, last } = monthBounds(month);
  const totals = days.reduce((t, d) => ({ leads: t.leads + d.leads, bookings: t.bookings + d.bookings }), { leads: 0, bookings: 0 });

  return (
    <>
      <MarketingSectionTabs active="/admin/marketing/calendar" />
      <PageHeader
        kicker="Marketing"
        title="Calendar"
        description="Campaigns, posts, events, offers and ad flights on one grid."
        actions={
          <div className="flex items-center gap-1">
            <Link href={`/admin/marketing/calendar?month=${shiftMonth(month, -1)}`} scroll={false} aria-label="Previous month" className="grid size-9 place-items-center rounded-sm border border-line text-chalk/70 hover:border-clover hover:text-clover">
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Link>
            <span className="min-w-36 text-center text-sm font-semibold">{monthLabel(month)}</span>
            <Link href={`/admin/marketing/calendar?month=${shiftMonth(month, 1)}`} scroll={false} aria-label="Next month" className="grid size-9 place-items-center rounded-sm border border-line text-chalk/70 hover:border-clover hover:text-clover">
              <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        }
      />

      <div className="grid min-w-0 gap-6">
        <Card
          title={monthLabel(month)}
          action={<p className="text-xs text-steel">{totals.leads} leads · {totals.bookings} booked this month</p>}
          padded={false}
          className="min-w-0"
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] table-fixed border-collapse text-sm">
              <caption className="sr-only">Marketing calendar for {monthLabel(month)}</caption>
              <thead>
                <tr>
                  {WEEKDAYS.map((d) => (
                    <th key={d} scope="col" className="border-b border-line px-2 py-2 text-left text-[0.65rem] font-bold uppercase tracking-widest text-steel">{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grid.map((week) => (
                  <tr key={week[0]}>
                    {week.map((day) => {
                      const items = placed.get(day) ?? [];
                      const outside = day < first || day > last;
                      return (
                        <td key={day} className={`h-28 min-w-0 border-b border-r border-line px-1.5 py-1.5 align-top last:border-r-0 ${outside ? 'bg-carbon/40' : ''}`}>
                          <p className={`mb-1 font-mono text-xs tabular-nums ${day === today ? 'font-bold text-clover' : outside ? 'text-steel/60' : 'text-steel'}`}>
                            {Number(day.slice(8))}
                          </p>
                          <ul className="grid gap-1">
                            {items.slice(0, 3).map((entry) => (
                              <li key={entry.id} className="min-w-0">
                                {entry.href ? (
                                  <Link href={entry.href} className="block truncate rounded-sm bg-gunmetal px-1.5 py-0.5 text-xs text-chalk/85 hover:text-clover" title={entry.title}>
                                    <span aria-hidden="true" className={`mr-1 inline-block size-1.5 rounded-full align-middle ${TONE[entry.kind] === 'good' ? 'bg-clover' : TONE[entry.kind] === 'warn' ? 'bg-amber-300' : TONE[entry.kind] === 'bad' ? 'bg-danger' : TONE[entry.kind] === 'violet' ? 'bg-violet' : 'bg-steel'}`} />
                                    {entry.title}
                                  </Link>
                                ) : (
                                  <span className="block truncate rounded-sm bg-gunmetal px-1.5 py-0.5 text-xs text-chalk/70" title={entry.title}>{entry.title}</span>
                                )}
                              </li>
                            ))}
                            {items.length > 3 && <li className="px-1.5 text-xs text-steel">+{items.length - 3} more</li>}
                          </ul>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="What’s on it">
          <ul className="mb-4 flex flex-wrap gap-2">
            {CALENDAR_KINDS.map((k) => <li key={k.value}><Badge tone={TONE[k.value]}>{k.label}</Badge></li>)}
          </ul>
          <ol className="grid gap-2">
            {entries.slice(0, 20).map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center gap-2 border-b border-line pb-2 text-sm last:border-b-0">
                <Badge tone={TONE[entry.kind]}>{entry.kind}</Badge>
                <span className="min-w-0 flex-1 truncate">
                  {entry.href ? <Link href={entry.href} className="font-semibold hover:text-clover">{entry.title}</Link> : <span className="font-semibold">{entry.title}</span>}
                </span>
                <span className="font-mono text-xs tabular-nums text-steel">{entry.start === entry.end ? entry.start : `${entry.start} → ${entry.end}`}</span>
                {entry.status && <span className="text-xs text-steel">{entry.status}</span>}
              </li>
            ))}
            {entries.length === 0 && <li className="text-sm text-steel">Nothing scheduled this month.</li>}
          </ol>
        </Card>
      </div>
    </>
  );
}

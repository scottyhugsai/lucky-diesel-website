/** Pure unified marketing calendar: campaigns, posts, events, offers, ad flights and seasons on one grid. */

export type CalendarKind = 'campaign' | 'post' | 'event' | 'offer' | 'ad' | 'season' | 'plan';

export const CALENDAR_KINDS: readonly { value: CalendarKind; label: string }[] = [
  { value: 'campaign', label: 'Campaigns' },
  { value: 'post', label: 'Posts' },
  { value: 'event', label: 'Events' },
  { value: 'offer', label: 'Offers' },
  { value: 'ad', label: 'Ads' },
  { value: 'season', label: 'Seasons' },
  { value: 'plan', label: 'Plan' },
];

export interface CalendarEntry {
  id: string;
  kind: CalendarKind;
  title: string;
  /** Inclusive YYYY-MM-DD range. */
  start: string;
  end: string;
  href: string | null;
  status?: string | null;
}

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DAY_MS = 86_400_000;

/** `YYYY-MM` from a query param, else the month of `today` (a YYYY-MM-DD key). Years limited to ±5 of today. */
export function parseMonth(raw: unknown, today: string): string {
  const fallback = today.slice(0, 7);
  if (typeof raw !== 'string') return fallback;
  const match = MONTH_RE.exec(raw);
  if (!match) return fallback;
  return Math.abs(Number(match[1]) - Number(today.slice(0, 4))) <= 5 ? raw : fallback;
}

export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthBounds(month: string): { first: string; last: string } {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { first: `${month}-01`, last: `${month}-${String(last).padStart(2, '0')}` };
}

const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

/** Weeks (Sunday first) covering the month; days outside the month are included to fill the grid. */
export function monthGrid(month: string): string[][] {
  const { first, last } = monthBounds(month);
  const start = addDays(first, -new Date(`${first}T12:00:00Z`).getUTCDay());
  const weeks: string[][] = [];
  for (let day = start; day <= last || weeks[weeks.length - 1]?.length !== 7; day = addDays(day, 1)) {
    if (!weeks.length || weeks[weeks.length - 1]!.length === 7) {
      if (day > last) break;
      weeks.push([]);
    }
    weeks[weeks.length - 1]!.push(day);
  }
  return weeks;
}

export function overlaps(entry: Pick<CalendarEntry, 'start' | 'end'>, from: string, to: string): boolean {
  return entry.start <= to && entry.end >= from;
}

/** Entries by day for the given day keys; multi-day entries appear on each day they cover. */
export function placeEntries(entries: readonly CalendarEntry[], days: readonly string[]): Map<string, CalendarEntry[]> {
  const map = new Map<string, CalendarEntry[]>(days.map((d) => [d, []]));
  const order = (e: CalendarEntry) => CALENDAR_KINDS.findIndex((k) => k.value === e.kind);
  for (const day of days) {
    map.set(day, entries.filter((e) => e.start <= day && e.end >= day).sort((a, b) => order(a) - order(b) || a.title.localeCompare(b.title)));
  }
  return map;
}

/** Seasonal windows (month lists) as entries for one year; one entry per run of consecutive months. */
export function seasonEntries(year: number, seasons: readonly { key: string; name: string; months: readonly number[] }[]): CalendarEntry[] {
  return seasons.flatMap((s) => {
    const months = [...new Set(s.months)].filter((m) => m >= 1 && m <= 12).sort((a, b) => a - b);
    const runs: number[][] = [];
    for (const m of months) {
      const open = runs[runs.length - 1];
      if (open && open[open.length - 1] === m - 1) open.push(m);
      else runs.push([m]);
    }
    return runs.map((run) => ({
      id: `season-${s.key}-${year}-${run[0]}`,
      kind: 'season' as const,
      title: s.name,
      start: `${year}-${String(run[0]).padStart(2, '0')}-01`,
      end: new Date(Date.UTC(year, run[run.length - 1]!, 0)).toISOString().slice(0, 10),
      href: '/admin/marketing/campaigns/seasonal',
    }));
  });
}

export interface ChartMarker {
  /** Zero-based day index into the chart's series. */
  index: number;
  /** Day span (≥1). */
  span: number;
  kind: CalendarKind;
  title: string;
}

/** Positions calendar entries over a chart's day series. Entries outside the range are dropped; long ones clip. */
export function chartMarkers(entries: readonly CalendarEntry[], days: readonly string[]): ChartMarker[] {
  if (!days.length) return [];
  const first = days[0]!;
  const last = days[days.length - 1]!;
  return entries
    .filter((e) => overlaps(e, first, last))
    .map((e) => {
      const startIndex = Math.max(0, days.indexOf(e.start < first ? first : e.start));
      const endDay = e.end > last ? last : e.end;
      const endIndex = days.indexOf(endDay);
      return { index: startIndex, span: Math.max(1, (endIndex < 0 ? days.length - 1 : endIndex) - startIndex + 1), kind: e.kind, title: e.title };
    })
    .sort((a, b) => a.index - b.index);
}

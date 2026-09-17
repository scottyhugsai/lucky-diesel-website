/**
 * Pure rules for events & community: dyno slots, reminder timing, the live
 * leaderboard, Event JSON-LD, build-of-the-month months and vote keys.
 */

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

export const DEFAULT_WAIVER =
  'I understand dyno runs carry risk to my vehicle and people nearby. I confirm my truck is street-legal with working emissions equipment, and I release Lucky Diesel from liability for damage during my run except for gross negligence.';

export interface DynoSlot { at: string; label: string; taken: boolean }

/** One truck per slot from start to end. `taken` = ISO times already booked. */
export function dynoSlots(startsAt: string, endsAt: string, slotMinutes: number, taken: readonly string[], timeZone = 'America/New_York'): DynoSlot[] {
  if (!Number.isInteger(slotMinutes) || slotMinutes < 5) return [];
  const takenSet = new Set(taken.map((t) => new Date(t).toISOString()));
  const fmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone });
  const out: DynoSlot[] = [];
  const end = Date.parse(endsAt);
  for (let t = Date.parse(startsAt); t + slotMinutes * 60_000 <= end && out.length < 200; t += slotMinutes * 60_000) {
    const at = new Date(t).toISOString();
    out.push({ at, label: fmt.format(new Date(t)), taken: takenSet.has(at) });
  }
  return out;
}

export type ReminderStage = '7d' | '1d';

/**
 * The daily sweep runs once, so each stage is a window: 7d fires 6–8 days out,
 * 1d fires 0–48h out (the engine dedupes per registration + stage).
 */
export function reminderStage(startsAt: string, now: Date): ReminderStage | null {
  const until = Date.parse(startsAt) - now.getTime();
  if (until <= 0) return null;
  if (until <= 2 * DAY_MS) return '1d';
  if (until >= 6 * DAY_MS && until <= 8 * DAY_MS) return '7d';
  return null;
}

/** Next-day follow-up for people who showed up: from end of event until 3 days later. */
export function isFollowUpDue(endsAt: string, now: Date): boolean {
  const since = now.getTime() - Date.parse(endsAt);
  return since >= 12 * HOUR_MS && since <= 3 * DAY_MS;
}

export interface LeaderboardInput { id: string; fullName: string; platform: string | null; horsepower: number | null; torque: number | null; showName: boolean; verified: boolean; status: string }
export interface LeaderboardRow { rank: number; id: string; name: string; platform: string | null; horsepower: number; torque: number | null }

const PLATFORM_NAME: Record<string, string> = { duramax: 'Duramax', powerstroke: 'Powerstroke', cummins: 'Cummins', other: 'Diesel' };

/** Only checked-in runs the shop verified as compliant; names only when the driver opted in. */
export function buildLeaderboard(regs: readonly LeaderboardInput[]): LeaderboardRow[] {
  return regs
    .filter((r) => r.verified && r.status === 'checked_in' && r.horsepower && r.horsepower > 0)
    .sort((a, b) => (b.horsepower! - a.horsepower!) || ((b.torque ?? 0) - (a.torque ?? 0)))
    .map((r, i) => ({
      rank: i + 1,
      id: r.id,
      name: r.showName ? publicName(r.fullName) : `Truck ${i + 1}`,
      platform: r.platform ? PLATFORM_NAME[r.platform] ?? null : null,
      horsepower: r.horsepower!,
      torque: r.torque,
    }));
}

/** "Jordan Alvarez" → "Jordan A." */
export function publicName(fullName: string): string {
  const [first = '', ...rest] = fullName.trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last[0]!.toUpperCase()}.` : first;
}

export interface EventForSchema { name: string; description: string | null; startsAt: string; endsAt: string; location: string | null; priceCents: number; capacity: number | null; taken: number; registrationOpen: boolean }

export function eventSchema(event: EventForSchema, url: string, business: { name: string; city: string; region: string; siteUrl: string }): Record<string, unknown> {
  const soldOut = event.capacity !== null && event.taken >= event.capacity;
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.name,
    ...(event.description ? { description: event.description } : {}),
    startDate: event.startsAt,
    endDate: event.endsAt,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    url,
    location: { '@type': 'Place', name: event.location ?? business.name, address: { '@type': 'PostalAddress', addressLocality: business.city, addressRegion: business.region, addressCountry: 'US' } },
    organizer: { '@type': 'Organization', name: business.name, url: business.siteUrl },
    offers: {
      '@type': 'Offer', url, price: (event.priceCents / 100).toFixed(2), priceCurrency: 'USD',
      availability: !event.registrationOpen || soldOut ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
    },
  };
}

/** Social post draft for Facebook / Google Business Profile. */
export function eventPostDraft(event: { name: string; startsAt: string; location: string | null; charity: string | null; kind: string }, url: string, timeZone = 'America/New_York'): { title: string; caption: string; gbpSummary: string; hashtags: string[] } {
  const when = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone }).format(new Date(event.startsAt));
  const cause = event.charity ? ` Proceeds and donations go to ${event.charity}.` : '';
  const hook = event.kind === 'dyno_day' ? 'Bring the truck and see what it really makes.' : 'Come hang out with local diesel owners.';
  return {
    title: `Event: ${event.name}`,
    caption: `${event.name} — ${when} at ${event.location ?? 'Lucky Diesel'}. ${hook}${cause} Street-legal, emissions-compliant trucks only. Save a spot: ${url}`,
    gbpSummary: `${event.name}, ${when}. ${hook}${cause} Sign up: ${url}`.slice(0, 1500),
    hashtags: ['diesel', 'dynoday', 'luckydiesel'],
  };
}

/** Shop-local YYYY-MM. */
export function monthKey(at: Date, timeZone = 'America/New_York'): string {
  const [year, month] = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit' }).format(at).split('-');
  return `${year}-${month}`;
}

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y!, (m ?? 1) - 1, 15)));
}

export interface VoteTally { nominationId: string; votes: number }

/** Highest votes wins; ties go to the earliest nomination (stable order given). */
export function leadingNomination(tallies: readonly VoteTally[]): string | null {
  let best: VoteTally | null = null;
  for (const t of tallies) if (!best || t.votes > best.votes) best = t;
  return best && best.votes > 0 ? best.nominationId : null;
}

export const CHARITY_PRESETS: readonly { key: string; label: string; name: string; charity: string; kind: string; description: string }[] = [
  { key: 'toy_drive', label: 'Toy drive', name: 'Toy Drive Dyno Day', charity: 'Toys for Tots', kind: 'dyno_day', description: 'Bring a new, unwrapped toy and make a pull.' },
  { key: 'food_drive', label: 'Food drive', name: 'Canned Food Truck Meet', charity: 'the local food bank', kind: 'meet', description: 'Bring canned food and meet local diesel owners.' },
  { key: 'first_responders', label: 'Responders', name: 'First Responders Truck Day', charity: 'local first responders', kind: 'open_house', description: 'Free checks for first responder trucks. Donations welcome.' },
];

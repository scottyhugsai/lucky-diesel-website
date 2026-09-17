import 'server-only';
import { unstable_cache } from 'next/cache';
import { getAvailableSlots } from '@/lib/domain/appointments';
import { SHOP_TIME_ZONE } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

const SLOT_CACHE_SECONDS = 300;
const SLOT_SCAN_DAYS = 14;

export interface NextSlot {
  /** ISO instant of the slot start. */
  startsAt: string;
  /** Shop-local, e.g. "Tue 9 AM" or "Today 2 PM". */
  label: string;
  /** YYYY-MM-DD in shop time, for /book?date=. */
  date: string;
}

const shopDate = new Intl.DateTimeFormat('en-CA', { timeZone: SHOP_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
const shopWeekday = new Intl.DateTimeFormat('en-US', { timeZone: SHOP_TIME_ZONE, weekday: 'short' });
const shopHour = new Intl.DateTimeFormat('en-US', { timeZone: SHOP_TIME_ZONE, hour: 'numeric' });

function slotLabel(startsAt: Date, today: string): string {
  const day = shopDate.format(startsAt) === today ? 'Today' : shopWeekday.format(startsAt);
  return `${day} ${shopHour.format(startsAt)}`;
}

/** Scans the next two weeks for the first bookable slot. Cached for five minutes. */
export const getNextOpenSlot = unstable_cache(
  async (): Promise<NextSlot | null> => {
    const now = new Date();
    const today = shopDate.format(now);
    for (let offset = 0; offset < SLOT_SCAN_DAYS; offset += 1) {
      const date = shopDate.format(new Date(now.getTime() + offset * 86_400_000));
      try {
        const [first] = await getAvailableSlots(date);
        if (first) return { startsAt: first.startsAt.toISOString(), label: slotLabel(first.startsAt, today), date };
      } catch {
        return null; // No database in this environment: CTAs fall back to plain "Book".
      }
    }
    return null;
  },
  ['v3-next-open-slot'],
  { revalidate: SLOT_CACHE_SECONDS },
);

export interface DynoBuild {
  slug: string;
  title: string;
  vehicleLabel: string;
  platform: string;
  heroImage: string;
  beforeHp: number | null;
  afterHp: number | null;
  beforeTorque: number | null;
  afterTorque: number | null;
  hpGain: number | null;
  torqueGain: number | null;
  isSample: boolean;
}

export interface BuildStats {
  builds: DynoBuild[];
  /** Ranked by HP gained, highest first. */
  leaderboard: DynoBuild[];
  trucks: number;
  avgHpGain: number | null;
  topTorque: number | null;
  /** True when every counted build is a shop example, so the UI can say so. */
  allSamples: boolean;
}

/** Published builds with their dyno deltas. One query, shared by hero, proof strip and leaderboard. */
export async function getBuildStats(): Promise<BuildStats> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('builds')
    .select('slug,title,vehicle_label,platform,hero_image,before_hp,after_hp,before_torque,after_torque,is_sample')
    .eq('published', true)
    .order('created_at', { ascending: false });

  const builds: DynoBuild[] = (data ?? []).map((row) => ({
    slug: row.slug,
    title: row.title,
    vehicleLabel: row.vehicle_label,
    platform: row.platform,
    heroImage: row.hero_image,
    beforeHp: row.before_hp,
    afterHp: row.after_hp,
    beforeTorque: row.before_torque,
    afterTorque: row.after_torque,
    hpGain: row.before_hp !== null && row.after_hp !== null ? row.after_hp - row.before_hp : null,
    torqueGain: row.before_torque !== null && row.after_torque !== null ? row.after_torque - row.before_torque : null,
    isSample: row.is_sample,
  }));

  const withHp = builds.filter((b): b is DynoBuild & { hpGain: number } => b.hpGain !== null);
  const leaderboard = [...withHp].sort((a, b) => b.hpGain - a.hpGain);
  const torques = builds.map((b) => b.afterTorque).filter((t): t is number => t !== null);

  return {
    builds,
    leaderboard,
    trucks: builds.length,
    avgHpGain: withHp.length ? Math.round(withHp.reduce((sum, b) => sum + b.hpGain, 0) / withHp.length) : null,
    topTorque: torques.length ? Math.max(...torques) : null,
    allSamples: builds.length > 0 && builds.every((b) => b.isSample),
  };
}

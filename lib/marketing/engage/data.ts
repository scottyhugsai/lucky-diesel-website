import 'server-only';
import { unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Db } from '@/lib/marketing/core/settings';
import {
  abBucket, isLive, parseAnnouncement, parsePriceRanges, parseVariants, socialProofMessage,
  type AbVariant, type Announcement, type PopupRule, type PriceRange,
} from './rules';

const DAY_MS = 86_400_000;
const REVALIDATE_SECONDS = 60;
export const ENGAGE_CACHE_TAG = 'site-engagement';

export interface PublicAbTest { id: string; slot: string; variants: AbVariant[] }
export interface PublicTrackingNumber { phone: string; source: string }

export interface PublicEngagement {
  announcement: Announcement | null;
  popups: PopupRule[];
  abTests: PublicAbTest[];
  socialProof: string | null;
  financingUrl: string | null;
  priceRanges: PriceRange[];
  trackingNumbers: PublicTrackingNumber[];
}

export const EMPTY_ENGAGEMENT: PublicEngagement = {
  announcement: null, popups: [], abTests: [], socialProof: null, financingUrl: null, priceRanges: [], trackingNumbers: [],
};

async function countSocialProof(db: Db, now: Date): Promise<string | null> {
  const since = new Date(now.getTime() - 7 * DAY_MS).toISOString();
  const [{ count: dyno }, { count: jobs }] = await Promise.all([
    db.from('dyno_runs').select('id', { count: 'exact', head: true }).gte('run_at', since).lte('run_at', now.toISOString()),
    db.from('work_orders').select('id', { count: 'exact', head: true }).gte('completed_at', since).lte('completed_at', now.toISOString()),
  ]);
  return socialProofMessage({ dynoRuns: dyno ?? 0, finishedJobs: jobs ?? 0 });
}

async function load(db: Db = createAdminClient(), now = new Date()): Promise<PublicEngagement> {
  const [{ data: settings }, { data: popups }, { data: tests }, { data: numbers }] = await Promise.all([
    db.from('site_engagement').select('*').eq('id', 1).maybeSingle(),
    db.from('site_popups').select('*').eq('active', true).limit(50),
    db.from('ab_tests').select('id, slot, variants').eq('active', true).limit(20),
    db.from('tracking_numbers').select('phone, source').eq('active', true).limit(50),
  ]);
  const announcement = parseAnnouncement(settings?.announcement);
  return {
    announcement: announcement && isLive(announcement, now) ? announcement : null,
    popups: (popups ?? []).map((p) => ({
      id: p.id, pathPrefix: p.path_prefix, trigger: p.trigger === 'scroll' ? 'scroll' : 'time', triggerValue: p.trigger_value,
      headline: p.headline, body: p.body, ctaLabel: p.cta_label, ctaHref: p.cta_href, startsAt: p.starts_at, endsAt: p.ends_at,
    } satisfies PopupRule)),
    abTests: (tests ?? []).flatMap((t) => {
      const variants = parseVariants(t.variants);
      return variants.length ? [{ id: t.id, slot: t.slot, variants }] : [];
    }),
    socialProof: settings?.social_proof ? await countSocialProof(db, now) : null,
    financingUrl: settings?.financing_url ?? null,
    priceRanges: parsePriceRanges(settings?.price_ranges),
    trackingNumbers: numbers ?? [],
  };
}

/** Site-wide engagement config, cached for a minute (admin saves revalidate the tag). */
export const getPublicEngagement = unstable_cache(async (): Promise<PublicEngagement> => {
  try {
    return await load();
  } catch (error) {
    console.error(`[engage] config load failed: ${error instanceof Error ? error.message : String(error)}`);
    return EMPTY_ENGAGEMENT;
  }
}, ['site-engagement-public'], { revalidate: REVALIDATE_SECONDS, tags: [ENGAGE_CACHE_TAG] });

export interface AbAssignment { testId: string; variant: string; text: string }

/** Server-side bucket for a slot, keyed on the anonymous attribution id. */
export function assignSlot(tests: readonly PublicAbTest[], slot: string, visitorId: string | null): AbAssignment | null {
  if (!visitorId) return null;
  const test = tests.find((t) => t.slot === slot);
  if (!test) return null;
  const variant = test.variants[abBucket(visitorId, test.id, test.variants.length)]!;
  return { testId: test.id, variant: variant.key, text: variant.text };
}

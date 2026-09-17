import { SEASONS } from './copy-library';
import type { AdGoal, AdPlatform, BuildRef, OfferRef, ProductRef, SeasonKey, SocialPlatform } from './types';

/**
 * The auto-campaign planner: turns what actually happened in the shop this
 * week into a proposed ad + social plan. Pure and deterministic; the service
 * turns accepted items into drafts in the approval queue.
 */

export type PlanSubject =
  | { kind: 'build'; buildId: string }
  | { kind: 'dyno'; dynoRunId: string }
  | { kind: 'product'; handle: string }
  | { kind: 'offer'; landingSlug: string }
  | { kind: 'season'; season: SeasonKey };

export interface PlanItem {
  type: 'ad' | 'social';
  title: string;
  reason: string;
  subject: PlanSubject;
  platform: AdPlatform | SocialPlatform;
  goal: AdGoal;
  priority: number;
  extraFacts?: Record<string, string>;
}

export interface PlannerInputs {
  now: Date;
  /** Published builds, newest first, with their publish/creation time. */
  builds: (BuildRef & { createdAt: string })[];
  /** Non-baseline dyno runs from the last two weeks, newest first. */
  dynoRuns: (BuildRef & { runAt: string })[];
  products: ProductRef[];
  offers: OfferRef[];
  openSlotsThisWeek: number;
  liveCampaigns: number;
  /** Subjects already drafted, e.g. "build:<id>", so the plan doesn't repeat itself. */
  alreadyDrafted: ReadonlySet<string>;
}

export interface WeeklyPlan {
  items: PlanItem[];
  notes: string[];
  season: SeasonKey | null;
}

const MAX_ADS = 3;
const MAX_SOCIAL = 5;
const RECENT_DAYS = 14;
const LOW_CAPACITY = 2;
const HIGH_CAPACITY = 6;

export function seasonFor(now: Date): SeasonKey | null {
  const month = Number(new Intl.DateTimeFormat('en-US', { month: 'numeric', timeZone: 'America/New_York' }).format(now));
  const order: SeasonKey[] = ['hurricane_prep', 'tow_season', 'winter_ready', 'spring_tune', 'holiday', 'dyno_day'];
  return order.find((key) => SEASONS[key].months.includes(month)) ?? null;
}

function key(subject: PlanSubject): string {
  switch (subject.kind) {
    case 'build': return `build:${subject.buildId}`;
    case 'dyno': return `dyno:${subject.dynoRunId}`;
    case 'product': return `product:${subject.handle}`;
    case 'offer': return `offer:${subject.landingSlug}`;
    case 'season': return `season:${subject.season}`;
  }
}

export function planWeek(inputs: PlannerInputs): WeeklyPlan {
  const notes: string[] = [];
  const items: PlanItem[] = [];
  const recentCutoff = inputs.now.getTime() - RECENT_DAYS * 86_400_000;
  const season = seasonFor(inputs.now);
  const lowCapacity = inputs.openSlotsThisWeek <= LOW_CAPACITY;
  const add = (item: PlanItem) => {
    if (!inputs.alreadyDrafted.has(`${item.type}:${key(item.subject)}`)) items.push(item);
  };

  if (lowCapacity) notes.push(`Only ${inputs.openSlotsThisWeek} open bays this week: the plan holds back paid ads that drive bookings.`);
  if (inputs.openSlotsThisWeek >= HIGH_CAPACITY) notes.push(`${inputs.openSlotsThisWeek} open bays this week: worth a bookings push.`);

  for (const build of inputs.builds.filter((b) => Date.parse(b.createdAt) >= recentCutoff).slice(0, 2)) {
    add({ type: 'social', title: `Post the new build: ${build.title}`, reason: 'New published build in the last two weeks.', subject: { kind: 'build', buildId: build.id }, platform: 'instagram', goal: 'awareness', priority: 1 });
    if (build.beforeHp && build.afterHp && !lowCapacity) {
      add({ type: 'ad', title: `Dyno proof ad: ${build.title}`, reason: `Real numbers (${build.beforeHp} → ${build.afterHp} hp) make strong proof.`, subject: { kind: 'build', buildId: build.id }, platform: 'meta', goal: 'leads', priority: 2 });
    }
  }
  for (const run of inputs.dynoRuns.slice(0, 2)) {
    add({ type: 'social', title: `Dyno card: ${run.vehicleLabel}`, reason: 'Logged dyno pull with a baseline to compare.', subject: { kind: 'dyno', dynoRunId: run.id }, platform: 'instagram', goal: 'awareness', priority: 2 });
  }
  for (const offer of inputs.offers.filter((o) => o.landingSlug).slice(0, 1)) {
    if (!lowCapacity) add({ type: 'ad', title: `Offer ad: ${offer.headline}`, reason: `Active offer${offer.endsAt ? ` ending ${offer.endsAt.slice(0, 10)}` : ''}.`, subject: { kind: 'offer', landingSlug: offer.landingSlug! }, platform: 'meta', goal: 'leads', priority: 1 });
  }
  if (season) {
    const s = SEASONS[season];
    if (!lowCapacity) {
      add({ type: 'ad', title: `${s.name} ad`, reason: `${s.name} is in season for the Lowcountry.`, subject: { kind: 'season', season }, platform: inputs.openSlotsThisWeek >= HIGH_CAPACITY ? 'google_pmax' : 'meta', goal: 'bookings', priority: 3, extraFacts: { openSlots: String(inputs.openSlotsThisWeek) } });
    }
    add({ type: 'social', title: `${s.name} reminder post`, reason: 'Seasonal calendar.', subject: { kind: 'season', season }, platform: 'facebook', goal: 'awareness', priority: 4 });
  }
  const product = inputs.products.find((p) => !p.offRoadOnly);
  if (product) {
    add({ type: 'social', title: `Product spotlight: ${product.title}`, reason: 'Top store product with a real price.', subject: { kind: 'product', handle: product.handle }, platform: 'instagram', goal: 'sales', priority: 5 });
    if (lowCapacity) add({ type: 'ad', title: `Parts ad: ${product.title}`, reason: 'Bays are full, so push parts sales instead of bookings.', subject: { kind: 'product', handle: product.handle }, platform: 'meta', goal: 'sales', priority: 2 });
  }
  if (inputs.liveCampaigns >= MAX_ADS) notes.push(`${inputs.liveCampaigns} campaigns are already live; new ads will wait for owner review.`);

  const sorted = [...items].sort((a, b) => a.priority - b.priority);
  const ads = sorted.filter((i) => i.type === 'ad').slice(0, MAX_ADS);
  const social = sorted.filter((i) => i.type === 'social').slice(0, MAX_SOCIAL);
  if (!ads.length && !social.length) notes.push('Nothing new to promote this week. Log a dyno run or publish a build to feed the plan.');
  return { items: [...ads, ...social], notes, season };
}

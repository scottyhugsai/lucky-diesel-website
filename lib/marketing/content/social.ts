import { DEFAULT_VOICE, LOCAL_HASHTAGS, PLATFORM_HASHTAGS, PLATFORM_NAMES, SOCIAL_LIMITS, fitText } from './brand';
import { checkContent } from './compliance';
import type { PillarKey } from './calendar';
import type { BuildRef, ClaimIssue, ComplianceStatus, ImageTemplate, PlatformId, ProductRef, SocialPlatform } from './types';

/** Organic post drafting from real shop data. Pure: the service layer stores and schedules. */

export interface SocialDraft {
  title: string;
  caption: string;
  alternates: string[];
  hashtags: string[];
  gbpSummary: string;
  tiktokCaption: string;
  imageTemplate: ImageTemplate;
  imageParams: Record<string, string | number | boolean | null>;
  platforms: SocialPlatform[];
  pillar: PillarKey | null;
  complianceStatus: ComplianceStatus;
  complianceIssues: ClaimIssue[];
  /** Owner photos may show plates, VINs or faces. */
  needsPrivacyReview: boolean;
  privacyNote: string | null;
}

export const PRIVACY_NOTE = 'Owner photo: blur license plates, VINs and faces (unless a media release is on file) before posting.';

export const TIPS: readonly { title: string; body: string }[] = [
  { title: 'Drain your water separator', body: 'Water in diesel fuel wrecks injectors. If the water-in-fuel light comes on, drain the separator and change filters on schedule.' },
  { title: 'Warm it up before you work it', body: 'Give a cold diesel a few minutes of easy driving before heavy towing. Oil and turbo bearings will thank you.' },
  { title: 'Watch transmission temps when towing', body: 'Use tow/haul mode on grades and keep an eye on trans temp. Heat is what kills transmissions.' },
  { title: 'Test batteries before winter', body: 'Diesels need big cranking power. A load test takes minutes and beats a no-start on a cold morning.' },
  { title: 'Change fuel filters on time', body: 'Fuel filters are the cheapest injector insurance you can buy. Follow the interval for your engine.' },
  { title: 'Scan codes before buying parts', body: 'A check engine light has a reason. Scan it and diagnose before throwing parts at the truck.' },
];

export function hashtagsFor(platform: string | null, extra: readonly string[] = [], limit = 12): string[] {
  const platformTags = PLATFORM_HASHTAGS[platform as PlatformId] ?? [];
  return [...new Set([...DEFAULT_VOICE.hashtags, ...platformTags, ...extra, ...LOCAL_HASHTAGS])].slice(0, limit);
}

function finalize(draft: Omit<SocialDraft, 'complianceStatus' | 'complianceIssues'>): SocialDraft {
  const report = checkContent([draft.title, draft.caption, draft.gbpSummary, draft.tiktokCaption, ...draft.alternates]);
  return {
    ...draft,
    caption: fitText(draft.caption, SOCIAL_LIMITS.instagram.caption),
    gbpSummary: fitText(draft.gbpSummary, SOCIAL_LIMITS.gbp.caption),
    hashtags: draft.hashtags.slice(0, SOCIAL_LIMITS.instagram.hashtags),
    complianceStatus: report.status,
    complianceIssues: report.issues,
  };
}

function gains(build: BuildRef): string | null {
  const parts: string[] = [];
  if (build.beforeHp && build.afterHp) parts.push(`${build.beforeHp} → ${build.afterHp} hp`);
  if (build.beforeTorque && build.afterTorque) parts.push(`${build.beforeTorque} → ${build.afterTorque} lb-ft`);
  return parts.length ? parts.join(' and ') : null;
}

/** New published build or logged dyno run → caption variants, dyno card, hashtags and a GBP post. */
export function draftBuildPost(build: BuildRef, kind: 'build' | 'dyno', url: string): SocialDraft {
  const name = PLATFORM_NAMES[build.platform as PlatformId] ?? 'diesel';
  const numbers = gains(build);
  const partsLine = build.parts.length ? `Work: ${build.parts.slice(0, 4).join(', ')}.` : '';
  const numbersLine = numbers ? `On our dyno: ${numbers}. Results vary by truck, fuel and conditions.` : '';
  const title = kind === 'dyno' ? `Fresh dyno pull: ${build.vehicleLabel}` : `New build: ${build.title}`;
  const caption = [kind === 'dyno' ? `Fresh off the dyno: ${build.vehicleLabel}.` : `${build.title} on the ${build.vehicleLabel}.`, numbersLine, partsLine, `Want yours next? Book at ${url}`].filter(Boolean).join('\n\n');
  const alternates = [
    [`${name} owners, this one’s for you.`, numbersLine || `${build.title}, done right in our Charleston shop.`, `Details: ${url}`].filter(Boolean).join('\n\n'),
    [`Parts, install and a real dyno sheet, all under one roof.`, `${build.vehicleLabel}${numbers ? `: ${numbers}` : ''}.`, 'Results vary.'].join(' '),
  ];
  const hasPhoto = Boolean(build.image);
  return finalize({
    title,
    caption,
    alternates,
    hashtags: hashtagsFor(build.platform, ['#DynoDay', '#DieselPerformance']),
    gbpSummary: `${title}. ${numbersLine} Diesel-only shop in Charleston for Duramax, Powerstroke and Cummins. Book online.`.replace(/\s+/g, ' ').trim(),
    tiktokCaption: fitText(`${title} ${numbers ? `(${numbers})` : ''} #LuckyDiesel #${name}`, 150),
    imageTemplate: numbers ? (hasPhoto && kind === 'build' ? 'before_after' : 'dyno') : 'photo',
    imageParams: { truck: build.vehicleLabel, title: build.title, buildId: build.id, image: build.image, beforeHp: build.beforeHp, afterHp: build.afterHp, beforeTq: build.beforeTorque, afterTq: build.afterTorque },
    platforms: ['instagram', 'facebook', 'gbp', 'tiktok'],
    pillar: null,
    needsPrivacyReview: hasPhoto && !build.isSample,
    privacyNote: hasPhoto && !build.isSample ? PRIVACY_NOTE : null,
  });
}

export function draftTipPost(index: number, url: string): SocialDraft {
  const tip = TIPS[((index % TIPS.length) + TIPS.length) % TIPS.length]!;
  return finalize({
    title: `Tip Tuesday: ${tip.title}`,
    caption: `Tip Tuesday: ${tip.title.toLowerCase()}.\n\n${tip.body}\n\nQuestions about your truck? ${url}`,
    alternates: [`${tip.body} More tips every Tuesday.`],
    hashtags: hashtagsFor(null, ['#TipTuesday', '#DieselMaintenance']),
    gbpSummary: `${tip.title}. ${tip.body}`,
    tiktokCaption: fitText(`Tip Tuesday: ${tip.title} #TipTuesday #LuckyDiesel`, 150),
    imageTemplate: 'photo',
    imageParams: { truck: 'Tip Tuesday', title: tip.title, image: '/images/part-injectors.png' },
    platforms: ['instagram', 'facebook', 'gbp'],
    pillar: 'tip_tuesday',
    needsPrivacyReview: false,
    privacyNote: null,
  });
}

export function draftProductPost(product: ProductRef, url: string): SocialDraft {
  const price = product.priceFromCents > 0 ? `$${Math.round(product.priceFromCents / 100).toLocaleString('en-US')}` : null;
  return finalize({
    title: `Product spotlight: ${product.title}`,
    caption: `Product spotlight: ${product.title} from ${product.vendor}.${price ? ` From ${price}, parts only.` : ''}\n\nBuy it in the store, or let us install it so it’s done once: ${url}`,
    alternates: [`${product.vendor} parts we install every week. ${product.title}${price ? `, from ${price}` : ''}.`],
    hashtags: hashtagsFor(product.platforms.length === 1 ? product.platforms[0]! : null, ['#DieselParts']),
    gbpSummary: `${product.title} from ${product.vendor}${price ? `, from ${price} parts only` : ''}. Supplied and installed at our Charleston shop.`,
    tiktokCaption: fitText(`${product.title} ${price ? `from ${price}` : ''} #LuckyDiesel`, 150),
    imageTemplate: 'product',
    imageParams: { product: product.title, vendor: product.vendor, price, image: product.image, handle: product.handle },
    platforms: ['instagram', 'facebook'],
    pillar: 'product_spotlight',
    needsPrivacyReview: false,
    privacyNote: null,
  });
}

// ─── Links, recycling, community and shot lists ────────────────────────────

/** Adds social UTMs so clicks and bookings trace back to the post. Leaves other params alone. */
export function withSocialUtm(url: string, platform: SocialPlatform, postId: string): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set('utm_source', platform);
    parsed.searchParams.set('utm_medium', 'social');
    parsed.searchParams.set('utm_campaign', 'organic');
    parsed.searchParams.set('utm_content', postId);
    return parsed.toString();
  } catch {
    return url;
  }
}

export interface RecycleCandidate {
  id: string;
  sourceType: string;
  publishedAt: string | null;
  clicks: number;
  complianceStatus: string;
  needsPrivacyReview: boolean;
  lastRecycledAt: string | null;
}

export const EVERGREEN = { minAgeDays: 90, cooldownDays: 90, sourceTypes: ['pillar', 'build', 'product'] } as const;

/** Old posts worth another run: evergreen source, clean, not recycled lately. Most clicked first. */
export function pickEvergreen(posts: readonly RecycleCandidate[], now: Date, limit = 2): RecycleCandidate[] {
  const day = 86_400_000;
  return posts
    .filter((p) => p.publishedAt && now.getTime() - Date.parse(p.publishedAt) >= EVERGREEN.minAgeDays * day)
    .filter((p) => (EVERGREEN.sourceTypes as readonly string[]).includes(p.sourceType) && p.complianceStatus === 'pass' && !p.needsPrivacyReview)
    .filter((p) => !p.lastRecycledAt || now.getTime() - Date.parse(p.lastRecycledAt) >= EVERGREEN.cooldownDays * day)
    .sort((a, b) => b.clicks - a.clicks || Date.parse(a.publishedAt!) - Date.parse(b.publishedAt!))
    .slice(0, limit);
}

export interface CommunityTask {
  key: string;
  label: string;
}

/** Weekly engagement habits. Real conversations, never fake reviews or paid likes. */
export const COMMUNITY_TASKS: readonly CommunityTask[] = [
  { key: 'reply_comments', label: 'Reply to every comment and DM' },
  { key: 'local_groups', label: 'Answer a question in a local truck group' },
  { key: 'tag_partners', label: 'Share a local business or event post' },
  { key: 'customer_shoutout', label: 'Thank a customer (with a release)' },
  { key: 'story_shop', label: 'Post a shop-floor story' },
];

/** ISO week period key, e.g. 2026-W38. */
export function weekPeriod(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function monthPeriod(date: Date): string {
  return date.toISOString().slice(0, 7);
}

/** Nextdoor has no posting API: a monthly copy-and-paste business post. */
export function nextdoorPost(month: number, url: string): string {
  const topics = [
    'Winter mornings are hard on diesels. We load-test batteries and glow plugs while you wait.',
    'Planning a spring trip with the camper? We do tow-ready checks: brakes, cooling, trans fluid.',
    'Water in diesel fuel wrecks injectors. Ask us about fuel filter service before summer.',
    'Hurricane season: a fuel filter, battery and coolant check now beats a no-start later.',
    'Check engine light on your truck? We scan and diagnose before replacing any parts.',
    'Towing this fall? Transmission temps and brakes are worth a look first.',
  ];
  return `Neighbors: Lucky Diesel is a diesel-only shop in Charleston for Duramax, Powerstroke and Cummins. ${topics[(month - 1) % topics.length]} Book online: ${url}`;
}

export interface Shot {
  key: string;
  label: string;
  needsRelease: boolean;
}

const SHOTS: readonly { match: RegExp; shots: Shot[] }[] = [
  { match: /tune|dyno|program|calibrat/i, shots: [{ key: 'dyno_pull', label: 'Dyno pull video (10–20 s)', needsRelease: false }, { key: 'dyno_sheet', label: 'Dyno sheet on the screen', needsRelease: false }] },
  { match: /turbo|intake|exhaust|intercooler/i, shots: [{ key: 'old_part', label: 'Old part next to the new one', needsRelease: false }, { key: 'installed', label: 'Installed, engine bay wide', needsRelease: false }] },
  { match: /injector|fuel|lift pump|cp4|cp3/i, shots: [{ key: 'injectors', label: 'Injectors or pump on the bench', needsRelease: false }, { key: 'filter', label: 'Dirty filter or water sample', needsRelease: false }] },
  { match: /lift|level|wheel|tire|suspension/i, shots: [{ key: 'stance_before', label: 'Side view before (same angle after)', needsRelease: true }, { key: 'stance_after', label: 'Side view after', needsRelease: true }] },
  { match: /trans|allison|10r|68rfe|aisin/i, shots: [{ key: 'trans_bench', label: 'Trans or parts on the bench', needsRelease: false }] },
];

const ALWAYS: readonly Shot[] = [
  { key: 'arrival', label: 'Truck arriving, front three-quarter', needsRelease: true },
  { key: 'work', label: 'Tech hands at work (no faces)', needsRelease: false },
  { key: 'finished', label: 'Finished truck outside the bay', needsRelease: true },
];

/** Shot list for a job, from its title and line items. Shots showing the truck need consent. */
export function shotListFor(texts: readonly (string | null | undefined)[]): Shot[] {
  const haystack = texts.filter(Boolean).join(' ');
  const extra = SHOTS.filter((s) => s.match.test(haystack)).flatMap((s) => s.shots);
  const seen = new Set<string>();
  return [ALWAYS[0]!, ...extra, ...ALWAYS.slice(1)].filter((s) => (seen.has(s.key) ? false : (seen.add(s.key), true)));
}

export interface UgcInput {
  name: string;
  handle: string | null;
  truck: string | null;
  caption: string | null;
  creditOk: boolean;
}

/** Customer photo → post draft. Credit only with permission; always a privacy check. */
export function draftUgcPost(input: UgcInput, url: string): SocialDraft {
  const credit = input.creditOk ? (input.handle ? `@${input.handle.replace(/^@/, '')}` : input.name.split(' ')[0]) : null;
  const truck = input.truck ?? 'customer truck';
  const title = `Customer truck: ${truck}`;
  const quote = input.caption ? `“${input.caption.slice(0, 200)}”` : null;
  return finalize({
    title,
    caption: [`Customer truck: ${truck}.`, quote, credit ? `📸 ${credit}` : null, `Want yours featured? Share it at ${url}`].filter(Boolean).join('\n\n'),
    alternates: [],
    hashtags: hashtagsFor(null, ['#CustomerTruck']),
    gbpSummary: `${title}. Diesel-only shop in Charleston. Book online.`,
    tiktokCaption: fitText(`${title} #LuckyDiesel`, 150),
    imageTemplate: 'photo',
    imageParams: { truck: 'Customer truck', title: truck, imageSource: 'ugc', needsPrivacyReview: true },
    platforms: ['instagram', 'facebook'],
    pillar: null,
    needsPrivacyReview: true,
    privacyNote: PRIVACY_NOTE,
  });
}

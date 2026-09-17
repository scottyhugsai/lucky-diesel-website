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

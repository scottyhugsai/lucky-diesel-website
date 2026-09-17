import { PLATFORM_NAMES, SHOP_FACTS } from './brand';
import type { CreativeSubject, ImageTemplate, PlatformId, SeasonKey } from './types';

/** Facts the templates may reference. Missing facts disable the templates that need them. */
export type Facts = Record<string, string>;

export interface Angle {
  id: string;
  headlines: readonly string[];
  longHeadlines: readonly string[];
  primaries: readonly string[];
  descriptions: readonly string[];
  /** Angle-specific openers; falls back to HOOKS. */
  hooks?: readonly string[];
}

export interface SeasonInfo {
  name: string;
  headline: string;
  pitch: string;
  service: string;
  months: readonly number[];
}

export const SEASONS: Record<SeasonKey, SeasonInfo> = {
  tow_season: { name: 'Tow season', headline: 'Tow-ready before the trip', pitch: 'Boats, campers and goosenecks come out in spring. Get the cooling, brakes and fuel system checked before the first long pull.', service: 'tow-ready inspection', months: [3, 4, 5, 6] },
  hurricane_prep: { name: 'Hurricane prep', headline: 'Storm-season ready', pitch: 'When the Lowcountry evacuates, your truck is the plan. Fuel filters, batteries and cooling checked before the season peaks.', service: 'storm-prep check', months: [6, 7, 8, 9] },
  winter_ready: { name: 'Winter ready', headline: 'Cold starts, no drama', pitch: 'Glow plugs, batteries and fuel gelling don’t wait for a warning. A quick check now beats a tow later.', service: 'cold-start check', months: [11, 12, 1] },
  spring_tune: { name: 'Spring service', headline: 'Spring service for hard-working trucks', pitch: 'Fluids, filters and a full scan after a winter of short trips. Keep a working truck working.', service: 'spring service', months: [2, 3, 4] },
  dyno_day: { name: 'Dyno day', headline: 'See what your truck really makes', pitch: 'Bring your truck, strap it down and get a real dyno sheet. Compare notes with other diesel owners.', service: 'dyno pull', months: [4, 5, 9, 10] },
  holiday: { name: 'Holiday parts', headline: 'Parts they actually want', pitch: 'Turbos, injectors and gear from the brands we install every week. We can fit it after the holidays too.', service: 'parts install', months: [11, 12] },
};

function money(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString('en-US')}`;
}

function platformName(platform: string): string {
  return PLATFORM_NAMES[platform as PlatformId] ?? 'diesel';
}

/** Turns a creative subject into the facts templates can use. Only real data goes in. */
export function subjectFacts(subject: CreativeSubject, extra: Facts = {}): Facts {
  const facts: Facts = { city: SHOP_FACTS.city, shop: SHOP_FACTS.name, phone: SHOP_FACTS.phone, ...extra };
  switch (subject.kind) {
    case 'product': {
      const p = subject.product;
      facts.product = p.title;
      facts.vendor = p.vendor;
      facts.category = p.category;
      if (p.priceFromCents > 0) facts.price = money(p.priceFromCents);
      if (p.platforms.length === 1 && p.platforms[0]) facts.platformName = platformName(p.platforms[0]);
      break;
    }
    case 'build':
    case 'dyno': {
      const b = subject.build;
      facts.truck = b.vehicleLabel;
      facts.buildTitle = b.title;
      facts.platformName = platformName(b.platform);
      if (b.afterHp) facts.afterHp = String(b.afterHp);
      if (b.afterTorque) facts.afterTq = String(b.afterTorque);
      if (b.beforeHp && b.afterHp && b.afterHp > b.beforeHp) facts.hpGain = String(b.afterHp - b.beforeHp);
      if (b.beforeTorque && b.afterTorque && b.afterTorque > b.beforeTorque) facts.tqGain = String(b.afterTorque - b.beforeTorque);
      if (b.parts[0]) facts.topPart = b.parts[0];
      break;
    }
    case 'offer': {
      const o = subject.offer;
      facts.offer = o.headline;
      facts.value = o.valueLabel;
      if (o.terms) facts.terms = o.terms;
      if (o.endsAt) facts.ends = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' }).format(new Date(o.endsAt));
      break;
    }
    case 'season': {
      const s = SEASONS[subject.season];
      facts.season = s.name;
      facts.seasonHeadline = s.headline;
      facts.seasonPitch = s.pitch;
      facts.service = s.service;
      break;
    }
    case 'review': {
      const r = subject.review;
      const quote = r.body.replace(/\s+/g, ' ').trim();
      facts.quote = quote.length > 90 ? `${quote.slice(0, quote.lastIndexOf(' ', 87))}…` : quote;
      facts.author = r.author.split(' ')[0] ?? r.author;
      facts.stars = '★★★★★'.slice(0, r.rating);
      break;
    }
  }
  return facts;
}

export const HOOKS: readonly string[] = [
  'Heads up, {platformName} owners.',
  'Your truck works hard.',
  'Diesel-only, all day.',
  'Made for working trucks.',
];

export const ANGLES: Record<string, Angle> = {
  proof: {
    id: 'proof',
    headlines: ['{afterHp} HP on our dyno', '{afterTq} lb-ft, measured', '{truck}: real dyno sheet'],
    longHeadlines: ['This {truck} made {afterHp} hp and {afterTq} lb-ft on our dyno'],
    primaries: ['This {truck} left with {afterHp} hp and {afterTq} lb-ft on a real dyno sheet. Results vary by truck.', '{hpGain} more horsepower on the {truck}, measured on our dyno. Results vary.'],
    descriptions: ['Real dyno numbers', 'Results vary by truck'],
    hooks: ['Real numbers, not promises.', 'Fresh off the dyno.'],
  },
  build: {
    id: 'build',
    headlines: ['{buildTitle}', 'The {truck} build', 'Built right in {city}'],
    longHeadlines: ['{buildTitle}: parts, install and dyno sheet from one shop'],
    primaries: ['{buildTitle}: {topPart} and more, installed and checked in our {city} shop.', 'Parts, install and a dyno check on this {truck}. Want yours next?'],
    descriptions: ['Parts and install, one shop', 'See the full build'],
  },
  towing: {
    id: 'towing',
    headlines: ['Tow heavy, stay cool', 'Set up to pull', 'Tow-ready {platformName}'],
    longHeadlines: ['Pulling a camper or a gooseneck? Get your {platformName} set up to tow'],
    primaries: ['Pulling a camper or a gooseneck? We set up diesel trucks to tow cool and steady. {city} shop.', 'Heavy trailer this season? Get cooling, fuel and transmission checked first.'],
    descriptions: ['Tow-ready checks', 'Cooling, fuel, transmission'],
  },
  reliability: {
    id: 'reliability',
    headlines: ['Find the real fault first', 'Fixed once, fixed right', 'Diesel diagnostics in {city}'],
    longHeadlines: ['We find the real fault before a single part gets thrown at it'],
    primaries: ['We find the real fault before a single part gets thrown at it. Diesel-only shop in {city}.', 'Check engine light? Get a real diagnosis from techs who only work on diesels.'],
    descriptions: ['Diesel-only diagnostics', 'Duramax, Powerstroke, Cummins'],
    hooks: ['No guesswork, just the fix.', 'Your truck works hard.'],
  },
  local: {
    id: 'local',
    headlines: ['{city}’s diesel-only shop', 'Duramax. Powerstroke. Cummins.', 'Local diesel techs'],
    longHeadlines: ['Duramax, Powerstroke and Cummins: parts, installs and diagnostics in {city}'],
    primaries: ['Duramax, Powerstroke and Cummins. Parts, installs and diagnostics under one roof in {city}.'],
    descriptions: ['Serving the Lowcountry', 'Call {phone}'],
  },
  product: {
    id: 'product',
    headlines: ['{product}', '{vendor} parts, installed', '{category} from {price}'],
    longHeadlines: ['{product} from {price}, supplied and installed by our techs'],
    primaries: ['{product} from {price}. Buy the part, or let us install it so it’s done once.', '{vendor} {category} we install every week. From {price}, parts only.'],
    descriptions: ['From {price}, parts only', 'Supplied and installed'],
  },
  offer: {
    id: 'offer',
    headlines: ['{offer}', '{value}, ends {ends}', '{value} this month'],
    longHeadlines: ['{offer}: {value} at our {city} shop, ends {ends}'],
    primaries: ['{offer}: {value}. {terms}', '{value} on {offer}. Claim it before {ends}.'],
    descriptions: ['Ends {ends}', 'Limited bays'],
    hooks: ['Good timing.', 'For a limited time.'],
  },
  season: {
    id: 'season',
    headlines: ['{seasonHeadline}', '{season} check', 'Book your {service}'],
    longHeadlines: ['{seasonHeadline}: book a {service} at our {city} shop'],
    primaries: ['{seasonPitch}', '{season} is here. Book a {service} in {city} before the rush.'],
    descriptions: ['{season} special', 'Book a {service}'],
  },
  review: {
    id: 'review',
    headlines: ['“{quote}”', 'What {author} said', '{stars} from {author}'],
    longHeadlines: ['“{quote}” — {author}'],
    primaries: ['“{quote}” — {author}. Find out why diesel owners trust our {city} shop.'],
    hooks: [''],
    descriptions: ['Real customer review', '{stars}'],
  },
  capacity: {
    id: 'capacity',
    headlines: ['{openSlots} open bays this week', 'Get in this week'],
    longHeadlines: ['{openSlots} open bays this week at our {city} diesel shop'],
    primaries: ['{openSlots} open bays this week in {city}. Tell us about your truck and we’ll get you in.'],
    descriptions: ['Open bays this week'],
  },
};

export const ANGLES_BY_SUBJECT: Record<CreativeSubject['kind'], readonly string[]> = {
  product: ['product', 'reliability', 'local', 'capacity'],
  build: ['build', 'proof', 'towing', 'local'],
  dyno: ['proof', 'build', 'local', 'capacity'],
  offer: ['offer', 'capacity', 'local', 'reliability'],
  season: ['season', 'towing', 'reliability', 'capacity'],
  review: ['review', 'local', 'reliability'],
};

export function templateForSubject(subject: CreativeSubject): ImageTemplate {
  switch (subject.kind) {
    case 'product': return 'product';
    case 'dyno': return 'dyno';
    case 'build': return subject.build.image && subject.build.beforeHp && subject.build.afterHp ? 'before_after' : subject.build.image ? 'photo' : 'dyno';
    case 'offer': return 'offer';
    case 'season': return 'seasonal';
    case 'review': return 'review';
  }
}

const PLACEHOLDER = /\{([a-zA-Z]+)\}/g;

/** Fills a template, or returns null when any fact it needs is missing. */
export function fill(template: string, facts: Facts): string | null {
  let missing = false;
  const out = template.replace(PLACEHOLDER, (_m, key: string) => {
    const value = facts[key];
    if (value === undefined || value === '') missing = true;
    return value ?? '';
  });
  return missing ? null : out.replace(/\s+/g, ' ').trim();
}

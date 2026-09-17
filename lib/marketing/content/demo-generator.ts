import { AD_LIMITS, CTA_BY_GOAL, fitText } from './brand';
import { checkContent } from './compliance';
import { ANGLES, ANGLES_BY_SUBJECT, HOOKS, fill, subjectFacts, templateForSubject, type Angle, type Facts } from './copy-library';
import type { AdFormat, CreativeBrief, CreativeSubject, VariantDraft } from './types';

const DEFAULT_COUNT = 4;
const MAX_COUNT = 8;
const SHOP_FALLBACK = 'Diesel work done right';

/** FNV-1a string hash → 32-bit seed. */
export function hashSeed(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Small deterministic PRNG (mulberry32). */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function subjectKey(subject: CreativeSubject): string {
  switch (subject.kind) {
    case 'product': return `product:${subject.product.handle}`;
    case 'build':
    case 'dyno': return `${subject.kind}:${subject.build.id}`;
    case 'offer': return `offer:${subject.offer.code ?? subject.offer.headline}`;
    case 'season': return `season:${subject.season}`;
    case 'review': return `review:${subject.review.id}`;
  }
}

/**
 * Picks the first template (from a seeded offset) whose facts are all present,
 * preferring one that fits `max` so copy is never cut mid-phrase.
 */
function pick(templates: readonly string[], facts: Facts, offset: number, max = Infinity): string | null {
  let firstFilled: string | null = null;
  for (let i = 0; i < templates.length; i += 1) {
    const filled = fill(templates[(offset + i) % templates.length]!, facts);
    if (!filled) continue;
    if (filled.length <= max) return filled;
    firstFilled ??= filled;
  }
  return firstFilled;
}

/** Hook + body if it fits, else body alone, else whole sentences, else a word-boundary trim. */
function fitPrimary(hook: string, body: string, max: number): string {
  const withHook = hook ? `${hook} ${body}` : body;
  if (withHook.length <= max) return withHook;
  if (body.length <= max) return body;
  const sentences = body.match(/[^.!?]+[.!?]+/g) ?? [];
  let out = '';
  for (const sentence of sentences) {
    const next = `${out} ${sentence.trim()}`.trim();
    if (next.length > max) break;
    out = next;
  }
  return out || fitText(body, max);
}

function usableAngles(subject: CreativeSubject, facts: Facts): Angle[] {
  return (ANGLES_BY_SUBJECT[subject.kind] ?? [])
    .map((id) => ANGLES[id])
    .filter((angle): angle is Angle => Boolean(angle))
    .filter((angle) => pick(angle.headlines, facts, 0) && pick(angle.primaries, facts, 0));
}

function imageParams(subject: CreativeSubject, facts: Facts): Record<string, string | number | null> {
  const base = { headline: null as string | null, city: facts.city ?? null };
  switch (subject.kind) {
    case 'product':
      return { ...base, product: subject.product.title, vendor: subject.product.vendor, price: facts.price ?? null, image: subject.product.image, handle: subject.product.handle };
    case 'build':
    case 'dyno':
      return {
        ...base, truck: subject.build.vehicleLabel, title: subject.build.title, buildId: subject.build.id, image: subject.build.image,
        beforeHp: subject.build.beforeHp, afterHp: subject.build.afterHp, beforeTq: subject.build.beforeTorque, afterTq: subject.build.afterTorque,
      };
    case 'offer':
      return { ...base, offer: subject.offer.headline, value: subject.offer.valueLabel, code: subject.offer.code, ends: facts.ends ?? null, terms: subject.offer.terms };
    case 'season':
      return { ...base, season: subject.season, title: facts.seasonHeadline ?? null, service: facts.service ?? null };
    case 'review':
      return { ...base, reviewId: subject.review.id, quote: facts.quote ?? null, author: facts.author ?? null, rating: subject.review.rating, source: subject.review.source === 'manual' ? 'customer' : subject.review.source };
  }
}

/**
 * The demo generator: deterministic, on-brand ad copy assembled from templates
 * and real shop data. Every variant is compliance-checked; risky ones are kept
 * but marked `block` so the owner sees why they can't be approved.
 */
export function generateDemoVariants(brief: CreativeBrief, extraFacts: Facts = {}): VariantDraft[] {
  const count = Math.min(Math.max(brief.count ?? DEFAULT_COUNT, 1), MAX_COUNT);
  const limits = AD_LIMITS[brief.platform];
  const facts = subjectFacts(brief.subject, extraFacts);
  const random = seededRandom(hashSeed(`${brief.seed ?? ''}|${brief.platform}|${brief.goal}|${subjectKey(brief.subject)}`));
  const angles = usableAngles(brief.subject, facts);
  if (!angles.length) return [];

  const angleStart = Math.floor(random() * angles.length);
  const hookStart = Math.floor(random() * HOOKS.length);
  const ctas = CTA_BY_GOAL[brief.goal].filter((cta) => limits.ctas.includes(cta));
  const ctaPool = ctas.length ? ctas : limits.ctas;
  const format: AdFormat = brief.format ?? (brief.platform === 'tiktok' ? '9:16' : brief.platform === 'google_pmax' ? '1.91:1' : '1:1');
  const template = templateForSubject(brief.subject);
  const params = imageParams(brief.subject, facts);

  const variants: VariantDraft[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = angles[(angleStart + i) % angles.length]!;
    const round = Math.floor(i / angles.length);
    const hook = pick(angle.hooks ?? HOOKS, facts, hookStart + i) ?? '';
    const headline = fitText(pick(angle.headlines, facts, round + i, limits.headline) ?? SHOP_FALLBACK, limits.headline);
    const primaryText = fitPrimary(hook, pick(angle.primaries, facts, round + i, limits.primary) ?? '', limits.primary);
    const longHeadline = limits.longHeadline ? fitText(pick(angle.longHeadlines, facts, round, limits.longHeadline) ?? headline, limits.longHeadline) : null;
    const description = limits.description ? fitText(pick(angle.descriptions, facts, round + i, limits.description) ?? '', limits.description) || null : null;
    const cta = ctaPool[i % ctaPool.length]!;

    const report = checkContent([headline, longHeadline, primaryText, description]);
    const issues = [...report.issues];
    if (brief.subject.kind === 'product' && brief.subject.product.offRoadOnly) {
      issues.push({ term: 'off-road-only SKU', reason: 'This product is listed off-road only and can’t be advertised.', severity: 'block' });
    }
    const status = issues.some((x) => x.severity === 'block') ? 'block' : issues.length ? 'warn' : 'pass';

    variants.push({
      label: `V${i + 1} · ${angle.id}`,
      hook: hook || angle.id,
      angle: angle.id,
      headline,
      longHeadline,
      primaryText,
      description,
      cta,
      format,
      imageTemplate: template,
      imageParams: { ...params, headline },
      complianceStatus: status,
      complianceIssues: issues,
      generator: 'demo',
    });
  }
  return variants;
}

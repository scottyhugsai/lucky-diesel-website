import { OTHER_SERVICE, SERVICES } from '@/lib/site';

/**
 * Landing pages are stored as a JSON list of blocks. Everything read from the
 * database is validated here before rendering, so a bad row can't inject
 * markup, scripts or `javascript:` links into a public page.
 */

export interface HeroBlock { type: 'hero'; kicker: string | null; headline: string; subhead: string | null; image: string | null; ctaLabel: string | null }
export interface OfferBlock { type: 'offer'; headline: string; valueLabel: string; terms: string | null; code: string | null; endsAt: string | null }
export interface ProofBlock { type: 'proof'; heading: string; source: 'builds' | 'reviews'; limit: number }
export interface BulletsBlock { type: 'bullets'; heading: string; items: string[] }
export interface FormBlock { type: 'form'; heading: string; service: string; offerTag: string; submitLabel: string }
export interface FaqBlock { type: 'faq'; heading: string; items: { q: string; a: string }[] }
export interface CtaBlock { type: 'cta'; headline: string; label: string; href: string }

export type LandingBlock = HeroBlock | OfferBlock | ProofBlock | BulletsBlock | FormBlock | FaqBlock | CtaBlock;
export type BlocksResult = { ok: true; blocks: LandingBlock[] } | { ok: false; errors: string[] };

const MAX_BLOCKS = 20;
const TAG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:\d{2})?)?$/;

type Source = Record<string, unknown>;

function str(source: Source, key: string, max: number, errors: string[], where: string, required = true): string | null {
  const value = source[key];
  if (value === undefined || value === null || value === '') {
    if (required) errors.push(`${where}: ${key} is required`);
    return null;
  }
  if (typeof value !== 'string') {
    errors.push(`${where}: ${key} must be text`);
    return null;
  }
  const clean = value.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
  if (clean.length > max) errors.push(`${where}: ${key} is longer than ${max} characters`);
  return clean.slice(0, max);
}

/** Same-site paths, anchors, phone/sms links and https only. */
export function isSafeHref(href: string): boolean {
  return /^(\/(?!\/)[^\s]*|#[a-z0-9-]+|tel:\+?[\d-]+|sms:\+?[\d-]+|https:\/\/[^\s]+)$/i.test(href);
}

function isSafeImage(src: string): boolean {
  return /^(\/images\/[\w./-]+|https:\/\/[^\s"'<>]+)$/i.test(src);
}

function parseBlock(raw: unknown, index: number, errors: string[]): LandingBlock | null {
  const where = `block ${index + 1}`;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    errors.push(`${where}: not an object`);
    return null;
  }
  const b = raw as Source;
  const e = errors.length;
  switch (b.type) {
    case 'hero': {
      const image = str(b, 'image', 500, errors, where, false);
      if (image && !isSafeImage(image)) errors.push(`${where}: image must be a site image or https URL`);
      const block: HeroBlock = { type: 'hero', kicker: str(b, 'kicker', 40, errors, where, false), headline: str(b, 'headline', 80, errors, where) ?? '', subhead: str(b, 'subhead', 240, errors, where, false), image, ctaLabel: str(b, 'ctaLabel', 30, errors, where, false) };
      return errors.length === e ? block : null;
    }
    case 'offer': {
      const endsAt = str(b, 'endsAt', 40, errors, where, false);
      if (endsAt && !ISO_DATE.test(endsAt)) errors.push(`${where}: endsAt must be an ISO date`);
      const code = str(b, 'code', 32, errors, where, false);
      if (code && !/^[A-Z0-9-]{3,32}$/.test(code)) errors.push(`${where}: code must be 3–32 capital letters, digits or dashes`);
      const block: OfferBlock = { type: 'offer', headline: str(b, 'headline', 80, errors, where) ?? '', valueLabel: str(b, 'valueLabel', 40, errors, where) ?? '', terms: str(b, 'terms', 400, errors, where, false), code, endsAt };
      return errors.length === e ? block : null;
    }
    case 'proof': {
      const source = b.source === 'reviews' ? 'reviews' : b.source === 'builds' ? 'builds' : null;
      if (!source) errors.push(`${where}: source must be builds or reviews`);
      const limit = typeof b.limit === 'number' && Number.isInteger(b.limit) ? Math.min(Math.max(b.limit, 1), 6) : 3;
      const block: ProofBlock = { type: 'proof', heading: str(b, 'heading', 80, errors, where) ?? '', source: source ?? 'builds', limit };
      return errors.length === e ? block : null;
    }
    case 'bullets': {
      const items = Array.isArray(b.items) ? b.items.filter((i): i is string => typeof i === 'string').map((i) => i.replace(/[<>]/g, '').trim()).filter(Boolean) : [];
      if (items.length < 1 || items.length > 8) errors.push(`${where}: bullets need 1–8 items`);
      if (items.some((i) => i.length > 160)) errors.push(`${where}: bullet items are limited to 160 characters`);
      const block: BulletsBlock = { type: 'bullets', heading: str(b, 'heading', 80, errors, where) ?? '', items };
      return errors.length === e ? block : null;
    }
    case 'form': {
      const service = str(b, 'service', 40, errors, where) ?? '';
      if (service && service !== OTHER_SERVICE && !SERVICES.some((s) => s.id === service)) errors.push(`${where}: unknown service "${service}"`);
      const offerTag = str(b, 'offerTag', 60, errors, where) ?? '';
      if (offerTag && !TAG.test(offerTag)) errors.push(`${where}: offerTag must be lowercase-with-dashes`);
      const block: FormBlock = { type: 'form', heading: str(b, 'heading', 80, errors, where) ?? '', service, offerTag, submitLabel: str(b, 'submitLabel', 30, errors, where, false) ?? 'Claim it' };
      return errors.length === e ? block : null;
    }
    case 'faq': {
      const items = Array.isArray(b.items)
        ? b.items.flatMap((i) => (typeof i === 'object' && i && typeof (i as Source).q === 'string' && typeof (i as Source).a === 'string' ? [{ q: String((i as Source).q).replace(/[<>]/g, '').trim(), a: String((i as Source).a).replace(/[<>]/g, '').trim() }] : []))
        : [];
      if (items.length < 1 || items.length > 10) errors.push(`${where}: FAQ needs 1–10 questions`);
      const block: FaqBlock = { type: 'faq', heading: str(b, 'heading', 80, errors, where) ?? '', items };
      return errors.length === e ? block : null;
    }
    case 'cta': {
      const href = str(b, 'href', 300, errors, where) ?? '';
      if (href && !isSafeHref(href)) errors.push(`${where}: link must be a site path, anchor, tel:, sms: or https URL`);
      const block: CtaBlock = { type: 'cta', headline: str(b, 'headline', 80, errors, where) ?? '', label: str(b, 'label', 30, errors, where) ?? '', href };
      return errors.length === e ? block : null;
    }
    default:
      errors.push(`${where}: unknown block type "${String(b.type)}"`);
      return null;
  }
}

export function validateBlocks(input: unknown): BlocksResult {
  if (!Array.isArray(input)) return { ok: false, errors: ['blocks must be a list'] };
  const errors: string[] = [];
  if (input.length === 0) errors.push('a landing page needs at least one block');
  if (input.length > MAX_BLOCKS) errors.push(`a landing page can have at most ${MAX_BLOCKS} blocks`);
  const blocks = input.slice(0, MAX_BLOCKS).map((raw, i) => parseBlock(raw, i, errors)).filter((b): b is LandingBlock => b !== null);
  if (blocks.length && blocks[0]?.type !== 'hero') errors.push('the first block must be a hero');
  if (blocks.filter((b) => b.type === 'form').length > 1) errors.push('only one form per page');
  if (blocks.length && !blocks.some((b) => b.type === 'form' || b.type === 'cta')) errors.push('a landing page needs a form or a call to action');
  return errors.length ? { ok: false, errors } : { ok: true, blocks };
}

/** All visible text on a page, for the compliance check. */
export function blocksText(blocks: readonly LandingBlock[]): string[] {
  return blocks.flatMap((b) => {
    switch (b.type) {
      case 'hero': return [b.kicker, b.headline, b.subhead, b.ctaLabel].filter((x): x is string => Boolean(x));
      case 'offer': return [b.headline, b.valueLabel, b.terms ?? ''];
      case 'proof': return [b.heading];
      case 'bullets': return [b.heading, ...b.items];
      case 'form': return [b.heading, b.submitLabel];
      case 'faq': return [b.heading, ...b.items.flatMap((i) => [i.q, i.a])];
      case 'cta': return [b.headline, b.label];
    }
  });
}

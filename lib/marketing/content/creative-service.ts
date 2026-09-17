import 'server-only';
import { getProduct } from '@/lib/store/catalog';
import { siteUrl } from '@/lib/site-url';
import { generateAdVariants } from './ai';
import { submitForApproval } from './approvals-service';
import { SEASONS } from './copy-library';
import { PUBLIC_REVIEW_SOURCES } from './reputation';
import { hashSeed } from './demo-generator';
import { generateAiBackground, pickOwnerPhoto, type ChosenImage } from './photos';
import { adminDb, buildToRef, dynoRunToRef, fail, loadVoice, recordGeneration, toJson, type Db, type Result } from './db';
import type { AdFormat, AdGoal, AdPlatform, CreativeSubject, OfferRef, SeasonKey } from './types';

export type SubjectInput =
  | { kind: 'product'; handle: string }
  | { kind: 'build'; buildId: string }
  | { kind: 'dyno'; dynoRunId: string }
  | { kind: 'offer'; landingSlug: string }
  | { kind: 'season'; season: SeasonKey }
  | { kind: 'review'; reviewId: string };

export interface GenerateCreativeInput {
  goal: AdGoal;
  platform: AdPlatform;
  subject: SubjectInput;
  format?: AdFormat;
  audience?: string;
  count?: number;
  campaignId?: string | null;
  name?: string;
  requestedBy: string | null;
  /** Queue for owner approval straight away (default true). */
  submit?: boolean;
  isSample?: boolean;
  /** Extra real facts for copy, e.g. { openSlots: '6' } from the bay schedule. */
  extraFacts?: Record<string, string>;
}


export function offerFromLanding(page: { slug: string; offer: unknown }): OfferRef | null {
  const offer = page.offer;
  if (typeof offer !== 'object' || offer === null) return null;
  const o = offer as Record<string, unknown>;
  if (typeof o.headline !== 'string' || typeof o.valueLabel !== 'string') return null;
  return {
    code: typeof o.code === 'string' ? o.code : null,
    headline: o.headline,
    valueLabel: o.valueLabel,
    terms: typeof o.terms === 'string' ? o.terms : '',
    endsAt: typeof o.endsAt === 'string' ? o.endsAt : null,
    landingSlug: page.slug,
  };
}

/** Loads real shop data for a creative subject. Returns an error string when it can't be used. */
export async function resolveSubject(db: Db, input: SubjectInput): Promise<{ subject: CreativeSubject; landingPath: string; ref: string } | { error: string }> {
  switch (input.kind) {
    case 'product': {
      const product = await getProduct(input.handle);
      if (!product) return { error: 'Product not found in the store.' };
      return {
        subject: { kind: 'product', product: { handle: product.handle, title: product.title, vendor: product.vendor, category: product.category, priceFromCents: product.priceMinCents, image: product.images[0]?.src ?? null, platforms: product.platforms, offRoadOnly: product.offRoadOnly } },
        landingPath: `/store/products/${product.handle}`,
        ref: product.handle,
      };
    }
    case 'build': {
      const { data } = await db.from('builds').select('*').eq('id', input.buildId).eq('published', true).maybeSingle();
      if (!data) return { error: 'Only published builds can be advertised.' };
      return { subject: { kind: 'build', build: buildToRef(data) }, landingPath: `/builds/${data.slug}`, ref: data.id };
    }
    case 'dyno': {
      const build = await dynoRunToRef(db, input.dynoRunId);
      if (!build?.afterHp) return { error: 'Dyno run not found or has no horsepower recorded.' };
      return { subject: { kind: 'dyno', build }, landingPath: '/builds', ref: build.id };
    }
    case 'offer': {
      const { data } = await db.from('landing_pages').select('slug, offer, published').eq('slug', input.landingSlug).maybeSingle();
      const offer = data ? offerFromLanding(data) : null;
      if (!data || !offer) return { error: 'Landing page has no offer.' };
      return { subject: { kind: 'offer', offer }, landingPath: `/l/${data.slug}`, ref: data.slug };
    }
    case 'season':
      if (!(input.season in SEASONS)) return { error: 'Unknown season.' };
      return { subject: { kind: 'season', season: input.season }, landingPath: '/book', ref: input.season };
    case 'review': {
      const { data } = await db.from('reviews').select('*').eq('id', input.reviewId).in('source', [...PUBLIC_REVIEW_SOURCES]).gte('rating', 4).maybeSingle();
      if (!data?.body) return { error: 'Only real 4–5 star reviews with text can be used in ads.' };
      return { subject: { kind: 'review', review: { id: data.id, author: data.author_name, rating: data.rating, body: data.body, source: data.source } }, landingPath: '/', ref: data.id };
    }
  }
}

const UTM_SOURCE: Record<AdPlatform, [string, string]> = {
  meta: ['facebook', 'paid_social'], google_pmax: ['google', 'cpc'], google_search: ['google', 'cpc'], tiktok: ['tiktok', 'paid_social'],
};

export function landingUrl(path: string, platform: AdPlatform, campaign: string, content: string): string {
  const url = new URL(path, siteUrl());
  const [source, medium] = UTM_SOURCE[platform];
  url.searchParams.set('utm_source', source);
  url.searchParams.set('utm_medium', medium);
  url.searchParams.set('utm_campaign', campaign);
  url.searchParams.set('utm_content', content);
  return url.toString();
}

/**
 * Generates N ad variants for a subject, stores them with compliance results
 * and image-template params, and (by default) queues the creative for owner
 * approval. Nothing is published here.
 */
export async function generateAdCreative(input: GenerateCreativeInput, db: Db = adminDb()): Promise<Result<{ creativeId: string; approvalId: string | null; variants: number; blocked: number; generator: 'demo' | 'ai' }>> {
  try {
    const resolved = await resolveSubject(db, input.subject);
    if ('error' in resolved) return { ok: false, error: resolved.error };
    const voice = await loadVoice(db);
    const brief = { goal: input.goal, platform: input.platform, subject: resolved.subject, audience: input.audience, format: input.format, count: input.count, seed: `${Date.now()}` };
    const { variants, meta } = await generateAdVariants(brief, voice, input.extraFacts);
    if (!variants.length) return { ok: false, error: 'Not enough real data to write this ad.' };

    const first = variants[0]!;
    let background: ChosenImage | null = null;
    if (!first.imageParams.image && ['offer', 'seasonal', 'review'].includes(first.imageTemplate)) {
      background = (await pickOwnerPhoto(db, first.imageTemplate, hashSeed(resolved.ref)))
        ?? (await generateAiBackground(db, `Photo of a clean diesel pickup truck at a Lowcountry South Carolina repair shop, ${input.subject.kind === 'season' ? SEASONS[input.subject.season].name : 'golden hour'}, cinematic, dark tones`, first.format, input.requestedBy));
    }

    const jobId = await recordGeneration(db, { kind: 'ad_copy', input: { ...brief, subject: input.subject }, output: variants, meta, requestedBy: input.requestedBy });
    const name = input.name ?? `${input.subject.kind} · ${resolved.ref} · ${input.platform}`;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

    const { data: creative, error } = await db.from('ad_creatives').insert({
      name, goal: input.goal, platform: input.platform, subject_kind: input.subject.kind, subject_ref: resolved.ref, audience: input.audience ?? null,
      campaign_id: input.campaignId ?? null, generator: meta.generator, ai_generation_id: jobId, is_sample: input.isSample ?? false, created_by: input.requestedBy,
      landing_url: landingUrl(resolved.landingPath, input.platform, slug, 'creative'),
    }).select('id').single();
    if (error || !creative) return { ok: false, error: error?.message ?? 'Could not save creative.' };

    const { error: variantError } = await db.from('ad_creative_variants').insert(variants.map((v) => ({
      creative_id: creative.id, label: v.label, hook: v.hook, angle: v.angle, headline: v.headline, long_headline: v.longHeadline, primary_text: v.primaryText,
      description: v.description, cta: v.cta, format: v.format, image_template: v.imageTemplate, image_params: toJson(background ? { ...v.imageParams, image: background.url, imageSource: background.source, needsPrivacyReview: background.needsPrivacyReview } : v.imageParams),
      image_asset_id: background?.assetId ?? null,
      compliance_status: v.complianceStatus, compliance_issues: toJson(v.complianceIssues), generator: v.generator,
    })));
    if (variantError) return { ok: false, error: variantError.message };

    const blocked = variants.filter((v) => v.complianceStatus === 'block').length;
    let approvalId: string | null = null;
    if (input.submit !== false && blocked < variants.length) {
      const queued = await submitForApproval('ad_creative', creative.id, input.requestedBy, db);
      if (!queued.ok) return queued;
      approvalId = queued.data.approvalId;
    }
    return { ok: true, data: { creativeId: creative.id, approvalId, variants: variants.length, blocked, generator: meta.generator } };
  } catch (error) {
    return fail(error);
  }
}

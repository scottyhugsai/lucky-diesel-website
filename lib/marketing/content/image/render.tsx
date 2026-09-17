import 'server-only';
import { ImageResponse } from 'next/og';
import { PUBLIC_REVIEW_SOURCES } from '../reputation';
import type { Db } from '../db';
import { FORMAT_SIZE, IMAGE_TEMPLATES, isAdFormat, type AdFormat, type ImageTemplate } from '../types';
import { loadFonts, loadLogo, loadPhoto } from './assets';
import { canvasFor } from './frame';
import { AdImage, type ImageParams } from './templates';

export interface ImageSpec {
  template: ImageTemplate;
  format: AdFormat;
  params: ImageParams;
  headline: string;
  cta: string;
  /** Corner label such as SAMPLE, DRAFT or BLOCKED. */
  label: string | null;
  /** Public (approved) images may be cached by CDNs; previews may not. */
  isPublic: boolean;
}

export { isAdFormat };

export function isImageTemplate(value: unknown): value is ImageTemplate {
  return typeof value === 'string' && (IMAGE_TEMPLATES as readonly string[]).includes(value);
}

function asParams(value: unknown): ImageParams {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v === null || ['string', 'number', 'boolean'].includes(typeof v))) as ImageParams;
}

const PUBLIC_CREATIVE = ['approved', 'scheduled', 'live', 'paused', 'completed'];
const PUBLIC_POST = ['approved', 'scheduled', 'published'];

export type SpecLookup = { spec: ImageSpec; requiresStaff: boolean } | null;

/** Finds what to draw for an id: an ad variant, an ad creative (first usable variant) or a social post. */
export async function lookupImageSpec(db: Db, id: string, variantId: string | null, format: AdFormat | null): Promise<SpecLookup> {
  let variant = (await db.from('ad_creative_variants').select('*, ad_creatives(status, is_sample)').eq('id', id).maybeSingle()).data;
  if (!variant) {
    const query = db.from('ad_creative_variants').select('*, ad_creatives(status, is_sample)').eq('creative_id', id).order('compliance_status').order('label');
    const { data } = variantId ? await query.eq('id', variantId).limit(1) : await query.neq('compliance_status', 'block').limit(1);
    variant = data?.[0] ?? null;
  }
  if (variant && isImageTemplate(variant.image_template)) {
    const creative = variant.ad_creatives;
    const blocked = variant.compliance_status === 'block';
    const approved = Boolean(creative && PUBLIC_CREATIVE.includes(creative.status)) && !blocked;
    return {
      requiresStaff: !approved,
      spec: {
        template: variant.image_template, format: format ?? (isAdFormat(variant.format) ? variant.format : '1:1'), params: asParams(variant.image_params),
        headline: variant.headline, cta: variant.cta, isPublic: approved,
        label: blocked ? 'Blocked' : creative?.is_sample ? 'Sample' : approved ? null : 'Draft',
      },
    };
  }

  const { data: post } = await db.from('social_posts').select('*').eq('id', id).maybeSingle();
  if (post && isImageTemplate(post.image_template)) {
    const approved = PUBLIC_POST.includes(post.status) && post.compliance_status !== 'block';
    return {
      requiresStaff: !approved,
      spec: { template: post.image_template, format: format ?? '4:5', params: asParams(post.image_params), headline: post.title, cta: 'BOOK_NOW', isPublic: approved, label: post.is_sample ? 'Sample' : approved ? null : 'Draft' },
    };
  }
  return null;
}

/** Review cards may only quote reviews from real platforms. */
async function reviewIsReal(db: Db, params: ImageParams): Promise<boolean> {
  if (typeof params.reviewId !== 'string') return false;
  const { data } = await db.from('reviews').select('id').eq('id', params.reviewId).in('source', [...PUBLIC_REVIEW_SOURCES]).maybeSingle();
  return Boolean(data);
}

export async function renderAdImage(db: Db, spec: ImageSpec): Promise<Response> {
  if (spec.template === 'review' && !(await reviewIsReal(db, spec.params))) {
    return new Response('Review cards need a real, verifiable review.', { status: 422 });
  }
  const { width, height } = FORMAT_SIZE[spec.format];
  const [fonts, logo, photo] = await Promise.all([loadFonts(), loadLogo(), loadPhoto(typeof spec.params.image === 'string' ? spec.params.image : null)]);
  const image = new ImageResponse(
    <AdImage template={spec.template} canvas={canvasFor(width, height)} params={spec.params} headline={spec.headline} cta={spec.cta} photo={photo} logo={logo} label={spec.label} />,
    {
      width,
      height,
      fonts: fonts.map((f) => ({ name: f.name, data: f.data, weight: f.weight, style: f.style })),
    },
  );
  // Render fully before responding so a template error becomes a 500, not a dropped stream.
  const png = await image.arrayBuffer();
  return new Response(png, {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': spec.isPublic ? 'public, max-age=3600, s-maxage=86400' : 'private, no-store' },
  });
}

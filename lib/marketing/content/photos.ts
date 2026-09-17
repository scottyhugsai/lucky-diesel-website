import 'server-only';
import { createHash } from 'node:crypto';
import { generateBackground } from './ai';
import { recordGeneration, type Db } from './db';
import type { AdFormat, ImageTemplate } from './types';

const BUCKET = 'marketing';
const GALLERY_FOR_TEMPLATE: Partial<Record<ImageTemplate, readonly string[]>> = {
  offer: ['shop', 'builds'],
  seasonal: ['builds', 'shop'],
  review: ['shop', 'builds'],
};

export interface ChosenImage {
  url: string;
  assetId: string | null;
  source: 'gallery' | 'build' | 'ai' | 'shopify';
  needsPrivacyReview: boolean;
}

/** The owner's own photo for templates that use a background, most recent first. */
export async function pickOwnerPhoto(db: Db, template: ImageTemplate, seed: number): Promise<ChosenImage | null> {
  const categories = GALLERY_FOR_TEMPLATE[template];
  if (!categories) return null;
  const { data } = await db.from('gallery_items').select('image_url, category').eq('published', true).in('category', [...categories]).order('sort').limit(12);
  if (!data?.length) return null;
  const photo = data[seed % data.length]!;
  // Truck photos can show plates or faces; the owner confirms before public use.
  return { url: photo.image_url, assetId: null, source: 'gallery', needsPrivacyReview: photo.category === 'builds' };
}

async function ensureBucket(db: Db): Promise<void> {
  const { data } = await db.storage.getBucket(BUCKET);
  if (!data) await db.storage.createBucket(BUCKET, { public: true, fileSizeLimit: 15_000_000, allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'] });
}

/**
 * Live AI only: generates a text-free background photo and stores it as a
 * creative asset. Returns null in demo mode or on any failure (templates then
 * render on the brand background).
 */
export async function generateAiBackground(db: Db, prompt: string, format: AdFormat, requestedBy: string | null): Promise<ChosenImage | null> {
  const image = await generateBackground(prompt, format);
  if (!image) return null;
  const match = /^data:(image\/[a-z]+);base64,(.+)$/.exec(image.dataUrl);
  if (!match) return null;
  const [, mime, base64] = match;
  const bytes = Buffer.from(base64!, 'base64');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const path = `ai/${sha256.slice(0, 24)}.${mime === 'image/jpeg' ? 'jpg' : mime!.split('/')[1]}`;

  await ensureBucket(db);
  const { error: uploadError } = await db.storage.from(BUCKET).upload(path, bytes, { contentType: mime, upsert: true });
  if (uploadError) {
    console.error(`[marketing/photos] AI background upload failed: ${uploadError.message}`);
    return null;
  }
  const url = db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  const jobId = await recordGeneration(db, { kind: 'image', input: { prompt, format }, output: { path }, meta: image.meta, requestedBy });
  const { data: asset } = await db.from('creative_assets').insert({
    source: 'ai', url, storage_path: `${BUCKET}/${path}`, mime, sha256, ai_generation_id: jobId, alt_text: prompt.slice(0, 200),
  }).select('id').single();
  return { url, assetId: asset?.id ?? null, source: 'ai', needsPrivacyReview: false };
}

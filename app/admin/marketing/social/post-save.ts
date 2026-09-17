import 'server-only';
import { InputError, requiredText, shopDateTime, text } from '@/components/admin/core/parse';
import { SOCIAL_PLATFORMS } from '@/components/admin/marketing/studio/labels';
import { checkContent } from '@/lib/marketing/content/compliance';
import type { Db } from '@/lib/marketing/content/db';
import { PRIVACY_NOTE } from '@/lib/marketing/content/social';
import { IMAGE_TEMPLATES, type ImageTemplate, type SocialPlatform } from '@/lib/marketing/content/types';

const SIGNED_SECONDS = 30 * 86_400;
/** Designs that read well with only a title (no dyno numbers or quotes needed). */
export const TEMPLATE_CHOICES: readonly ImageTemplate[] = IMAGE_TEMPLATES.filter((t) => t === 'seasonal' || t === 'offer');

export interface ParsedPost {
  title: string;
  caption: string;
  hashtags: string[];
  networks: SocialPlatform[];
  scheduledFor: string;
  image: { template: ImageTemplate | null; params: Record<string, string | boolean | null>; privacy: boolean } | 'keep';
  compliance: ReturnType<typeof checkContent>;
}

async function resolveImage(db: Db, choice: string, title: string): Promise<ParsedPost['image']> {
  if (choice === 'keep') return 'keep';
  if (choice === 'none') return { template: null, params: {}, privacy: false };
  const [kind, id] = choice.split(':');
  if (kind === 'template') {
    const template = TEMPLATE_CHOICES.find((t) => t === id);
    if (!template) throw new InputError('Pick a valid design.');
    return { template, params: { title, service: 'Lucky Diesel' }, privacy: false };
  }
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw new InputError('Pick a valid photo.');
  let url: string | null = null;
  if (kind === 'gallery') url = (await db.from('gallery_items').select('image_url').eq('id', id).maybeSingle()).data?.image_url ?? null;
  if (kind === 'build') url = (await db.from('builds').select('hero_image').eq('id', id).maybeSingle()).data?.hero_image ?? null;
  if (kind === 'media') {
    const { data: m } = await db.from('media').select('bucket, path').eq('id', id).eq('kind', 'photo').maybeSingle();
    if (m) url = (await db.storage.from(m.bucket).createSignedUrl(m.path, SIGNED_SECONDS)).data?.signedUrl ?? null;
  }
  if (!url) throw new InputError('That photo is gone. Pick another.');
  // Owner photos can show plates, VINs or faces: always flag for review.
  return { template: 'photo', params: { image: url, title, imageSource: kind ?? null, needsPrivacyReview: true }, privacy: true };
}

/** Validates the post form. Every value is untrusted. */
export async function parsePostForm(db: Db, form: FormData): Promise<ParsedPost> {
  const title = requiredText(form, 'title', 'Title', 100);
  const caption = requiredText(form, 'caption', 'Caption', 2200);
  const rawTags = text(form, 'hashtags', { max: 600, label: 'Hashtags' }) ?? '';
  const hashtags = [...new Set(rawTags.split(/[\s,]+/).filter(Boolean).map((t) => (t.startsWith('#') ? t : `#${t}`)))];
  if (hashtags.length > 30) throw new InputError('Use 30 hashtags or fewer.');
  if (hashtags.some((t) => !/^#[\p{L}\p{N}_]{1,60}$/u.test(t))) throw new InputError('Hashtags can only use letters, numbers and _.');
  const raw = form.getAll('network');
  const networks = SOCIAL_PLATFORMS.filter((p) => raw.includes(p));
  if (!networks.length || networks.length !== raw.length) throw new InputError('Pick at least one valid network.');
  const scheduledFor = shopDateTime(form, 'scheduledFor', 'Post time');
  if (!scheduledFor) throw new InputError('Pick a post time.');
  const image = await resolveImage(db, text(form, 'image', { max: 60, label: 'Image' }) ?? 'keep', title);
  return { title, caption, hashtags, networks, scheduledFor, image, compliance: checkContent([title, caption]) };
}

export { PRIVACY_NOTE };

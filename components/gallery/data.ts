import 'server-only';
import { PLATFORMS } from '@/lib/site';
import { createClient } from '@/lib/supabase/server';
import { CATEGORY_IDS, type GalleryCategory, type GalleryPhoto, type GalleryPlatform, GALLERY_PLATFORM_IDS } from './constants';

export interface GalleryFilters {
  category: GalleryCategory | null;
  platform: GalleryPlatform | null;
}

function pick<T extends string>(value: string | string[] | undefined, options: readonly T[]): T | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && (options as readonly string[]).includes(raw) ? (raw as T) : null;
}

/** Unknown or repeated params fall back to "all" rather than erroring. */
export function parseFilters(params: Record<string, string | string[] | undefined>): GalleryFilters {
  return { category: pick(params.category, CATEGORY_IDS), platform: pick(params.platform, GALLERY_PLATFORM_IDS) };
}

export function platformName(id: string | null): string | null {
  return PLATFORMS.find((p) => p.id === id)?.name ?? null;
}

/** Every published photo in display order. RLS limits anonymous visitors to published rows and builds. */
export async function loadPublishedPhotos(): Promise<{ photos: GalleryPhoto[]; failed: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('gallery_items')
    .select('id, title, caption, alt_text, category, platform, vehicle_label, image_url, width, height, is_sample, builds(slug, published)')
    .eq('published', true)
    .order('sort', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) return { photos: [], failed: true };

  const photos = (data ?? []).map((row): GalleryPhoto => ({
    id: row.id,
    title: row.title,
    caption: row.caption,
    alt: row.alt_text,
    category: row.category,
    platform: row.platform,
    vehicleLabel: row.vehicle_label,
    src: row.image_url,
    width: row.width,
    height: row.height,
    buildSlug: row.builds?.published ? row.builds.slug : null,
    isSample: row.is_sample,
  }));
  return { photos, failed: false };
}

export function applyFilters(photos: GalleryPhoto[], { category, platform }: GalleryFilters): GalleryPhoto[] {
  return photos.filter((p) => (!category || p.category === category) && (!platform || p.platform === platform));
}

export function filterHref(filters: GalleryFilters): string {
  const query = new URLSearchParams();
  if (filters.category) query.set('category', filters.category);
  if (filters.platform) query.set('platform', filters.platform);
  const qs = query.toString();
  return qs ? `/gallery?${qs}` : '/gallery';
}

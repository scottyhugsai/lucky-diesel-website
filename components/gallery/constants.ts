/* Gallery enums and shapes shared by the public page, the admin manager and its server actions. */

export const GALLERY_CATEGORIES = [
  { id: 'builds', label: 'Builds' },
  { id: 'shop', label: 'Shop' },
  { id: 'dyno', label: 'Dyno' },
  { id: 'parts', label: 'Parts' },
  { id: 'events', label: 'Events' },
] as const;

export type GalleryCategory = (typeof GALLERY_CATEGORIES)[number]['id'];
export const CATEGORY_IDS: readonly GalleryCategory[] = GALLERY_CATEGORIES.map((c) => c.id);

export const GALLERY_PLATFORM_IDS = ['duramax', 'powerstroke', 'cummins'] as const;
export type GalleryPlatform = (typeof GALLERY_PLATFORM_IDS)[number];

export const GALLERY_BUCKET = 'gallery';
export const MAX_GALLERY_BYTES = 20 * 1024 * 1024;
export const GALLERY_MIME_EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
/** `uploads/<uuid>.<ext>` — the only storage paths the admin actions accept. */
export const UPLOAD_PATH_RE = /^uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

export const LIMITS = { title: 80, caption: 280, alt: 200, vehicle: 80, maxDimension: 20_000, batch: 30 } as const;

/** One photo as the public gallery renders it. Serializable (crosses into the lightbox). */
export interface GalleryPhoto {
  id: string;
  title: string;
  caption: string | null;
  /** Written alt text; falls back to title, vehicle and caption. */
  alt: string | null;
  category: string;
  platform: string | null;
  vehicleLabel: string | null;
  src: string;
  width: number;
  height: number;
  buildSlug: string | null;
  isSample: boolean;
}

export function categoryLabel(id: string): string {
  return GALLERY_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

export function altText(photo: Pick<GalleryPhoto, 'title' | 'caption' | 'vehicleLabel'> & { alt?: string | null }): string {
  if (photo.alt?.trim()) return photo.alt.trim();
  return [photo.title, photo.vehicleLabel, photo.caption].filter(Boolean).join(' — ');
}

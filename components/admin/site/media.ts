/** Shapes and limits shared by the site media uploader and its server actions.
 *  Kept out of the actions file because a 'use server' module may only export
 *  async functions. */

/** The only storage paths the media actions will record. Site photos live in
 *  the gallery's public bucket under their own prefix. */
export const SITE_UPLOAD_PATH_RE = /^site\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

export const MEDIA_LIMITS = { title: 120, alt: 200, dimension: 20_000, batch: 20 } as const;

export interface UploadedSiteMedia {
  path: string;
  title: string;
  width: number;
  height: number;
  bytes: number;
}

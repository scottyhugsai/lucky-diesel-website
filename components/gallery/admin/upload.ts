import { GALLERY_BUCKET, GALLERY_MIME_EXT, LIMITS, MAX_GALLERY_BYTES } from '../constants';

/** Client-side checks that mirror the bucket's own limits, with messages a person can act on. */
export function rejectReason(file: File): string | null {
  if (!GALLERY_MIME_EXT[file.type]) {
    return file.type.startsWith('image/') ? 'Use JPG, PNG or WebP (iPhone HEIC: export as JPG first).' : 'Not an image.';
  }
  if (file.size > MAX_GALLERY_BYTES) return `Too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 20 MB.`;
  return null;
}

/** Natural pixel size, read locally before upload so the public grid can reserve space. */
export async function readDimensions(file: File): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    if (!img.naturalWidth || !img.naturalHeight) throw new Error('Could not read the image size.');
    return { width: img.naturalWidth, height: img.naturalHeight };
  } catch {
    throw new Error('This file could not be opened as an image.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function storagePathFor(file: File): string {
  return `uploads/${crypto.randomUUID()}.${GALLERY_MIME_EXT[file.type]}`;
}

/** "IMG_2044 turbo-swap.jpg" → "IMG 2044 turbo swap". */
export function titleFromName(name: string): string {
  return name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, LIMITS.title);
}

/** XHR instead of supabase-js so we get real upload progress. Runs as the signed-in admin (RLS applies). */
export function uploadWithProgress(path: string, file: File, token: string, onProgress: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${GALLERY_BUCKET}/${path}`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('apikey', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '');
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.setRequestHeader('Cache-Control', 'max-age=3600');
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status}).`)));
    xhr.onerror = () => reject(new Error('Network dropped during upload.'));
    xhr.send(file);
  });
}

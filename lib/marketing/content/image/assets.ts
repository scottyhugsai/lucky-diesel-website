import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Fonts, logo and photos for ImageResponse. Everything degrades: if Google
 * Fonts is unreachable we render with the built-in font; if a photo can't be
 * fetched the template falls back to the brand background.
 */

export interface ImageFont {
  name: string;
  data: ArrayBuffer;
  weight: 500 | 700 | 800;
  style: 'normal' | 'italic';
}

const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@1,800&family=Barlow:wght@500;700&display=swap';
const FETCH_TIMEOUT_MS = 6000;
const MAX_PHOTO_BYTES = 6_000_000;

let fontsPromise: Promise<ImageFont[]> | null = null;

async function fetchFonts(): Promise<ImageFont[]> {
  // A non-browser user agent makes Google serve TTF, which Satori can parse.
  const css = await fetch(FONT_CSS, { headers: { 'User-Agent': 'node' }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }).then((r) => (r.ok ? r.text() : ''));
  const faces = [...css.matchAll(/font-family: '([^']+)';\s*font-style: (\w+);\s*font-weight: (\d+);[\s\S]*?src: url\((https:[^)]+\.ttf)\)/g)];
  const fonts = await Promise.all(faces.map(async ([, name, style, weight, url]) => {
    const response = await fetch(url!, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!response.ok) return null;
    return { name: name!, data: await response.arrayBuffer(), weight: Number(weight) as ImageFont['weight'], style: style === 'italic' ? 'italic' as const : 'normal' as const };
  }));
  return fonts.filter((f): f is ImageFont => f !== null);
}

/** Cached per server instance. An empty list means "use the default font". */
export function loadFonts(): Promise<ImageFont[]> {
  fontsPromise ??= fetchFonts().catch((error: unknown) => {
    console.error(`[marketing/image] font fetch failed, using default font: ${error instanceof Error ? error.message : String(error)}`);
    fontsPromise = null;
    return [];
  });
  return fontsPromise;
}

let logoPromise: Promise<string | null> | null = null;

export function loadLogo(): Promise<string | null> {
  logoPromise ??= readFile(path.join(process.cwd(), 'public/images/logo.png'))
    .then((buffer) => `data:image/png;base64,${buffer.toString('base64')}`)
    .catch((error: unknown) => {
      console.error(`[marketing/image] logo missing: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    });
  return logoPromise;
}

const MIME: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

/**
 * Photo → data URL. Site images are read from /public; remote images must be
 * https and come from our own storage or the Shopify CDN (no open proxy).
 */
export async function loadPhoto(src: string | null | undefined): Promise<string | null> {
  if (!src) return null;
  try {
    if (src.startsWith('/images/') && !src.includes('..')) {
      const ext = path.extname(src).toLowerCase();
      if (!MIME[ext] || ext === '.webp') return null; // Satori can't decode webp.
      const buffer = await readFile(path.join(process.cwd(), 'public', src));
      return `data:${MIME[ext]};base64,${buffer.toString('base64')}`;
    }
    const url = new URL(src);
    const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host : null;
    const allowed = url.protocol === 'https:' && (url.host === 'cdn.shopify.com' || url.host.endsWith('.myshopify.com') || url.host === 'luckydiesel.com' || url.host === supabaseHost);
    if (!allowed) return null;
    const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    const type = response.headers.get('content-type') ?? '';
    if (!response.ok || !/^image\/(png|jpeg)/.test(type)) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_PHOTO_BYTES) return null;
    return `data:${type.split(';')[0]};base64,${buffer.toString('base64')}`;
  } catch (error) {
    console.error(`[marketing/image] photo ${src} unavailable: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

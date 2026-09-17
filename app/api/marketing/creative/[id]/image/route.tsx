import type { NextRequest } from 'next/server';
import { getViewer } from '@/lib/auth';
import { adminDb } from '@/lib/marketing/content/db';
import { isAdFormat, lookupImageSpec, renderAdImage } from '@/lib/marketing/content/image/render';

export const runtime = 'nodejs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Branded ad/post image (PNG), drawn from a template — no AI image model needed.
 * GET /api/marketing/creative/{variantId | creativeId | socialPostId}/image?format=1:1|4:5|9:16|1.91:1&variant={id}
 * Approved content is public (platforms fetch it by URL); drafts need a staff session.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const format = request.nextUrl.searchParams.get('format');
  const variant = request.nextUrl.searchParams.get('variant');
  if (!UUID.test(id) || (variant && !UUID.test(variant))) return new Response('Not found', { status: 404 });
  if (format && !isAdFormat(format)) return new Response('format must be 1:1, 4:5, 9:16 or 1.91:1', { status: 400 });

  try {
    const db = adminDb();
    const found = await lookupImageSpec(db, id, variant, isAdFormat(format) ? format : null);
    if (!found) return new Response('Not found', { status: 404 });
    if (found.requiresStaff) {
      const viewer = await getViewer();
      if (!viewer || viewer.profile.role === 'client') return new Response('Not found', { status: 404 });
    }
    return await renderAdImage(db, found.spec);
  } catch (error) {
    console.error(`[marketing/image] render failed for ${id}: ${error instanceof Error ? error.message : String(error)}`);
    return new Response('Could not render this image.', { status: 500 });
  }
}

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badRequest, oneOf, readJson, reply, requireAdmin, str } from '@/lib/marketing/content/http';
import { getReviewWidget, ingestReview } from '@/lib/marketing/content/reputation-service';

/** Public GET: review widget data. Real reviews only; sample and internal feedback are never included. */
export async function GET(request: NextRequest) {
  const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get('limit')) || 6, 1), 20);
  return NextResponse.json({ ok: true, data: await getReviewWidget(limit) }, { headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' } });
}

/** Owner POST: manual review entry { source: manual|facebook|internal, rating, body, authorName, reviewedAt? }. */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if ('response' in auth) return auth.response;
  const body = await readJson(request);
  const source = body ? oneOf(body.source, ['manual', 'facebook', 'internal'] as const) : null;
  const authorName = body ? str(body, 'authorName', 120) : null;
  if (!body || !source || !authorName || typeof body.rating !== 'number') return badRequest('source, rating and authorName are required.');
  return reply(await ingestReview({ source, rating: body.rating, authorName, body: str(body, 'body', 4000), reviewedAt: str(body, 'reviewedAt', 40) ?? undefined }));
}

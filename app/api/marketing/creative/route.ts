import type { NextRequest } from 'next/server';
import { generateAdCreative, type SubjectInput } from '@/lib/marketing/content/creative-service';
import { badRequest, oneOf, readJson, reply, requireAdmin, str } from '@/lib/marketing/content/http';
import { AD_FORMATS } from '@/lib/marketing/content/types';

const PLATFORMS = ['meta', 'google_pmax', 'google_search', 'tiktok'] as const;
const GOALS = ['leads', 'bookings', 'traffic', 'awareness', 'sales'] as const;
const SEASONS = ['tow_season', 'hurricane_prep', 'winter_ready', 'spring_tune', 'dyno_day', 'holiday'] as const;

function parseSubject(raw: unknown): SubjectInput | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const s = raw as Record<string, unknown>;
  const ref = (key: string) => str(s, key, 120);
  switch (s.kind) {
    case 'product': return ref('handle') ? { kind: 'product', handle: ref('handle')! } : null;
    case 'build': return ref('buildId') ? { kind: 'build', buildId: ref('buildId')! } : null;
    case 'dyno': return ref('dynoRunId') ? { kind: 'dyno', dynoRunId: ref('dynoRunId')! } : null;
    case 'offer': return ref('landingSlug') ? { kind: 'offer', landingSlug: ref('landingSlug')! } : null;
    case 'review': return ref('reviewId') ? { kind: 'review', reviewId: ref('reviewId')! } : null;
    case 'season': { const season = oneOf(s.season, SEASONS); return season ? { kind: 'season', season } : null; }
    default: return null;
  }
}

/** POST /api/marketing/creative — generate ad variants into the approval queue (owner only). */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if ('response' in auth) return auth.response;
  const body = await readJson(request);
  if (!body) return badRequest('JSON body required.');
  const platform = oneOf(body.platform, PLATFORMS);
  const goal = oneOf(body.goal, GOALS);
  const subject = parseSubject(body.subject);
  if (!platform || !goal || !subject) return badRequest('platform, goal and subject are required.');
  const count = typeof body.count === 'number' && Number.isInteger(body.count) ? body.count : undefined;
  return reply(await generateAdCreative({
    platform, goal, subject, count, format: oneOf(body.format, AD_FORMATS) ?? undefined, audience: str(body, 'audience', 200) ?? undefined,
    campaignId: str(body, 'campaignId', 40), name: str(body, 'name', 120) ?? undefined, requestedBy: auth.viewer.userId,
  }));
}

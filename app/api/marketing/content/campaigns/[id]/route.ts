import type { NextRequest } from 'next/server';
import { badRequest, oneOf, readJson, reply, requireAdmin, str, UUID } from '@/lib/marketing/content/http';
import { activateCampaign, pauseCampaign } from '@/lib/marketing/content/publish-service';

/** POST { action: 'activate' | 'pause', reason? } — activation re-checks approval and budget guards (owner only). */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ('response' in auth) return auth.response;
  const { id } = await context.params;
  const body = await readJson(request);
  const action = body ? oneOf(body.action, ['activate', 'pause'] as const) : null;
  if (!UUID.test(id) || !action || !body) return badRequest('campaign id and action are required.');
  return reply(action === 'activate' ? await activateCampaign(id) : await pauseCampaign(id, str(body, 'reason', 200) ?? 'paused by owner'));
}

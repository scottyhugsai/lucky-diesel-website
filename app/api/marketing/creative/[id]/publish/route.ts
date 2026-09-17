import type { NextRequest } from 'next/server';
import { badRequest, readJson, reply, requireAdmin, str, UUID } from '@/lib/marketing/content/http';
import { publishCreative } from '@/lib/marketing/content/publish-service';

/** POST /api/marketing/creative/{id}/publish { campaignId } — approved creative → approved campaign, created PAUSED (owner only). */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ('response' in auth) return auth.response;
  const { id } = await context.params;
  const body = await readJson(request);
  const campaignId = body ? str(body, 'campaignId', 40) : null;
  if (!UUID.test(id) || !campaignId || !UUID.test(campaignId)) return badRequest('creative id and campaignId are required.');
  return reply(await publishCreative({ creativeId: id, campaignId }));
}

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { decideApproval, listApprovalQueue, submitForApproval } from '@/lib/marketing/content/approvals-service';
import { badRequest, oneOf, readJson, reply, requireAdmin, str, UUID } from '@/lib/marketing/content/http';

const SUBJECTS = ['ad_creative', 'ad_campaign', 'social_post', 'review_reply', 'landing_page', 'seo_content'] as const;

/** GET — everything waiting on the owner. */
export async function GET() {
  const auth = await requireAdmin();
  if ('response' in auth) return auth.response;
  return NextResponse.json({ ok: true, data: await listApprovalQueue() });
}

/** POST { submit: { type, id } } or { approvalId, decision, notes?, acknowledgeWarnings? }. */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if ('response' in auth) return auth.response;
  const body = await readJson(request);
  if (!body) return badRequest('JSON body required.');
  if (typeof body.submit === 'object' && body.submit !== null) {
    const submit = body.submit as Record<string, unknown>;
    const type = oneOf(submit.type, SUBJECTS);
    const id = str(submit, 'id', 40);
    if (!type || !id || !UUID.test(id)) return badRequest('submit.type and submit.id are required.');
    return reply(await submitForApproval(type, id, auth.viewer.userId));
  }
  const approvalId = str(body, 'approvalId', 40);
  const decision = oneOf(body.decision, ['approved', 'rejected', 'changes_requested'] as const);
  if (!approvalId || !UUID.test(approvalId) || !decision) return badRequest('approvalId and decision are required.');
  return reply(await decideApproval({ approvalId, decision, decidedBy: auth.viewer.userId, notes: str(body, 'notes', 1000) ?? undefined, acknowledgeWarnings: body.acknowledgeWarnings === true }));
}

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { suggestNextCampaign, summarizeLast30Days, writeFromPrompt } from '@/lib/marketing/content/assistant';
import { badRequest, oneOf, readJson, requireAdmin, str } from '@/lib/marketing/content/http';

/** POST { action: 'next_campaign' | 'summary' | 'write', kind?: 'caption' | 'email', prompt? } (owner only). */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if ('response' in auth) return auth.response;
  const body = await readJson(request);
  const action = body ? oneOf(body.action, ['next_campaign', 'summary', 'write'] as const) : null;
  if (!body || !action) return badRequest('action is required.');
  try {
    if (action === 'next_campaign') return NextResponse.json({ ok: true, data: await suggestNextCampaign() });
    if (action === 'summary') return NextResponse.json({ ok: true, data: await summarizeLast30Days() });
    const kind = oneOf(body.kind, ['caption', 'email'] as const);
    const prompt = str(body, 'prompt', 500);
    if (!kind || !prompt) return badRequest('kind and prompt are required.');
    return NextResponse.json({ ok: true, data: await writeFromPrompt({ kind, prompt, requestedBy: auth.viewer.userId }) });
  } catch (error) {
    console.error(`[marketing/assistant] ${error instanceof Error ? error.message : String(error)}`);
    return NextResponse.json({ ok: false, error: 'The assistant is unavailable right now.' }, { status: 500 });
  }
}

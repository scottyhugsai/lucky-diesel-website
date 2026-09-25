import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { deliverLead } from '@/lib/deliver-lead';
import { createWebsiteLead } from '@/lib/domain/leads';
import { parseLead } from '@/lib/lead';
import { markPartialConverted } from '@/lib/marketing/engage/partial';
import { overRateLimit } from '@/lib/marketing/core/rate-limit';
import { trackConversion } from '@/lib/marketing/wire';

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
  if (await overRateLimit('lead', ip)) {
    return NextResponse.json({ ok: false, message: 'Too many requests. Give us a call instead.' }, { status: 429 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = parseLead(body);

  if (!parsed.ok) {
    // Bots get a success-shaped reply so they learn nothing.
    if (parsed.spam) return NextResponse.json({ ok: true, delivered: true });
    return NextResponse.json({ ok: false, errors: parsed.errors }, { status: 422 });
  }

  const saved = await createWebsiteLead(parsed.lead, { ip }).catch((error: unknown) => ({
    ok: false as const,
    error: error instanceof Error ? error.message : String(error),
  }));

  if (!saved.ok) {
    // Database down: fall back to emailing the shop directly so the lead isn't lost.
    console.error(`[lead] could not save lead, falling back to email: ${saved.error}`);
    const result = await deliverLead(parsed.lead);
    return NextResponse.json({ ok: true, delivered: result.delivered });
  }

  // Closes the draft this lead came from, so the abandoned-quote reminder never
  // chases somebody who has just submitted. `duePartialFollowUps` also suppresses
  // on a matching email or phone; this is the exact signal rather than the guess.
  const sessionKey = (body as { sessionKey?: unknown } | null)?.sessionKey;
  if (sessionKey) await markPartialConverted(sessionKey, saved.data.leadId).catch(() => { /* never fail a saved lead over its draft */ });

  const jar = await cookies();
  await trackConversion({ kind: 'lead', leadId: saved.data.leadId, cookie: jar.get('ld_attr')?.value ?? null }, jar.get('ld_ref')?.value);
  return NextResponse.json({ ok: true, delivered: true });
}

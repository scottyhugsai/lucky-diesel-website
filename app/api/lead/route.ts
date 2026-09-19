import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { deliverLead } from '@/lib/deliver-lead';
import { createWebsiteLead } from '@/lib/domain/leads';
import { parseLead } from '@/lib/lead';
import { markPartialConverted } from '@/lib/marketing/engage/partial';
import { trackConversion } from '@/lib/marketing/wire';

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;

/** Best-effort per-instance throttle; enough to blunt a form-spamming script. */
const recent = new Map<string, number[]>();

function isThrottled(ip: string, now: number): boolean {
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.set(ip, [...hits, now]);
  return hits.length >= MAX_PER_WINDOW;
}

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
  if (isThrottled(ip ?? 'unknown', Date.now())) {
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

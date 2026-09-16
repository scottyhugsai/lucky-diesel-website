import { NextResponse } from 'next/server';
import { deliverLead } from '@/lib/deliver-lead';
import { parseLead } from '@/lib/lead';

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
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (isThrottled(ip, Date.now())) {
    return NextResponse.json(
      { ok: false, message: 'Too many requests. Give us a call instead.' },
      { status: 429 },
    );
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = parseLead(body);

  if (!parsed.ok) {
    // Bots get a success-shaped reply so they learn nothing.
    if (parsed.spam) return NextResponse.json({ ok: true, delivered: true });
    return NextResponse.json({ ok: false, errors: parsed.errors }, { status: 422 });
  }

  const result = await deliverLead(parsed.lead);
  return NextResponse.json({ ok: true, delivered: result.delivered });
}

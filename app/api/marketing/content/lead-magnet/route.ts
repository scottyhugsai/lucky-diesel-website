import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badRequest, clientIp, readJson, reply, str, throttle } from '@/lib/marketing/content/http';
import { deliverLeadMagnet } from '@/lib/marketing/content/landing-service';

const recent = new Map<string, number[]>();

/** Public: POST { slug, name, email, company (honeypot), landingSlug? } → emails the checklist. */
export async function POST(request: NextRequest) {
  if (throttle(recent, clientIp(request), 5, 10 * 60_000)) return NextResponse.json({ ok: false, error: 'Too many requests. Try again later.' }, { status: 429 });
  const body = await readJson(request);
  if (!body) return badRequest('JSON body required.');
  if (str(body, 'company')) return NextResponse.json({ ok: true, data: { delivered: true } });
  const slug = str(body, 'slug', 80);
  const name = str(body, 'name', 80);
  const email = str(body, 'email', 200);
  if (!slug || !name || !email) return badRequest('Name and email are required.');
  return reply(await deliverLeadMagnet({ slug, name, email, landingSlug: str(body, 'landingSlug', 80) }));
}

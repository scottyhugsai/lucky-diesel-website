import { createHmac, timingSafeEqual } from 'node:crypto';
import { findCustomerByAddress, recordConsent } from '@/lib/marketing/core/consent';
import { normalizeEmail } from '@/lib/marketing/core/policy';
import { createAdminClient } from '@/lib/supabase/admin';

const MAX_BODY = 100_000;
const MAX_SKEW_MS = 5 * 60_000;

/**
 * Svix signature (Resend's webhook signer): base64 HMAC-SHA256 of
 * `<id>.<timestamp>.<body>` keyed with the secret after `whsec_`.
 * https://resend.com/docs/dashboard/webhooks/verify-webhooks-requests
 */
function verifySvix(secret: string, headers: Headers, body: string): boolean {
  const id = headers.get('svix-id');
  const timestamp = headers.get('svix-timestamp');
  const signatures = headers.get('svix-signature');
  if (!id || !timestamp || !signatures) return false;
  const sentAt = Number(timestamp) * 1000;
  if (!Number.isFinite(sentAt) || Math.abs(Date.now() - sentAt) > MAX_SKEW_MS) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64');
  const expectedBuffer = Buffer.from(expected);
  return signatures.split(' ').some((part) => {
    const given = Buffer.from(part.startsWith('v1,') ? part.slice(3) : part);
    return given.length === expectedBuffer.length && timingSafeEqual(given, expectedBuffer);
  });
}

interface ResendEvent {
  type?: string;
  data?: { email_id?: string; to?: string[] | string; bounce?: { type?: string; subType?: string } };
}

function recipients(data: ResendEvent['data']): string[] {
  const raw = Array.isArray(data?.to) ? data.to : data?.to ? [data.to] : [];
  return [...new Set(raw.map((value) => normalizeEmail(String(value))).filter((value) => value.includes('@')))].slice(0, 20);
}

/**
 * Resend delivery events. A permanent bounce suppresses the address for every
 * purpose; a spam complaint revokes marketing consent. Soft bounces are logged
 * only. Needs RESEND_WEBHOOK_SECRET and the endpoint added in Resend.
 */
export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!secret) return new Response('webhook secret not configured', { status: 503 });
  const body = await request.text();
  if (body.length > MAX_BODY) return new Response('payload too large', { status: 413 });
  if (!verifySvix(secret, request.headers, body)) return new Response('invalid signature', { status: 403 });

  let event: ResendEvent;
  try {
    event = JSON.parse(body) as ResendEvent;
  } catch {
    return new Response('invalid payload', { status: 400 });
  }
  const type = typeof event.type === 'string' ? event.type : '';
  const addresses = recipients(event.data);
  if (!addresses.length) return Response.json({ ok: true, handled: 0 });

  const hard = type === 'email.bounced' && (event.data?.bounce?.type ?? 'Permanent') === 'Permanent';
  const complaint = type === 'email.complained';
  if (!hard && !complaint) {
    if (type === 'email.bounced') console.warn(`[marketing] soft bounce for ${addresses.length} address(es)`);
    return Response.json({ ok: true, handled: 0 });
  }

  const db = createAdminClient();
  for (const address of addresses) {
    const customerId = await findCustomerByAddress(db, 'email', address);
    await recordConsent(db, {
      customerId, channel: 'email',
      // A hard bounce is an undeliverable mailbox, so it blocks every purpose.
      purpose: hard ? 'transactional' : 'marketing',
      action: 'revoked', method: hard ? 'bounce' : 'complaint', address,
      evidence: { text: type, messageId: event.data?.email_id ?? null, subType: event.data?.bounce?.subType ?? null },
    });
  }
  return Response.json({ ok: true, handled: addresses.length });
}

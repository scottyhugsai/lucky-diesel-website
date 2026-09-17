import { unsubscribeWithToken } from '@/lib/marketing/core/consent';
import { clientIp } from '@/lib/marketing/core/requests';
import { verifyToken } from '@/lib/marketing/core/tokens';
import { BUSINESS } from '@/lib/site';
import { createAdminClient } from '@/lib/supabase/admin';

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function page(title: string, content: string, status = 200): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title></head><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;line-height:1.5"><h1 style="font-size:1.5rem">${title}</h1>${content}<p><a href="/">${BUSINESS.name}</a></p></body></html>`;
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

/**
 * GET: confirmation page with a button. Unsubscribing only on POST stops link
 * scanners in corporate mail filters from opting people out by pre-fetching.
 */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('t');
  const payload = verifyToken('unsubscribe', token);
  if (!payload?.a || !token) return page('Link not valid', `<p>This unsubscribe link is invalid. Email ${BUSINESS.email} and we’ll remove you.</p>`, 400);
  const what = payload.c === 'sms' ? 'marketing texts' : 'marketing emails';
  return page(
    `Unsubscribe from ${BUSINESS.name}?`,
    `<p>Stop ${what} to <strong>${escapeHtml(payload.a)}</strong>. Messages about your appointments and jobs still arrive.</p><form method="post" action="?t=${encodeURIComponent(token)}"><button type="submit" style="font:inherit;padding:.6rem 1.2rem;cursor:pointer">Unsubscribe</button></form>`,
  );
}

/** RFC 8058 one-click unsubscribe (List-Unsubscribe-Post) and the confirmation form. */
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get('t');
  const result = await unsubscribeWithToken(createAdminClient(), token, { ip: clientIp(request), userAgent: request.headers.get('user-agent') });
  return result.ok
    ? page('You’re unsubscribed', `<p>You won’t get marketing messages from ${BUSINESS.name} anymore.</p>`)
    : page('Link not valid', `<p>This unsubscribe link is invalid. Email ${BUSINESS.email} and we’ll remove you.</p>`, 400);
}

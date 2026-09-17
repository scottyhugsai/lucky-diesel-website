import { preferencesForToken, saveEmailPreferences } from '@/lib/marketing/core/consent';
import { clientIp, createThrottle } from '@/lib/marketing/core/requests';
import { EMAIL_TOPICS } from '@/lib/marketing/core/topics';
import { BUSINESS } from '@/lib/site';
import { createAdminClient } from '@/lib/supabase/admin';

const TOPIC_KEYS = EMAIL_TOPICS.map((t) => t.key);
const throttle = createThrottle(60_000, 20);

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function page(title: string, content: string, status = 200): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title><style>body{font-family:system-ui,-apple-system,sans-serif;max-width:34rem;margin:0 auto;padding:3rem 1rem;line-height:1.5;color:#16181b}h1{font-size:1.5rem;margin:0 0 .5rem}fieldset{border:1px solid #d9dde1;border-radius:6px;padding:1rem;margin:1.5rem 0}legend{font-weight:700;padding:0 .35rem}label{display:flex;gap:.6rem;align-items:flex-start;padding:.5rem 0}input{margin-top:.2rem;width:1.1rem;height:1.1rem}button{font:inherit;font-weight:700;padding:.7rem 1.3rem;border:0;border-radius:4px;background:#16181b;color:#fff;cursor:pointer}.muted{color:#5b6068;font-size:.9rem}</style></head><body><h1>${title}</h1>${content}<p class="muted"><a href="/">${BUSINESS.name}</a></p></body></html>`;
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

const invalid = () => page('Link not valid', `<p>This link has expired. Email <a href="mailto:${BUSINESS.email}">${BUSINESS.email}</a> and we’ll sort it out.</p>`, 400);

/** Topic picker for the signed address. Nothing changes until the form is posted. */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('t');
  const state = await preferencesForToken(createAdminClient(), token);
  if (!state || !token) return invalid();
  const rows = EMAIL_TOPICS.map((topic) => {
    const on = state.subscribed && !state.topicsOff.includes(topic.key);
    return `<label><input type="checkbox" name="topic" value="${topic.key}"${on ? ' checked' : ''}> <span>${topic.label}</span></label>`;
  }).join('');
  return page(
    'Email preferences',
    `<p class="muted">For <strong>${escapeHtml(state.address)}</strong>. Messages about your appointments and jobs always come through.</p>
     <form method="post" action="?t=${encodeURIComponent(token)}">
       <fieldset><legend>Send me</legend>${rows}</fieldset>
       <button type="submit">Save preferences</button>
     </form>
     <p class="muted">Clear every box to stop all marketing email.</p>`,
  );
}

/** Saves the picks. Every box cleared is a full unsubscribe. */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('t');
  const ip = clientIp(request) ?? 'unknown';
  if (throttle(ip)) return page('Try again shortly', '<p>Too many changes at once.</p>', 429);
  const form = await request.formData().catch(() => null);
  if (!form) return invalid();
  const on = new Set(form.getAll('topic').map((v) => String(v)).filter((v) => TOPIC_KEYS.includes(v as (typeof TOPIC_KEYS)[number])));
  const result = await saveEmailPreferences(createAdminClient(), {
    token,
    topicsOff: TOPIC_KEYS.filter((key) => !on.has(key)),
    allTopics: TOPIC_KEYS,
    meta: { ip: clientIp(request), userAgent: request.headers.get('user-agent') },
  });
  if (!result.ok) return invalid();
  return result.unsubscribed
    ? page('You’re unsubscribed', `<p>No more marketing email from ${BUSINESS.name}. Appointment and job messages still arrive.</p>`)
    : page('Preferences saved', '<p>You’ll only get what you picked.</p>');
}

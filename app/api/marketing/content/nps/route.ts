import type { NextRequest } from 'next/server';
import { clientIp, throttle } from '@/lib/marketing/content/http';
import { recordNpsResponse } from '@/lib/marketing/content/reputation-service';

/**
 * Public post-job survey. GET ?t=token shows 0–10; POST records it. Every
 * respondent sees the Google review link whatever their score (no gating).
 */

const recent = new Map<string, number[]>();

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function page(body: string, status = 200): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Lucky Diesel survey</title>
<style>body{margin:0;min-height:100vh;background:#0a0c0b;color:#eef2ef;font:16px/1.5 system-ui,sans-serif;display:flex;align-items:center;justify-content:center;padding:24px}
main{max-width:34rem;width:100%}h1{font-style:italic;text-transform:uppercase;font-size:2rem;line-height:1;margin:0 0 .75rem}.k{color:#1fbf3f;letter-spacing:.2em;text-transform:uppercase;font-size:.8rem;font-weight:800}
.s{display:grid;grid-template-columns:repeat(11,1fr);gap:6px;margin:1rem 0}.s button{padding:.7rem 0;border:1px solid rgb(238 242 239/.2);background:#121614;color:#eef2ef;border-radius:4px;font-weight:700;cursor:pointer}
.s button:hover,.s button:focus-visible{background:#1fbf3f;color:#0a0c0b;outline:none}textarea{width:100%;box-sizing:border-box;min-height:5rem;background:#121614;color:#eef2ef;border:1px solid rgb(238 242 239/.2);border-radius:4px;padding:.6rem}
a.go{display:inline-block;margin-top:1rem;background:#1fbf3f;color:#0a0c0b;padding:.8rem 1.4rem;font-weight:800;text-decoration:none;border-radius:3px}.m{color:#8c9590;font-size:.9rem}
@media(max-width:420px){.s{grid-template-columns:repeat(6,1fr)}}</style></head><body><main>${body}</main></body></html>`;
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('t') ?? '';
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return page('<h1>Link expired</h1><p>Call us at (843) 995-9252.</p>', 404);
  const buttons = Array.from({ length: 11 }, (_, n) => `<button name="score" value="${n}" type="submit" aria-label="${n} out of 10">${n}</button>`).join('');
  return page(`<p class="k">Lucky Diesel</p><h1>How did we do?</h1><form method="post"><input type="hidden" name="t" value="${escape(token)}">
<label for="c" class="m">Anything we should know? (optional)</label><textarea id="c" name="comment" maxlength="1000"></textarea>
<p>How likely are you to recommend us to a friend? Tap a number.</p><div class="s">${buttons}</div><p class="m">0 = not at all, 10 = definitely</p></form>`);
}

export async function POST(request: NextRequest) {
  if (throttle(recent, clientIp(request), 10, 10 * 60_000)) return page('<h1>Slow down</h1><p>Try again in a few minutes.</p>', 429);
  const form = await request.formData().catch(() => null);
  const token = String(form?.get('t') ?? '');
  const score = Number(form?.get('score'));
  const result = await recordNpsResponse(token, score, form?.get('comment') ? String(form.get('comment')) : null);
  if (!result.ok) return page(`<h1>Hmm</h1><p>${escape(result.error)}</p>`, 422);
  const link = escape(result.data.reviewLink);
  return page(`<p class="k">Thank you</p><h1>Thanks for the feedback</h1><p>${result.data.alertOwner ? 'The owner will reach out personally.' : 'We appreciate you.'}</p>
<p>If you have a minute, a Google review helps other diesel owners find us.</p><a class="go" href="${link}" rel="noopener">Leave a Google review</a>`);
}

import 'server-only';
import { randomBytes } from 'node:crypto';
import { siteUrl } from '@/lib/site-url';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Db } from './settings';
import { signToken, verifyToken } from './tokens';

const CODE_PATTERN = /^[A-Za-z0-9_-]{4,32}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isShortCode(code: string): boolean {
  return CODE_PATTERN.test(code);
}

/** Branded short link for SMS/email (public shorteners get carrier-filtered). */
export async function createShortLink(
  input: { targetUrl: string; campaignId?: string | null; utmSource?: string | null; utmMedium?: string | null; code?: string; expiresAt?: Date | null },
  db: Db = createAdminClient(),
): Promise<{ ok: true; code: string; url: string } | { ok: false; error: string }> {
  if (!/^(https?:\/\/|\/(?!\/))/.test(input.targetUrl)) return { ok: false, error: 'Links must be http(s) or a site path.' };
  const code = input.code ?? randomBytes(6).toString('base64url').replace(/[^A-Za-z0-9]/g, '').slice(0, 7);
  if (!isShortCode(code)) return { ok: false, error: 'Codes are 4–32 letters, numbers, - or _.' };
  const { error } = await db.from('short_links').insert({
    code, target_url: input.targetUrl, campaign_id: input.campaignId ?? null, utm_source: input.utmSource ?? null,
    utm_medium: input.utmMedium ?? null, expires_at: input.expiresAt?.toISOString() ?? null,
  });
  if (error) return { ok: false, error: error.code === '23505' ? 'That code is taken.' : error.message };
  return { ok: true, code, url: `${siteUrl()}/r/${code}` };
}

/** Per-recipient tracked URL for a campaign send. */
export function trackedLink(code: string, sendId: string): string {
  return `${siteUrl()}/r/${code}?t=${encodeURIComponent(signToken('click', { s: sendId }))}`;
}

function withUtm(target: string, link: { utm_source: string | null; utm_medium: string | null; campaign_id: string | null; code: string }): string {
  const url = new URL(target, siteUrl());
  if (link.utm_source && !url.searchParams.has('utm_source')) url.searchParams.set('utm_source', link.utm_source);
  if (link.utm_medium && !url.searchParams.has('utm_medium')) url.searchParams.set('utm_medium', link.utm_medium);
  if (!url.searchParams.has('utm_campaign')) url.searchParams.set('utm_campaign', link.code);
  if (link.campaign_id) url.searchParams.set('ld_cid', link.campaign_id);
  return url.toString();
}

/**
 * Resolves `/r/[code]`: counts the click, marks the campaign send clicked when
 * the signed token matches, and returns the UTM-tagged destination.
 */
export async function resolveShortLink(code: string, token: string | null, db: Db = createAdminClient(), now = new Date()): Promise<string | null> {
  if (!isShortCode(code)) return null;
  const { data: link } = await db.from('short_links').select('*').eq('code', code).maybeSingle();
  if (!link || (link.expires_at && Date.parse(link.expires_at) < now.getTime())) return null;

  await db.from('short_links').update({ clicks: link.clicks + 1, last_clicked_at: now.toISOString() }).eq('id', link.id);
  const sendId = verifyToken('click', token)?.s;
  if (sendId && UUID.test(sendId)) {
    const { data: send } = await db.from('campaign_sends').select('id, clicked_at, click_count, campaign_id').eq('id', sendId).maybeSingle();
    if (send && (!link.campaign_id || send.campaign_id === link.campaign_id)) {
      await db.from('campaign_sends').update({ clicked_at: send.clicked_at ?? now.toISOString(), click_count: send.click_count + 1 }).eq('id', send.id);
    }
  }
  return withUtm(link.target_url, link);
}

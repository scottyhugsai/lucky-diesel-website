import 'server-only';
import { decryptToken, encryptToken, hasTokenKey, keyId } from '../crypto';
import { adminDb, fail, type Db, type Result } from '../db';
import type { CampaignPlatform, SocialPlatform } from '../types';
import { demoAdAdapter, demoPostAdapter } from './demo';
import { gbpPostAdapter, googlePmaxAdapter, lsaAdapter } from './google';
import { facebookPostAdapter, instagramPostAdapter, metaAdAdapter } from './meta';
import { PLATFORM_REQUIREMENTS, type PlatformRequirements } from './scopes';
import { tiktokAdAdapter, tiktokPostAdapter } from './tiktok';
import type { AdAdapter, ConnectionPlatform, ConnectionStatus, Credentials, PostAdapter, ResolvedConnection } from './types';

const AD_CONNECTION: Record<CampaignPlatform, ConnectionPlatform> = { meta: 'meta_ads', google: 'google_ads', tiktok: 'tiktok_ads', lsa: 'lsa' };
const GOOGLE_PLATFORMS: readonly ConnectionPlatform[] = ['google_ads', 'lsa', 'gbp'];
const REFRESH_MARGIN_MS = 5 * 60_000;

/** Live calls are only allowed in production, unless explicitly enabled for previews. */
export function liveAllowed(env: Record<string, string | undefined> = process.env): boolean {
  return env.VERCEL_ENV === 'production' || env.MARKETING_ALLOW_LIVE_IN_PREVIEW === 'true';
}

async function refreshGoogleToken(db: Db, rowId: string, refreshToken: string): Promise<string | null> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
    signal: AbortSignal.timeout(10_000),
  });
  const data = (await response.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string };
  if (!response.ok || !data.access_token) {
    await db.from('channel_connections').update({ status: 'expired', last_error: `token refresh failed: ${data.error ?? response.status}` }).eq('id', rowId);
    return null;
  }
  await db.from('channel_connections').update({
    access_token_encrypted: encryptToken(data.access_token), token_key_id: keyId(), last_error: null,
    token_expires_at: new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString(),
  }).eq('id', rowId);
  return data.access_token;
}

/** Loads a connection and decides demo vs live. Credentials never leave the server. */
export async function resolveConnection(platform: ConnectionPlatform, db: Db = adminDb()): Promise<ResolvedConnection> {
  const { data: row } = await db.from('channel_connections').select('*').eq('platform', platform).maybeSingle();
  const status = (row?.status ?? 'not_connected') as ConnectionStatus;
  const demo = (reason: string): ResolvedConnection => ({ id: row?.id ?? null, platform, status, mode: 'demo', demoReason: reason, credentials: null });

  if (!row || status !== 'connected') return demo(status === 'demo' ? 'running in demo mode' : `not connected (${status})`);
  if (!row.access_token_encrypted) return demo('no access token stored');
  if (!hasTokenKey()) return demo('MARKETING_TOKEN_KEY is not configured');
  if (!liveAllowed()) return demo('live publishing is disabled outside production');

  try {
    let accessToken = decryptToken(row.access_token_encrypted);
    const refreshToken = row.refresh_token_encrypted ? decryptToken(row.refresh_token_encrypted) : null;
    const expiring = row.token_expires_at && Date.parse(row.token_expires_at) - Date.now() < REFRESH_MARGIN_MS;
    if (expiring && refreshToken && GOOGLE_PLATFORMS.includes(platform)) {
      const refreshed = await refreshGoogleToken(db, row.id, refreshToken);
      if (!refreshed) return demo('token expired and could not be refreshed');
      accessToken = refreshed;
    } else if (expiring) {
      return demo('token expired; reconnect');
    }
    return { id: row.id, platform, status, mode: 'live', demoReason: null, credentials: { accessToken, refreshToken, externalAccountId: row.external_account_id } };
  } catch (error) {
    await db.from('channel_connections').update({ status: 'error', last_error: error instanceof Error ? error.message : String(error) }).eq('id', row.id);
    return demo('stored token could not be decrypted');
  }
}

export async function adAdapterFor(platform: CampaignPlatform, db: Db = adminDb()): Promise<{ adapter: AdAdapter; connection: ResolvedConnection }> {
  const connection = await resolveConnection(AD_CONNECTION[platform], db);
  const credentials: Credentials | null = connection.credentials;
  if (connection.mode === 'demo' || !credentials) return { adapter: demoAdAdapter(AD_CONNECTION[platform]), connection };
  switch (platform) {
    case 'meta': {
      const page = await resolveConnection('facebook', db);
      return { adapter: metaAdAdapter(credentials, page.credentials?.externalAccountId ?? null), connection };
    }
    case 'google': return { adapter: googlePmaxAdapter(credentials), connection };
    case 'tiktok': return { adapter: tiktokAdAdapter(credentials), connection };
    case 'lsa': return { adapter: lsaAdapter(credentials), connection };
  }
}

export async function postAdapterFor(platform: SocialPlatform, db: Db = adminDb()): Promise<{ adapter: PostAdapter; connection: ResolvedConnection }> {
  const connection = await resolveConnection(platform, db);
  const credentials = connection.credentials;
  if (connection.mode === 'demo' || !credentials) return { adapter: demoPostAdapter(platform), connection };
  switch (platform) {
    case 'instagram': return { adapter: instagramPostAdapter(credentials), connection };
    case 'facebook': return { adapter: facebookPostAdapter(credentials), connection };
    case 'gbp': return { adapter: gbpPostAdapter(credentials), connection };
    case 'tiktok': return { adapter: tiktokPostAdapter(credentials), connection };
  }
}

export interface ConnectionView {
  platform: ConnectionPlatform;
  status: ConnectionStatus;
  accountName: string | null;
  scopes: string[];
  tokenExpiresAt: string | null;
  lastError: string | null;
  requirements: PlatformRequirements;
}

/** Safe for the admin UI: no token columns are selected. */
export async function listConnections(db: Db = adminDb()): Promise<ConnectionView[]> {
  const { data } = await db.from('channel_connections').select('platform, status, account_name, scopes, token_expires_at, last_error');
  const byPlatform = new Map((data ?? []).map((row) => [row.platform, row]));
  return (Object.keys(PLATFORM_REQUIREMENTS) as ConnectionPlatform[]).map((platform) => {
    const row = byPlatform.get(platform);
    return {
      platform,
      status: (row?.status ?? 'not_connected') as ConnectionStatus,
      accountName: row?.account_name ?? null,
      scopes: row?.scopes ?? [],
      tokenExpiresAt: row?.token_expires_at ?? null,
      lastError: row?.last_error ?? null,
      requirements: PLATFORM_REQUIREMENTS[platform],
    };
  });
}

export interface SaveConnectionInput {
  platform: ConnectionPlatform;
  accessToken: string;
  refreshToken?: string | null;
  externalAccountId: string;
  accountName: string;
  scopes: string[];
  expiresAt?: string | null;
  connectedBy: string;
}

/** Stores OAuth results encrypted. Called from the OAuth callback (admin-only). */
export async function saveConnection(input: SaveConnectionInput, db: Db = adminDb()): Promise<Result> {
  try {
    const { error } = await db.from('channel_connections').upsert({
      platform: input.platform, status: 'connected', account_name: input.accountName, external_account_id: input.externalAccountId, scopes: input.scopes,
      access_token_encrypted: encryptToken(input.accessToken), refresh_token_encrypted: input.refreshToken ? encryptToken(input.refreshToken) : null,
      token_key_id: keyId(), token_expires_at: input.expiresAt ?? null, last_error: null, connected_by: input.connectedBy,
    }, { onConflict: 'platform' });
    return error ? { ok: false, error: error.message } : { ok: true, data: undefined };
  } catch (error) {
    return fail(error);
  }
}

export async function setConnectionMode(platform: ConnectionPlatform, status: 'not_connected' | 'demo' | 'revoked', db: Db = adminDb()): Promise<Result> {
  const wipe = status !== 'demo' ? { access_token_encrypted: null, refresh_token_encrypted: null, token_expires_at: null } : {};
  const { error } = await db.from('channel_connections').upsert({ platform, status, ...wipe }, { onConflict: 'platform' });
  return error ? { ok: false, error: error.message } : { ok: true, data: undefined };
}

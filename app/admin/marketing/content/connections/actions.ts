'use server';

import { revalidatePath } from 'next/cache';
import { type ActionState, InputError, guard, oneOf, requiredText, text } from '@/components/admin/core/parse';
import { requireRole } from '@/lib/auth';
import { saveConnection, setConnectionMode } from '@/lib/marketing/content/channels/registry';
import { PLATFORM_REQUIREMENTS } from '@/lib/marketing/content/channels/scopes';
import type { ConnectionPlatform } from '@/lib/marketing/content/channels/types';
import { hasTokenKey } from '@/lib/marketing/content/crypto';

const PLATFORMS = Object.keys(PLATFORM_REQUIREMENTS) as ConnectionPlatform[];

function refresh() {
  revalidatePath('/admin/marketing', 'layout');
}

/** Stores platform credentials encrypted. Tokens are write-only: never read back to the browser. */
export async function connectPlatform(_prev: ActionState, form: FormData): Promise<ActionState> {
  const viewer = await requireRole('admin');
  return guard(async () => {
    const platform = oneOf(form, 'platform', PLATFORMS, 'platform');
    if (!hasTokenKey()) throw new InputError('Set MARKETING_TOKEN_KEY on the server first. Tokens are never stored unencrypted.');
    const accessToken = requiredText(form, 'accessToken', 'Access token', 4000);
    const refreshToken = text(form, 'refreshToken', { max: 4000, label: 'Refresh token' });
    const externalAccountId = requiredText(form, 'accountId', 'Account ID', 120);
    const accountName = requiredText(form, 'accountName', 'Account name', 120);
    const scopes = (text(form, 'scopes', { max: 1000, label: 'Scopes' }) ?? PLATFORM_REQUIREMENTS[platform].scopes.join(','))
      .split(/[,\n]+/).map((s) => s.trim()).filter(Boolean).slice(0, 20);
    const expiresRaw = text(form, 'expiresOn', { max: 10, label: 'Expiry' });
    if (expiresRaw && !/^\d{4}-\d{2}-\d{2}$/.test(expiresRaw)) throw new InputError('Expiry is not a valid date.');
    if (/\s/.test(accessToken)) throw new InputError('Access token can’t contain spaces.');

    const result = await saveConnection({
      platform, accessToken, refreshToken, externalAccountId, accountName, scopes,
      expiresAt: expiresRaw ? new Date(`${expiresRaw}T23:59:59Z`).toISOString() : null, connectedBy: viewer.userId,
    });
    if (!result.ok) throw new InputError(result.error);
    refresh();
    return { notice: 'Connected. Token stored encrypted. Live posting runs only in production.' };
  });
}

export async function setMode(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const platform = oneOf(form, 'platform', PLATFORMS, 'platform');
    const mode = oneOf(form, 'mode', ['demo', 'not_connected'] as const, 'mode');
    const result = await setConnectionMode(platform, mode);
    if (!result.ok) throw new InputError(result.error);
    refresh();
    return { notice: mode === 'demo' ? 'Demo mode on.' : 'Disconnected. Token deleted.' };
  });
}

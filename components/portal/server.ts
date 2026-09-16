import 'server-only';
import { cache } from 'react';
import { createAdminClient } from '@/lib/supabase/admin';

export interface ShopRules {
  taxRate: number;
  openDays: number[];
}

/**
 * Shop settings a customer needs (tax rate, open days). Clients can't read
 * `shop_settings` under RLS, and these values are not sensitive, so they are
 * read with the service role and only these fields leave the server.
 */
export const getShopRules = cache(async (): Promise<ShopRules> => {
  const { data } = await createAdminClient().from('shop_settings').select('tax_rate, open_days').eq('id', 1).maybeSingle();
  return { taxRate: Number(data?.tax_rate ?? 0), openDays: data?.open_days ?? [1, 2, 3, 4, 5] };
});

/**
 * The assigned tech's display name. Profiles are staff-readable only, so this
 * uses the service role. Callers MUST have loaded the job through the RLS
 * client first (proving it belongs to the signed-in customer).
 */
export async function techName(techId: string | null): Promise<string | null> {
  if (!techId) return null;
  const { data } = await createAdminClient().from('profiles').select('full_name').eq('id', techId).maybeSingle();
  return data?.full_name?.trim() || null;
}

/** First client IP from the proxy chain. */
export function clientIp(forwardedFor: string | null): string | null {
  return forwardedFor?.split(',')[0]?.trim() || null;
}

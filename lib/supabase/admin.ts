import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/db/database.types';

/**
 * Service-role client. Bypasses RLS — only use after the caller's permission
 * has been verified in code, or for system work (automations, webhooks).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service credentials are not configured');
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

import 'server-only';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import type { Enums, Tables } from '@/lib/db/database.types';
import { createClient } from '@/lib/supabase/server';

export type Role = Enums<'app_role'>;

export interface Viewer {
  userId: string;
  profile: Tables<'profiles'>;
  /** Present for client accounts linked to a customer record. */
  customerId: string | null;
}

export const HOME_BY_ROLE: Record<Role, string> = {
  admin: '/admin',
  employee: '/shop',
  client: '/portal',
};

/** The signed-in user and their profile, or null. Cached per request. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return null;

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (!profile || !profile.active) return null;

  let customerId: string | null = null;
  if (profile.role === 'client') {
    const { data: customer } = await supabase.from('customers').select('id').eq('profile_id', userId).maybeSingle();
    customerId = customer?.id ?? null;
  }
  return { userId, profile, customerId };
});

/** Guards a page or action. Signed-out → /login; wrong role → that role's home. */
export async function requireRole(...roles: Role[]): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect('/login');
  if (!roles.includes(viewer.profile.role)) redirect(HOME_BY_ROLE[viewer.profile.role]);
  return viewer;
}

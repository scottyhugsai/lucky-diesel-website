'use server';

import { redirect } from 'next/navigation';
import { HOME_BY_ROLE, getViewer } from '@/lib/auth';
import { siteUrl } from '@/lib/site-url';
import { createClient } from '@/lib/supabase/server';

export interface LoginState {
  error?: string;
  notice?: string;
}

function safeNext(value: FormDataEntryValue | null): string | null {
  const next = typeof value === 'string' ? value : '';
  return next.startsWith('/') && !next.startsWith('//') ? next : null;
}

export async function signInWithPassword(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  if (!email || !password) return { error: 'Enter your email and password.' };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: 'That email and password don’t match.' };

  const viewer = await getViewer();
  if (!viewer) return { error: 'Your account isn’t active. Call the shop.' };
  redirect(safeNext(formData.get('next')) ?? HOME_BY_ROLE[viewer.profile.role]);
}

export async function sendMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { error: 'Enter a valid email.' };

  const supabase = await createClient();
  const next = safeNext(formData.get('next')) ?? '';
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: `${siteUrl()}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ''}` },
  });
  // Same response either way so the form can't be used to discover accounts.
  if (error) console.error(`[auth] magic link for ${email}: ${error.message}`);
  return { notice: 'If that email has an account, a sign-in link is on its way.' };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

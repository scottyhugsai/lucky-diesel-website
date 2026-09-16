import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/** Completes magic-link and invite sign-ins. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = searchParams.get('next');
  const destination = next?.startsWith('/') && !next.startsWith('//') ? next : '/login';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(destination === '/login' ? '/login?signed_in=1' : destination, origin));
    console.error(`[auth] code exchange failed: ${error.message}`);
  }
  return NextResponse.redirect(new URL('/login?error=link', origin));
}

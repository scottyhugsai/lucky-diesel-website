import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { captureAttribution } from '@/lib/marketing/core/capture';

const PROTECTED = ['/portal', '/shop', '/admin'];
/** Paths that need the Supabase session refreshed (the original matcher). */
const SESSION_PATHS = [...PROTECTED, '/login', '/auth'];

const matchesPrefix = (path: string, prefixes: readonly string[]) => prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

/** Refreshes the Supabase session cookie and bounces signed-out users from app areas. */
async function sessionProxy(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims?.sub);
  const path = request.nextUrl.pathname;

  if (!isSignedIn && matchesPrefix(path, PROTECTED)) {
    const login = request.nextUrl.clone();
    login.pathname = '/login';
    login.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(login);
  }

  return response;
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (matchesPrefix(path, SESSION_PATHS)) return sessionProxy(request);

  // Public pages: first-party UTM / click-id capture only.
  const response = NextResponse.next({ request });
  captureAttribution(request, response);
  return response;
}

export const config = {
  matcher: [
    '/portal/:path*', '/shop/:path*', '/admin/:path*', '/login', '/auth/:path*',
    // Public pages, excluding APIs, short links, Next internals and static files.
    '/((?!api/|r/|_next/|_vercel/|.*\\.[A-Za-z0-9]+$).*)',
  ],
};

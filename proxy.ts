import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { captureAttribution } from '@/lib/marketing/core/capture';
import { contentSecurityPolicy } from '@/lib/security-headers';

const PROTECTED = ['/portal', '/shop', '/admin'];
/** Paths that need the Supabase session refreshed (the original matcher). */
const SESSION_PATHS = [...PROTECTED, '/login', '/auth'];

const matchesPrefix = (path: string, prefixes: readonly string[]) => prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

/**
 * A fresh nonce per request, handed to Next through the request header it reads
 * when rendering its own script tags. Reusing one across requests would defeat
 * the point, so this is generated here and never cached.
 */
function withCsp(request: NextRequest): { requestHeaders: Headers; csp: string } {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = contentSecurityPolicy(nonce, process.env.NODE_ENV === 'development');
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', csp);
  return { requestHeaders, csp };
}

/** Refreshes the Supabase session cookie and bounces signed-out users from app areas. */
async function sessionProxy(request: NextRequest, headers: Headers, csp: string): Promise<NextResponse> {
  let response = NextResponse.next({ request: { headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers } });
          response.headers.set('content-security-policy', csp);
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

  response.headers.set('content-security-policy', csp);
  return response;
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const { requestHeaders, csp } = withCsp(request);
  if (matchesPrefix(path, SESSION_PATHS)) return sessionProxy(request, requestHeaders, csp);

  // Public pages: first-party UTM / click-id capture only.
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('content-security-policy', csp);
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

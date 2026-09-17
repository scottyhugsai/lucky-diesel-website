import { NextResponse, type NextRequest } from 'next/server';
import { isShortCode, resolveShortLink } from '@/lib/marketing/core/links';
import { siteUrl } from '@/lib/site-url';

/** Branded short link: counts the click, credits the campaign send, redirects with UTMs. */
export async function GET(request: NextRequest, ctx: RouteContext<'/r/[code]'>) {
  const { code } = await ctx.params;
  if (!isShortCode(code)) return NextResponse.redirect(new URL('/', siteUrl()), 302);
  const target = await resolveShortLink(code, request.nextUrl.searchParams.get('t')).catch((error: unknown) => {
    console.error(`[marketing] short link ${code} failed: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  });
  const response = NextResponse.redirect(target ?? new URL('/', siteUrl()), 302);
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('X-Robots-Tag', 'noindex');
  return response;
}

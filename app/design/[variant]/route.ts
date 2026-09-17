import { NextResponse, type NextRequest } from 'next/server';
import { DESIGN_COOKIE, isDesign } from '@/lib/design';

const YEAR = 60 * 60 * 24 * 365;

/** /design/v2?next=/store switches the public site's design (shareable link for the pitch). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ variant: string }> }) {
  const { variant } = await params;
  const nextParam = request.nextUrl.searchParams.get('next') ?? '/';
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/';
  const response = NextResponse.redirect(new URL(next, request.nextUrl.origin));
  if (isDesign(variant)) response.cookies.set(DESIGN_COOKIE, variant, { path: '/', maxAge: YEAR, sameSite: 'lax' });
  return response;
}

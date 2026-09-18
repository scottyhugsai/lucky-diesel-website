import { NextResponse, type NextRequest } from 'next/server';
import { parseFitment } from '@/lib/fitment/select';
import {
  encodeTruck,
  safeReturnPath,
  TRUCK_COOKIE,
  TRUCK_COOKIE_MAX_AGE,
  truckFromFitment,
  truckFromSelection,
} from '@/lib/fitment/truck-cookie';

/**
 * Remembering and forgetting the visitor's truck.
 *
 * A plain form POST answered with a redirect, rather than a Server Action: the
 * pages that read this cookie are rendered from it, and only a fresh request
 * reads a cookie the same response just set. This behaves identically with
 * JavaScript on and off, which is the whole point of the picker.
 */

export async function POST(request: NextRequest): Promise<Response> {
  // A cross-site post could only change someone's shopping preference, but there
  // is no reason to accept one.
  const origin = request.headers.get('origin');
  if (origin && origin !== request.nextUrl.origin) return new NextResponse(null, { status: 403 });

  const form = await request.formData();
  const text = (key: string): string | undefined => {
    const value = form.get(key);
    return typeof value === 'string' ? value : undefined;
  };

  const to = safeReturnPath(text('to'));
  const response = NextResponse.redirect(new URL(to, request.nextUrl), 303);
  // Relative, so a proxy in front of the app cannot send the visitor to its own host.
  response.headers.set('Location', to);

  if (text('clear') === '1') {
    response.cookies.set(TRUCK_COOKIE, '', { path: '/', maxAge: 0 });
    return response;
  }

  const fitment = parseFitment({
    year: text('year'),
    make: text('make'),
    model: text('model'),
    engine: text('engine'),
  });
  const saved = truckFromFitment(fitment) ?? truckFromSelection(text('platform'), text('gen'));
  if (saved) {
    response.cookies.set(TRUCK_COOKIE, encodeTruck(saved), {
      path: '/',
      sameSite: 'lax',
      maxAge: TRUCK_COOKIE_MAX_AGE,
      // Deliberately readable by the page: the store's own truck pickers keep it in step.
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
    });
  }
  return response;
}

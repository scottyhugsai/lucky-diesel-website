import { NextResponse } from 'next/server';
import { decodeVinWithNhtsa } from '@/components/admin/core/vin';
import { cleanVin } from '@/lib/marketing/engage/rules';
import { clientIp, createThrottle } from '@/lib/marketing/core/requests';

const throttled = createThrottle(10 * 60_000, 15);

/** Public VIN decode for the quote form (free NHTSA vPIC). Returns only vehicle facts. */
export async function GET(request: Request) {
  if (throttled(clientIp(request) ?? 'unknown')) return NextResponse.json({ ok: false, error: 'Too many lookups. Pick your truck below.' }, { status: 429 });
  const vin = cleanVin(new URL(request.url).searchParams.get('vin'));
  if (!vin) return NextResponse.json({ ok: false, error: 'VINs are 17 letters and numbers.' }, { status: 422 });
  const result = await decodeVinWithNhtsa(vin);
  if ('error' in result) return NextResponse.json({ ok: false, error: 'Couldn’t decode that VIN. Pick your truck below.' }, { status: 502 });
  const { year, make, model, platform, generation } = result.data;
  return NextResponse.json({ ok: true, vin, year, make, model, platform, generation }, { headers: { 'Cache-Control': 'private, max-age=3600' } });
}

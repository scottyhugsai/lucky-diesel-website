import { NextResponse, type NextRequest } from 'next/server';
import { getAvailableSlots } from '@/lib/domain/appointments';

/** Public: open appointment times for a shop-local date (YYYY-MM-DD). Times only, no customer data. */
export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get('date') ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ slots: [] }, { status: 400 });
  const slots = await getAvailableSlots(date);
  return NextResponse.json(
    { slots: slots.map((slot) => ({ startsAt: slot.startsAt.toISOString(), label: slot.label })) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

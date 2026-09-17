import { NextResponse } from 'next/server';
import { ATTRIBUTION_COOKIE, decodeAttributionCookie } from '@/lib/marketing/core/attribution-touch';
import { readCookie } from '@/lib/marketing/core/requests';
import { assignSlot, getPublicEngagement } from '@/lib/marketing/engage/data';
import { AB_SLOTS } from '@/lib/marketing/engage/rules';

/**
 * Per-visitor form config: price ranges, financing link, and this visitor's A/B
 * variant per slot (bucketed on the first-party anonymous id).
 */
export async function GET(request: Request) {
  const config = await getPublicEngagement();
  const visitorId = decodeAttributionCookie(readCookie(request, ATTRIBUTION_COOKIE))?.aid ?? null;
  const ab = Object.fromEntries(AB_SLOTS.flatMap((slot) => {
    const assigned = assignSlot(config.abTests, slot.id, visitorId);
    return assigned ? [[slot.id, { testId: assigned.testId, text: assigned.text }]] : [];
  }));
  return NextResponse.json(
    { priceRanges: config.priceRanges, financingUrl: config.financingUrl, ab },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}

import { NextResponse } from 'next/server';
import { getViewer } from '@/lib/auth';
import { siteUrl } from '@/lib/site-url';
import { getCatalog } from '@/lib/store/catalog';
import { productFeedTsv } from '@/lib/store/compliance';
import { loadComplianceMap } from '@/lib/store/compliance-service';

/**
 * Google Merchant Center / Meta catalog feed. Admin-only download: unverified
 * and off-road-only parts are left out by `productFeedTsv`.
 */
export async function GET() {
  const viewer = await getViewer();
  if (!viewer || viewer.profile.role !== 'admin') return NextResponse.json({ error: 'Not allowed' }, { status: 403 });

  const [{ products, ok }, map] = await Promise.all([getCatalog(), loadComplianceMap()]);
  if (!ok) return NextResponse.json({ error: 'Catalog unavailable' }, { status: 503 });

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(productFeedTsv(products, map, siteUrl()), {
    headers: {
      'Content-Type': 'text/tab-separated-values; charset=utf-8',
      'Content-Disposition': `attachment; filename="lucky-diesel-product-feed-${stamp}.tsv"`,
      'Cache-Control': 'no-store',
    },
  });
}

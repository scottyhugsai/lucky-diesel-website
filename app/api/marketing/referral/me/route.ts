import { NextResponse } from 'next/server';
import { getViewer } from '@/lib/auth';
import { referralShareUrl, type ReferralShare } from '@/lib/marketing/core/referral-share';
import { ensureReferralCode } from '@/lib/marketing/core/referrals';
import { getMarketingSettings } from '@/lib/marketing/core/settings';
import { createAdminClient } from '@/lib/supabase/admin';
import { siteUrl } from '@/lib/site-url';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

/**
 * The signed-in client's own referral link (created on first use). Anyone else
 * gets a generic share link. Never looks a code up by phone or email.
 */
export async function POST() {
  const generic: ReferralShare = { code: null, url: referralShareUrl(siteUrl(), null), discountCents: 0 };
  try {
    const viewer = await getViewer();
    if (!viewer || viewer.profile.role !== 'client' || !viewer.customerId) return NextResponse.json(generic, { headers: NO_STORE });
    const db = createAdminClient();
    const [result, settings] = await Promise.all([ensureReferralCode(viewer.customerId, db), getMarketingSettings(db)]);
    if (!result.ok) {
      console.error(`[marketing] referral code for ${viewer.customerId} failed: ${result.error}`);
      return NextResponse.json(generic, { headers: NO_STORE });
    }
    const share: ReferralShare = { code: result.code, url: referralShareUrl(siteUrl(), result.code), discountCents: settings.refereeDiscountCents };
    return NextResponse.json(share, { headers: NO_STORE });
  } catch (error) {
    console.error(`[marketing] referral share failed: ${error instanceof Error ? error.message : String(error)}`);
    return NextResponse.json(generic, { headers: NO_STORE });
  }
}

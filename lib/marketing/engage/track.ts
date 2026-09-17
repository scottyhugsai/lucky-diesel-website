import 'server-only';
import type { Db } from '@/lib/marketing/core/settings';
import { PRIVACY_VERSION } from './privacy';
import { abBucket, parseVariants } from './rules';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A/B exposures and conversions, popup views/clicks and cookie-consent choices.
 * The visitor id always comes from the first-party cookie, and the A/B variant is
 * recomputed here, so a client can't pick or spoof its bucket.
 */
export async function recordEngagementEvent(db: Db, event: string, body: Record<string, unknown>, visitorId: string): Promise<boolean> {
  if (event === 'consent') {
    const { error } = await db.from('site_consent_log').insert({
      visitor_id: visitorId, analytics: body.analytics === true, ads: body.ads === true, policy_version: PRIVACY_VERSION,
    });
    return !error;
  }

  if (event === 'popup_view' || event === 'popup_click') {
    if (typeof body.popupId !== 'string' || !UUID.test(body.popupId)) return false;
    const { data: popup } = await db.from('site_popups').select('id, views, clicks').eq('id', body.popupId).eq('active', true).maybeSingle();
    if (!popup) return false;
    const patch = event === 'popup_view' ? { views: popup.views + 1 } : { clicks: popup.clicks + 1 };
    const { error } = await db.from('site_popups').update(patch).eq('id', popup.id);
    return !error;
  }

  if (typeof body.testId !== 'string' || !UUID.test(body.testId)) return false;
  const { data: test } = await db.from('ab_tests').select('id, variants, active').eq('id', body.testId).maybeSingle();
  const variants = parseVariants(test?.variants);
  if (!test?.active || !variants.length) return false;
  const variant = variants[abBucket(visitorId, test.id, variants.length)]!.key;
  const { error } = await db.from('ab_events').upsert(
    { test_id: test.id, variant, kind: event === 'ab_exposure' ? 'exposure' : 'conversion', visitor_id: visitorId },
    { onConflict: 'test_id,visitor_id,kind', ignoreDuplicates: true },
  );
  return !error;
}

import { cookies } from 'next/headers';
import { ATTRIBUTION_COOKIE, decodeAttributionCookie } from '@/lib/marketing/core/attribution-touch';
import { getPublicEngagement } from '@/lib/marketing/engage/data';
import { numberForSource } from '@/lib/marketing/engage/rules';
import { hasAnyTag, tagConfig } from '@/lib/marketing/engage/tags';
import { PRIVACY_VERSION } from '@/lib/marketing/engage/privacy';
import { getWidgetContent } from './widget-data';
import { WidgetsClient } from './WidgetsClient';

import type { Design } from '@/lib/design';

/**
 * Site-wide visitor widgets: chat bubble, exit/timed offers, announcement bar,
 * cookie choice with the tag loader, resume card and social proof. Mounted once
 * in the public layout; heavy parts load only when they open.
 */
export async function MarketingWidgets({ design }: { design: Design }) {
  const [content, engagement, jar] = await Promise.all([getWidgetContent(), getPublicEngagement(), cookies()]);
  const tags = tagConfig();
  // The attribution cookie is httpOnly, so the swap-in number is resolved here.
  const source = decodeAttributionCookie(jar.get(ATTRIBUTION_COOKIE)?.value)?.lt?.source ?? null;
  const dynamicPhone = numberForSource(engagement.trackingNumbers, source)?.phone ?? null;
  return (
    <WidgetsClient
      design={design}
      magnet={content.magnet}
      offer={content.offer}
      announcement={engagement.announcement}
      popups={engagement.popups}
      socialProof={engagement.socialProof}
      dynamicPhone={dynamicPhone}
      tags={hasAnyTag(tags) ? tags : null}
      privacyVersion={PRIVACY_VERSION}
    />
  );
}

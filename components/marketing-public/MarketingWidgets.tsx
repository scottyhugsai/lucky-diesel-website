import { getWidgetContent } from './widget-data';
import { WidgetsClient } from './WidgetsClient';

type Design = 'v1' | 'v2' | 'v3';

/**
 * Site-wide visitor widgets: text-us bubble, exit/timed offer, referral capture.
 * Mounted once in the public layout. Heavy parts load only when opened.
 */
export async function MarketingWidgets({ design }: { design: Design }) {
  const content = await getWidgetContent();
  return <WidgetsClient design={design} magnet={content.magnet} offer={content.offer} />;
}

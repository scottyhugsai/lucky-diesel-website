import 'server-only';
import { getReviewWidget } from '@/lib/marketing/content/reputation-service';
import { ReviewStripView } from './ReviewStripView';

/**
 * Drop-in reviews section for any design. Real reviews only (Google, Facebook,
 * owner-entered); sample and private feedback never reach it. Renders nothing when empty.
 */
export async function ReviewStrip({ limit = 6, heading }: { limit?: number; heading?: string }) {
  const widget = await getReviewWidget(limit).catch((error: unknown) => {
    console.error(`[marketing] review strip failed: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  });
  if (!widget) return null;
  return <ReviewStripView widget={widget} heading={heading} />;
}

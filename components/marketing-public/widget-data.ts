import 'server-only';
import { unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';

export interface WidgetMagnet {
  slug: string;
  title: string;
  description: string;
}

export interface WidgetOffer {
  headline: string;
  valueLabel: string;
  href: string;
}

export interface WidgetContent {
  magnet: WidgetMagnet | null;
  offer: WidgetOffer | null;
}

const REVALIDATE_SECONDS = 300;

async function load(): Promise<WidgetContent> {
  const db = createAdminClient();
  const now = Date.now();
  const [{ data: magnets }, { data: pages }] = await Promise.all([
    db.from('lead_magnets').select('id, slug, title, description').eq('published', true).order('created_at', { ascending: false }).limit(10),
    db.from('landing_pages').select('slug, offer, lead_magnet_id').eq('published', true).not('offer', 'is', null).order('published_at', { ascending: false }).limit(10),
  ]);
  const livePages = (pages ?? []).filter((p) => {
    const offer = p.offer as { endsAt?: unknown; headline?: unknown; valueLabel?: unknown } | null;
    if (!offer || typeof offer.headline !== 'string' || typeof offer.valueLabel !== 'string') return false;
    return typeof offer.endsAt !== 'string' || new Date(offer.endsAt).getTime() + 86_400_000 > now;
  });
  // Prefer a checklist tied to a live offer page, then the newest checklist.
  const linked = (magnets ?? []).find((m) => livePages.some((p) => p.lead_magnet_id === m.id));
  const magnet = linked ?? magnets?.[0] ?? null;
  const page = livePages[0];
  const offer = page ? (page.offer as { headline: string; valueLabel: string }) : null;
  return {
    magnet: magnet ? { slug: magnet.slug, title: magnet.title, description: magnet.description } : null,
    offer: page && offer ? { headline: offer.headline, valueLabel: offer.valueLabel, href: `/l/${page.slug}#claim` } : null,
  };
}

/** Cached for five minutes so the site-wide widgets don't add a query per page view. */
export const getWidgetContent = unstable_cache(async (): Promise<WidgetContent> => {
  try {
    return await load();
  } catch (error) {
    console.error(`[marketing] widget content failed: ${error instanceof Error ? error.message : String(error)}`);
    return { magnet: null, offer: null };
  }
}, ['marketing-widget-content'], { revalidate: REVALIDATE_SECONDS });

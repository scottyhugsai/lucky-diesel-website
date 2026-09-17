import 'server-only';
import { parseAnnouncement, parsePriceRanges, parseVariants } from '@/lib/marketing/engage/rules';
import { createAdminClient } from '@/lib/supabase/admin';
import type { SiteData } from './SitePanels';

/** Everything the Pages › Site tab edits. Read-only; the actions do the writing. */
export async function loadSiteData(): Promise<SiteData> {
  const db = createAdminClient();
  const [{ data: settings }, { data: popups }, { data: tests }, { data: events }] = await Promise.all([
    db.from('site_engagement').select('announcement, social_proof, financing_url, price_ranges').eq('id', 1).maybeSingle(),
    db.from('site_popups').select('id, name, path_prefix, trigger, trigger_value, active, views, clicks').order('created_at', { ascending: false }).limit(30),
    db.from('ab_tests').select('id, name, slot, variants, active').order('created_at', { ascending: false }).limit(20),
    db.from('ab_events').select('test_id, variant, kind').limit(5000),
  ]);

  return {
    announcement: parseAnnouncement(settings?.announcement),
    socialProof: settings?.social_proof ?? false,
    financingUrl: settings?.financing_url ?? null,
    priceRanges: parsePriceRanges(settings?.price_ranges),
    popups: (popups ?? []).map((p) => ({
      id: p.id, name: p.name, pathPrefix: p.path_prefix, trigger: p.trigger, triggerValue: p.trigger_value, active: p.active, views: p.views, clicks: p.clicks,
    })),
    tests: (tests ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      slot: t.slot,
      variants: parseVariants(t.variants),
      active: t.active,
      events: (events ?? []).filter((e) => e.test_id === t.id).map((e) => ({ variant: e.variant, kind: e.kind })),
    })),
  };
}

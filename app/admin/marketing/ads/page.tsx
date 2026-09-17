import Link from 'next/link';
import { Badge, Card, EmptyState, PageHeader } from '@/components/app/ui';
import { GeneratorBadge, SectionTabs, StatusBadge } from '@/components/admin/marketing/studio/Bits';
import { CreateAdWizard, type WizardData } from '@/components/admin/marketing/studio/CreateAdWizard';
import { DemoBanner } from '@/components/admin/marketing/studio/DemoBanner';
import { ADS_TABS, AD_PLATFORM_LABEL, creativeImage } from '@/components/admin/marketing/studio/labels';
import { requireRole } from '@/lib/auth';
import { money, relativeTime } from '@/lib/format';
import { adminDb } from '@/lib/marketing/content/db';
import { offerFromLanding } from '@/lib/marketing/content/creative-service';
import type { AdPlatform, OfferRef } from '@/lib/marketing/content/types';
import { getCatalog } from '@/lib/store/catalog';
import { generateAd } from './actions';

export const metadata = { title: 'Ad studio | Lucky Diesel admin' };

async function wizardData(): Promise<WizardData> {
  const db = adminDb();
  const [catalog, { data: builds }, { data: pages }] = await Promise.all([
    getCatalog(),
    db.from('builds').select('id, title, vehicle_label').eq('published', true).order('created_at', { ascending: false }).limit(30),
    db.from('landing_pages').select('slug, offer').eq('published', true).not('offer', 'is', null),
  ]);
  return {
    products: catalog.products.filter((p) => p.available && !p.offRoadOnly).slice(0, 60).map((p) => ({ handle: p.handle, title: p.title, price: money(p.priceMinCents, { whole: true }) })),
    builds: (builds ?? []).map((b) => ({ id: b.id, title: b.title, vehicle: b.vehicle_label })),
    offers: (pages ?? []).map((p) => offerFromLanding(p)).filter((o): o is OfferRef => o !== null).map((o) => ({ slug: o.landingSlug ?? '', headline: o.headline, value: o.valueLabel })),
  };
}

export default async function AdStudioPage() {
  await requireRole('admin');
  const db = adminDb();
  const [data, { data: creatives }] = await Promise.all([
    wizardData(),
    db.from('ad_creatives').select('id, name, platform, status, generator, created_at, is_sample, ad_creative_variants(id, compliance_status)').order('created_at', { ascending: false }).limit(12),
  ]);

  return (
    <>
      <PageHeader kicker="Marketing · Ads" title="Ad studio" description="Make ads from real shop data." />
      <SectionTabs tabs={ADS_TABS} active="/admin/marketing/ads" />
      <DemoBanner platforms={['meta_ads', 'google_ads', 'tiktok_ads']} what="ad spend and results" />
      <CreateAdWizard data={data} action={generateAd} />

      <Card title="Recent ads" className="mt-8">
        {!creatives?.length ? (
          <EmptyState title="No ads yet">Make your first one above.</EmptyState>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {creatives.map((c) => {
              const blocked = c.ad_creative_variants.filter((v) => v.compliance_status === 'block').length;
              return (
                <li key={c.id}>
                  <Link href={`/admin/marketing/ads/creative/${c.id}`} className="group flex gap-3 rounded-sm border border-line bg-carbon p-3 transition-colors hover:border-clover">
                    {/* eslint-disable-next-line @next/next/no-img-element -- PNG rendered on demand by our image route; next/image can't optimize an auth-gated dynamic route. */}
                    <img src={creativeImage(c.id, '1:1')} alt="" width={80} height={80} loading="lazy" className="size-20 shrink-0 rounded-sm bg-gunmetal object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold group-hover:text-clover">{c.name}</p>
                      <p className="text-sm text-chalk/60">{AD_PLATFORM_LABEL[c.platform as AdPlatform] ?? c.platform} · {relativeTime(c.created_at)}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <StatusBadge status={c.status} />
                        <GeneratorBadge generator={c.generator} />
                        {blocked > 0 && <Badge tone="bad">{blocked} blocked</Badge>}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}

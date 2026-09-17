import { Card, EmptyState, PageHeader } from '@/components/app/ui';
import { Notice, SectionTabs } from '@/components/admin/marketing/studio/Bits';
import { CampaignCard, type CampaignView } from '@/components/admin/marketing/studio/CampaignCard';
import { CampaignForm, GuardForm } from '@/components/admin/marketing/studio/CampaignForm';
import { DemoBanner } from '@/components/admin/marketing/studio/DemoBanner';
import { SeasonBudget } from '@/components/admin/marketing/studio/SeasonBudget';
import { ADS_TABS, CAMPAIGN_FOR_CREATIVE } from '@/components/admin/marketing/studio/labels';
import { requireRole } from '@/lib/auth';
import { describeTargeting, parseTargeting } from '@/lib/marketing/content/ad-presets';
import { loadSeasonMultipliers, pendingProposals } from '@/lib/marketing/content/budget-service';
import { adminDb, isCampaignPlatform, loadGuards } from '@/lib/marketing/content/db';
import type { AdPlatform } from '@/lib/marketing/content/types';
import { activate, createCampaign, decideSeason, pause, proposeSeasons, publishToCampaign, resubmitCampaign, saveGuard, saveSeasons } from './actions';

export const metadata = { title: 'Campaigns | Lucky Diesel admin' };

const GUARD_ROWS = [
  { platform: 'all', label: 'Whole shop' },
  { platform: 'meta', label: 'Meta' },
  { platform: 'google', label: 'Google' },
  { platform: 'tiktok', label: 'TikTok' },
];

export default async function CampaignsPage() {
  await requireRole('admin');
  const db = adminDb();
  const [{ data: rows }, { data: creatives }, guards, seasons, proposals] = await Promise.all([
    db.from('ad_campaigns').select('*, ad_publications(id)').neq('status', 'archived').order('created_at', { ascending: false }),
    db.from('ad_creatives').select('id, name, platform').in('status', ['approved', 'scheduled', 'paused', 'live']).order('created_at', { ascending: false }),
    loadGuards(db),
    loadSeasonMultipliers(db),
    pendingProposals(db),
  ]);

  const campaigns: CampaignView[] = (rows ?? []).filter((c) => isCampaignPlatform(c.platform)).map((c) => {
    const targeting = parseTargeting(c.audience);
    return {
      id: c.id, name: c.name, platform: c.platform as CampaignView['platform'], status: c.status, objective: c.objective, dailyBudgetCents: c.daily_budget_cents,
      startsOn: c.starts_on, endsOn: c.ends_on, simulated: c.simulated, notes: c.notes, radiusMiles: targeting.radiusMiles, targeting: describeTargeting(targeting), publications: c.ad_publications.length,
    };
  });
  const ads = campaigns.filter((c) => c.platform !== 'lsa');
  const lsa = campaigns.filter((c) => c.platform === 'lsa');
  const creativesFor = (platform: string) => (creatives ?? []).filter((c) => CAMPAIGN_FOR_CREATIVE[c.platform as AdPlatform] === platform);
  const actions = { publish: publishToCampaign, activate, pause, resubmit: resubmitCampaign };

  return (
    <>
      <PageHeader kicker="Marketing · Ads" title="Campaigns" description="Approve, attach ads, then activate." />
      <SectionTabs tabs={ADS_TABS} active="/admin/marketing/ads/campaigns" />
      <DemoBanner platforms={['meta_ads', 'google_ads', 'tiktok_ads']} what="campaigns and spend" />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_26rem] xl:items-start">
        <section aria-labelledby="camp-list" className="min-w-0">
          <h2 id="camp-list" className="kicker mb-3">Your campaigns · {ads.length}</h2>
          {!ads.length ? (
            <EmptyState title="No campaigns yet">Create one with the form.</EmptyState>
          ) : (
            <ul className="grid gap-3 lg:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              {ads.map((c) => <CampaignCard key={c.id} campaign={c} creatives={creativesFor(c.platform)} actions={actions} />)}
            </ul>
          )}

          <Card title="Local Services Ads" className="mt-6">
            <p className="text-sm text-chalk/70">Read-only. Google doesn’t allow creating LSA ads by API. Leads and spend import once connected.</p>
            {lsa.length > 0 && <ul className="mt-3 grid gap-2">{lsa.map((c) => <li key={c.id} className="text-sm">{c.name} · {c.status}</li>)}</ul>}
          </Card>
        </section>

        <div className="grid gap-6">
          <Card title="New campaign">
            <CampaignForm action={createCampaign} guards={guards} />
          </Card>
          <Card title="Budget caps">
            <p className="mb-3 text-sm text-chalk/60">Hard limits. Publishing and activating check these first.</p>
            {!guards.length && <Notice tone="warn" title="No caps set">Set one before any campaign can publish.</Notice>}
            <div className="grid gap-2">
              {GUARD_ROWS.map((row) => (
                <GuardForm key={row.platform} action={saveGuard} label={row.label} guard={guards.find((g) => g.platform === row.platform) ?? { platform: row.platform, maxDailyCents: 0, maxMonthlyCents: 0, maxCampaignDays: 30, autoPauseCplCents: null }} />
              ))}
            </div>
          </Card>
          <Card title="Season budgets">
            <p className="mb-3 text-sm text-chalk/60">Month multipliers. Every change waits for your approval.</p>
            <SeasonBudget multipliers={seasons} proposals={proposals} saveAction={saveSeasons} proposeAction={proposeSeasons} decideAction={decideSeason} />
          </Card>
        </div>
      </div>
    </>
  );
}

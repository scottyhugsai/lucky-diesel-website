import { CalendarCheck, Megaphone, MessageSquare, Wand2 } from 'lucide-react';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import { Badge, ButtonLink, Card, EmptyState, PageHeader } from '@/components/app/ui';
import { Notice, SectionTabs } from '@/components/admin/marketing/studio/Bits';
import { ADS_TABS, AD_PLATFORM_LABEL, SOCIAL_LABEL } from '@/components/admin/marketing/studio/labels';
import { requireRole } from '@/lib/auth';
import { SEASONS } from '@/lib/marketing/content/copy-library';
import { proposeWeeklyPlan } from '@/lib/marketing/content/planner-service';
import type { PlanItem } from '@/lib/marketing/content/planner';
import type { AdPlatform, SocialPlatform } from '@/lib/marketing/content/types';
import { approveWeek } from './actions';

export const metadata = { title: 'Weekly autopilot | Lucky Diesel admin' };

function platformName(item: PlanItem): string {
  return item.type === 'ad' ? AD_PLATFORM_LABEL[item.platform as AdPlatform] ?? item.platform : SOCIAL_LABEL[item.platform as SocialPlatform] ?? item.platform;
}

function PlanList({ items, title, icon }: { items: readonly PlanItem[]; title: string; icon: React.ReactNode }) {
  return (
    <Card title={<span className="inline-flex items-center gap-2">{icon}{title} · {items.length}</span>}>
      {!items.length ? (
        <p className="text-sm text-chalk/55">Nothing this week.</p>
      ) : (
        <ol className="grid gap-2">
          {items.map((item) => (
            <li key={`${item.type}-${item.title}`} className="rounded-sm border border-line bg-carbon p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{item.title}</p>
                <Badge tone="info">{platformName(item)}</Badge>
              </div>
              <p className="mt-1 text-sm text-chalk/60">{item.reason}</p>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

export default async function AutopilotPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  await requireRole('admin');
  const { plan: wantsPlan } = await searchParams;
  const plan = wantsPlan === '1' ? await proposeWeeklyPlan() : null;
  const ads = plan?.items.filter((i) => i.type === 'ad') ?? [];
  const posts = plan?.items.filter((i) => i.type === 'social') ?? [];

  return (
    <>
      <PageHeader
        kicker="Marketing · Ads"
        title="Weekly autopilot"
        description="A week of ads and posts from real shop activity."
        actions={<ButtonLink href="/admin/marketing/ads/autopilot?plan=1" variant={plan ? 'secondary' : 'primary'}><Wand2 className="size-4" aria-hidden="true" />{plan ? 'Re-plan' : 'Plan my week'}</ButtonLink>}
      />
      <SectionTabs tabs={ADS_TABS} active="/admin/marketing/ads/autopilot" />

      {!plan ? (
        <EmptyState title="Plan my week" action={<ButtonLink href="/admin/marketing/ads/autopilot?plan=1"><Wand2 className="size-4" aria-hidden="true" />Plan my week</ButtonLink>}>
          Reads builds, dyno runs, offers and open bays. Proposes ads and posts.
        </EmptyState>
      ) : (
        <>
          {plan.season && <p className="kicker mb-3">In season: {SEASONS[plan.season].name}</p>}
          {plan.notes.map((note) => <Notice key={note} title={note} />)}
          <div className="grid gap-6 lg:grid-cols-2">
            <PlanList items={ads} title="Ads" icon={<Megaphone className="size-5 text-clover" aria-hidden="true" />} />
            <PlanList items={posts} title="Posts" icon={<MessageSquare className="size-5 text-clover" aria-hidden="true" />} />
          </div>
          {plan.items.length > 0 && (
            <Card title="Approve the whole week" className="mt-6">
              <ActionForm action={approveWeek} confirm={`Draft and approve ${plan.items.length} items? Ads still need a campaign to spend.`} className="grid gap-3">
                <p className="text-sm text-chalk/65">Drafts every item and approves it. Blocked wording is never approved.</p>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name="ack" className="mt-1 size-4" />
                  <span>Also approve items with wording or photo warnings. I’ll review them.</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  <PendingButton><CalendarCheck className="size-4" aria-hidden="true" />Approve all {plan.items.length}</PendingButton>
                  <ButtonLink href="/admin/marketing/ads/approvals" variant="ghost">Review one by one</ButtonLink>
                </div>
              </ActionForm>
            </Card>
          )}
        </>
      )}
    </>
  );
}

import { CheckCheck } from 'lucide-react';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import { EmptyState, PageHeader } from '@/components/app/ui';
import { ApprovalRow, type QueueItem } from '@/components/admin/marketing/studio/ApprovalRow';
import { SectionTabs } from '@/components/admin/marketing/studio/Bits';
import { ADS_TABS } from '@/components/admin/marketing/studio/labels';
import { requireRole } from '@/lib/auth';
import { listApprovalQueue } from '@/lib/marketing/content/approvals-service';
import { adminDb } from '@/lib/marketing/content/db';
import { approveAllClear, decide } from '../actions';

export const metadata = { title: 'Approvals | Lucky Diesel admin' };

const ORDER = ['ad_creative', 'ad_campaign', 'social_post', 'seo_content', 'review_reply', 'landing_page'];
const GROUP_LABEL: Record<string, string> = { ad_creative: 'Ads', ad_campaign: 'Campaigns', social_post: 'Social posts', seo_content: 'SEO pages', review_reply: 'Review replies', landing_page: 'Landing pages' };

async function loadQueue(): Promise<QueueItem[]> {
  const db = adminDb();
  const queue = await listApprovalQueue(db);
  const postIds = queue.filter((q) => q.subjectType === 'social_post').map((q) => q.subjectId);
  const { data: posts } = postIds.length ? await db.from('social_posts').select('id, needs_privacy_review, image_template').in('id', postIds) : { data: [] };
  const postById = new Map((posts ?? []).map((p) => [p.id, p]));
  return queue.map((q) => ({
    ...q,
    privacy: postById.get(q.subjectId)?.needs_privacy_review ?? false,
    hasImage: q.subjectType === 'ad_creative' || Boolean(postById.get(q.subjectId)?.image_template),
  }));
}

export default async function ApprovalsPage() {
  await requireRole('admin');
  const queue = await loadQueue();
  const clear = queue.filter((q) => q.compliance === 'pass' && !q.stale && !q.privacy).length;
  const groups = ORDER.map((type) => ({ type, items: queue.filter((q) => q.subjectType === type) })).filter((g) => g.items.length);

  return (
    <>
      <PageHeader
        kicker="Marketing · Approvals"
        title="Approvals"
        description="Nothing publishes until you approve it."
        actions={
          clear > 0 ? (
            <ActionForm action={approveAllClear} confirm={`Approve ${clear} items with no flags?`}>
              <PendingButton><CheckCheck className="size-4" aria-hidden="true" />Approve {clear} clear</PendingButton>
            </ActionForm>
          ) : undefined
        }
      />
      <SectionTabs tabs={ADS_TABS} active="/admin/marketing/ads/approvals" />
      <p className="mb-6 text-sm text-chalk/60">Approval locks the exact words and image. Any edit needs a new approval.</p>

      {!queue.length ? (
        <EmptyState title="All caught up">New ads, posts and pages land here.</EmptyState>
      ) : (
        <div className="grid gap-8">
          {groups.map((group) => (
            <section key={group.type} aria-labelledby={`q-${group.type}`}>
              <h2 id={`q-${group.type}`} className="kicker mb-3">{GROUP_LABEL[group.type] ?? group.type} · {group.items.length}</h2>
              <ul className="grid gap-3 xl:grid-cols-2">
                {group.items.map((item) => <ApprovalRow key={item.id} item={item} action={decide} />)}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

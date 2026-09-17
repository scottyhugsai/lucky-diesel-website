import { AddReviewForm } from '@/components/admin/marketing/growth-ui/AddReviewForm';
import { SubTabs } from '@/components/admin/marketing/growth-ui/kit';
import { NegativeAlerts, NpsCard, PolicyNote, WidgetPreview } from '@/components/admin/marketing/growth-ui/ReviewPanels';
import { ReviewItem } from '@/components/admin/marketing/growth-ui/ReviewItem';
import { ThemesCard, TestimonialsCard, VelocityCard } from '@/components/admin/marketing/growth-ui/ReputationOpsPanels';
import { loadReputationOps } from '@/components/admin/marketing/growth-ui/reputation-data';
import { REVIEW_FILTERS, loadReviewsOverview, type ReviewFilter } from '@/components/admin/marketing/growth-ui/reviews-data';
import { Card, EmptyState, PageHeader } from '@/components/app/ui';
import { requireRole } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const metadata = { title: 'Reviews | Lucky Diesel admin' };

const LABELS: Record<ReviewFilter, string> = { needs_reply: 'Needs reply', negative: 'Low ratings', all: 'All' };

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  await requireRole('admin');
  const { filter: raw } = await searchParams;
  const filter: ReviewFilter = (REVIEW_FILTERS as readonly string[]).includes(raw ?? '') ? (raw as ReviewFilter) : 'needs_reply';
  const [data, ops, { data: customerRows }] = await Promise.all([
    loadReviewsOverview(filter),
    loadReputationOps(),
    createAdminClient().from('customers').select('id, full_name').order('full_name').limit(300),
  ]);
  const customers = (customerRows ?? []).map((c) => ({ id: c.id, name: c.full_name }));

  return (
    <>
      <PageHeader kicker="Marketing" title="Reviews" description="Reply fast. Fix bad days. Ask everyone." />
      <PolicyNote />
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <SubTabs
            label="Review filter"
            active={filter}
            items={REVIEW_FILTERS.map((key) => ({ key, label: LABELS[key], href: `/admin/marketing/reviews?filter=${key}`, count: data.counts[key] }))}
          />
          {data.reviews.length === 0 ? (
            <EmptyState title="All caught up">Nothing here right now.</EmptyState>
          ) : (
            <ul className="grid gap-3">
              {data.reviews.map((review) => <ReviewItem key={review.id} review={review} />)}
            </ul>
          )}
          <div className="mt-6">
            <Card title="Add a review">
              <p className="mb-3 text-sm text-chalk/60">For reviews left in person or on Facebook.</p>
              <AddReviewForm />
            </Card>
          </div>
        </div>
        <aside className="grid grid-cols-1 content-start gap-6">
          <NegativeAlerts reviews={data.negatives} />
          <NpsCard nps={data.nps} requests={data.requests} />
          <WidgetPreview widget={data.widget} all={data.all} />
          <ThemesCard ops={ops} />
          <VelocityCard ops={ops} />
          <TestimonialsCard ops={ops} customers={customers} />
        </aside>
      </div>
    </>
  );
}

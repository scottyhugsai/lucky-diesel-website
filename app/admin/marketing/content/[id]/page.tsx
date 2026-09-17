import { notFound } from 'next/navigation';
import { Globe } from 'lucide-react';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import { Badge, ButtonLink, Card, PageHeader } from '@/components/app/ui';
import { ComplianceBadge, IssueList, SectionTabs, StatusBadge } from '@/components/admin/marketing/studio/Bits';
import { CONTENT_TABS } from '@/components/admin/marketing/studio/labels';
import { SeoEditor } from '@/components/admin/marketing/studio/SeoEditor';
import { requireRole } from '@/lib/auth';
import { adminDb } from '@/lib/marketing/content/db';
import { faqToText, sectionsToText, type FaqItem, type SeoSection } from '@/lib/marketing/content/seo';
import { checkSeoGuard } from '@/lib/marketing/content/seo-service';
import type { ClaimIssue, ComplianceStatus } from '@/lib/marketing/content/types';
import { publishSeo, saveSeo } from '../actions';

export const metadata = { title: 'SEO draft | Lucky Diesel admin' };

const UUID = /^[0-9a-f-]{36}$/i;
const KIND_LABEL: Record<string, string> = { build_page: 'Build page', blog_post: 'Blog post', faq: 'FAQ', area_page: 'Area page' };

function publicHref(row: { kind: string; slug: string; area: string | null; is_sample: boolean }): string | null {
  if (row.is_sample) return null;
  if (row.kind === 'blog_post') return `/blog/${row.slug}`;
  if (row.kind === 'faq') return '/faq';
  if (row.kind === 'area_page' && row.area) return `/service-areas/${row.area}`;
  return null;
}

function list<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export default async function SeoDraftPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole('admin');
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { data: row } = await adminDb().from('seo_content').select('*').eq('id', id).maybeSingle();
  if (!row) notFound();

  const body = sectionsToText(list<SeoSection>(row.body));
  const faq = faqToText(list<FaqItem>(row.faq));
  const scaled = await checkSeoGuard(row.id);
  const liveHref = row.status === 'published' ? publicHref(row) : null;
  const published = row.status === 'published';
  const ready = row.status === 'approved';

  return (
    <>
      <PageHeader
        kicker={`Content · ${KIND_LABEL[row.kind] ?? row.kind}`}
        title="Edit draft"
        description={row.title}
        actions={row.status === 'pending_approval' ? <ButtonLink href="/admin/marketing/ads/approvals">Review approval</ButtonLink> : undefined}
      />
      <SectionTabs tabs={CONTENT_TABS} active="/admin/marketing/content" />
      <div className="mb-4 flex flex-wrap gap-2">
        <StatusBadge status={row.status} />
        <ComplianceBadge status={row.compliance_status as ComplianceStatus} />
        <Badge>{row.generator === 'demo' ? 'Demo copy' : row.generator === 'ai' ? 'AI copy' : 'Edited'}</Badge>
        <Badge tone="info">/{row.slug}</Badge>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
        <Card title="Draft">
          {published && <p className="mb-4 text-sm text-amber-300">Live now. Saving takes it offline until approved again.</p>}
          <SeoEditor fields={{ id: row.id, title: row.title, summary: row.summary, meta: row.meta_description ?? '', body, faq }} action={saveSeo} />
          <IssueList issues={list<ClaimIssue>(row.compliance_issues)} />
        </Card>

        <Card title="Publish">
          <p className="mb-3 text-sm text-chalk/65">
            {row.kind === 'build_page' ? 'Updates the public build page.' : row.kind === 'faq' ? 'Adds these answers to /faq.' : row.kind === 'area_page' ? 'Goes live under /service-areas.' : 'Goes live on /blog.'}
          </p>
          {!ready && !published && <p className="mb-3 text-sm text-amber-300">Approve it first.</p>}
          {scaled && (
            <div className="mb-3 rounded-sm border border-line bg-carbon p-3 text-sm" role="status">
              <p className="font-semibold">Quality check · {scaled.words} words</p>
              {scaled.ok ? <p className="mt-1 text-clover">Ready to go live.</p> : <ul className="mt-1 grid gap-1 text-amber-300">{scaled.issues.map((i) => <li key={i}>{i}</li>)}</ul>}
            </div>
          )}
          {row.is_sample && <p className="mb-3 text-sm text-chalk/55">Sample: never shown on the site.</p>}
          <ActionForm action={publishSeo} confirm="Publish this page?">
            <input type="hidden" name="id" value={row.id} />
            <PendingButton disabled={!ready || (scaled !== null && !scaled.ok)} className="w-full"><Globe className="size-4" aria-hidden="true" />{published ? 'Published' : 'Publish'}</PendingButton>
          </ActionForm>
          {liveHref && <a href={liveHref} target="_blank" rel="noreferrer" className="mt-3 block text-center text-sm font-semibold text-clover underline-offset-4 hover:underline">View live page</a>}
        </Card>
      </div>
    </>
  );
}

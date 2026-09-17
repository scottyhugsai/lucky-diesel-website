import Link from 'next/link';
import { FilePlus2 } from 'lucide-react';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import { Badge, Card, EmptyState, PageHeader, fieldClass, labelClass } from '@/components/app/ui';
import { ComplianceBadge, SectionTabs, StatusBadge } from '@/components/admin/marketing/studio/Bits';
import { CONTENT_TABS } from '@/components/admin/marketing/studio/labels';
import { LocalSeoPanel } from '@/components/admin/marketing/studio/LocalSeoPanel';
import { requireRole } from '@/lib/auth';
import { relativeTime } from '@/lib/format';
import { adminDb } from '@/lib/marketing/content/db';
import { getLocalSeoStatus } from '@/lib/marketing/content/seo-service';
import type { ComplianceStatus } from '@/lib/marketing/content/types';
import { generateSeo, updateListing } from './actions';

export const metadata = { title: 'Content | Lucky Diesel admin' };

const KIND_LABEL: Record<string, string> = { build_page: 'Build page', blog_post: 'Blog', faq: 'FAQ' };

export default async function ContentPage() {
  await requireRole('admin');
  const db = adminDb();
  const [{ data: drafts }, { data: builds }, { data: jobs }, local] = await Promise.all([
    db.from('seo_content').select('id, kind, title, status, compliance_status, generator, updated_at').order('updated_at', { ascending: false }).limit(40),
    db.from('builds').select('id, title').order('created_at', { ascending: false }).limit(30),
    db.from('work_orders').select('id, title').in('status', ['ready', 'invoiced', 'paid']).order('updated_at', { ascending: false }).limit(30),
    getLocalSeoStatus(db),
  ]);

  return (
    <>
      <PageHeader kicker="Marketing · Content" title="SEO + listings" description="Pages that bring in local searches." />
      <SectionTabs tabs={CONTENT_TABS} active="/admin/marketing/content" />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_26rem] xl:items-start">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6">
          <Card title={<span className="inline-flex items-center gap-2"><FilePlus2 className="size-5 text-clover" aria-hidden="true" />Generate a draft</span>}>
            <div className="grid gap-4 md:grid-cols-3 [&>*]:min-w-0">
              <ActionForm action={generateSeo} className="grid min-w-0 content-start gap-2 [&>*]:min-w-0">
                <input type="hidden" name="kind" value="build_page" />
                <label className={labelClass} htmlFor="g-build">Build page</label>
                <select id="g-build" name="buildId" className={fieldClass} disabled={!builds?.length}>
                  {(builds ?? []).map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
                </select>
                <PendingButton size="sm" disabled={!builds?.length}>Generate build page</PendingButton>
              </ActionForm>
              <ActionForm action={generateSeo} className="grid min-w-0 content-start gap-2 [&>*]:min-w-0">
                <input type="hidden" name="kind" value="blog_post" />
                <label className={labelClass} htmlFor="g-job">Blog from a finished job</label>
                <select id="g-job" name="workOrderId" className={fieldClass} disabled={!jobs?.length}>
                  {(jobs ?? []).map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
                </select>
                <PendingButton size="sm" disabled={!jobs?.length}>Generate blog post</PendingButton>
              </ActionForm>
              <ActionForm action={generateSeo} className="grid min-w-0 content-start gap-2 [&>*]:min-w-0">
                <input type="hidden" name="kind" value="faq" />
                <p className={labelClass}>Service FAQ</p>
                <p className="text-sm text-chalk/60">Common diesel questions, local answers.</p>
                <PendingButton size="sm">Generate FAQ</PendingButton>
              </ActionForm>
            </div>
            <p className="mt-3 text-sm text-chalk/55">Customer names never go into drafts.</p>
          </Card>

          <Card title="Drafts" padded={false}>
            {!drafts?.length ? (
              <div className="p-4 sm:p-5"><EmptyState title="No drafts yet">Generate one above.</EmptyState></div>
            ) : (
              <ul className="divide-y divide-line">
                {drafts.map((d) => (
                  <li key={d.id}>
                    <Link href={`/admin/marketing/content/${d.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 transition-colors hover:bg-gunmetal sm:px-5">
                      <span className="min-w-0 flex-1 basis-60">
                        <span className="block truncate font-semibold">{d.title}</span>
                        <span className="text-sm text-chalk/55">{KIND_LABEL[d.kind] ?? d.kind} · {relativeTime(d.updated_at)}</span>
                      </span>
                      <span className="flex flex-wrap gap-1.5">
                        <StatusBadge status={d.status} />
                        <ComplianceBadge status={d.compliance_status as ComplianceStatus} />
                        {d.generator === 'demo' && <Badge>Demo copy</Badge>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="min-w-0"><LocalSeoPanel status={local} action={updateListing} /></div>
      </div>
    </>
  );
}

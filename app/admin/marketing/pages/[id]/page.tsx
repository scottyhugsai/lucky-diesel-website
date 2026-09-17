import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { setLandingPublished } from '@/app/admin/marketing/pages/actions';
import { UUID_RE } from '@/components/admin/core/parse';
import { BlockEditor } from '@/components/admin/marketing/growth-ui/BlockEditor';
import { ToggleButton } from '@/components/admin/marketing/growth-ui/forms';
import { Metric, SampleTag } from '@/components/admin/marketing/growth-ui/kit';
import { loadLandingDetail } from '@/components/admin/marketing/growth-ui/pages-data';
import { UtmBuilder } from '@/components/admin/marketing/growth-ui/UtmBuilder';
import { Badge, Card, PageHeader, buttonClass } from '@/components/app/ui';
import { requireRole } from '@/lib/auth';
import { OTHER_SERVICE, SERVICES } from '@/lib/site';
import { siteUrl } from '@/lib/site-url';

export const metadata = { title: 'Edit page | Lucky Diesel admin' };

export default async function LandingEditPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole('admin');
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const detail = await loadLandingDetail(id);
  if (!detail) notFound();
  const { page, blocks, invalid, magnets, row } = detail;
  const services = [...SERVICES.map((s) => ({ id: s.id, name: s.name })), { id: OTHER_SERVICE, name: 'Other' }];
  const previewHref = `/l/${page.slug}${page.published ? '' : '?preview=1'}`;

  return (
    <>
      <Link href="/admin/marketing/pages" className="text-sm font-semibold text-chalk/60 hover:text-clover">← Pages</Link>
      <PageHeader
        kicker={`/l/${page.slug}`}
        title={page.title}
        actions={
          <>
            <a href={previewHref} target="_blank" rel="noreferrer" className={buttonClass('secondary', 'sm')}>
              <ExternalLink className="size-4" aria-hidden="true" /> {page.published ? 'View live' : 'Preview'}
            </a>
            <ToggleButton action={setLandingPublished} name="publish" hidden={{ page_id: page.id }} next={!page.published} onLabel="Publish" offLabel="Unpublish" />
          </>
        }
      />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {page.published ? <Badge tone="good">Live</Badge> : <Badge tone="warn">Draft</Badge>}
        {page.is_sample && <SampleTag />}
        <span className="text-sm text-steel">Save first, then preview. Publishing runs a copy check.</span>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card title="Blocks">
          {invalid.length > 0 && <p role="alert" className="mb-4 text-sm text-danger">Stored blocks have problems: {invalid.slice(0, 3).join('; ')}. Rebuild below.</p>}
          <BlockEditor
            pageId={page.id} title={page.title} seoDescription={page.seo_description} leadMagnetId={page.lead_magnet_id}
            initialBlocks={blocks.length ? blocks : [{ type: 'hero', kicker: null, headline: page.title, subhead: null, image: null, ctaLabel: null }]}
            magnets={magnets} services={services}
          />
        </Card>
        <div className="grid grid-cols-1 content-start gap-6">
          <Card title="Stats">
            <div className="grid grid-cols-2 gap-4">
              <Metric label="Views" value={row.views} />
              <Metric label="Leads" value={row.leads} tone="good" />
            </div>
            <p className="mt-2 text-xs text-steel">Views = tracked visits. Leads = forms tagged “{row.offerTag ?? 'none'}”.</p>
          </Card>
          <Card title="Share link">
            <UtmBuilder slug={page.slug} baseUrl={siteUrl()} />
          </Card>
        </div>
      </div>
    </>
  );
}

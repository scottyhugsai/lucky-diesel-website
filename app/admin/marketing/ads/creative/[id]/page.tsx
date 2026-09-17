import { notFound } from 'next/navigation';
import { Badge, ButtonLink, Card, PageHeader } from '@/components/app/ui';
import { ComplianceBadge, GeneratorBadge, IssueList, Notice, SectionTabs, StatusBadge } from '@/components/admin/marketing/studio/Bits';
import { ADS_TABS, AD_PLATFORM_LABEL, FORMAT_LABEL, creativeImage, ctaLabel } from '@/components/admin/marketing/studio/labels';
import { VariantEditor } from '@/components/admin/marketing/studio/VariantEditor';
import { requireRole } from '@/lib/auth';
import { AD_LIMITS } from '@/lib/marketing/content/brand';
import { adminDb } from '@/lib/marketing/content/db';
import { AD_FORMATS, type AdPlatform, type ClaimIssue, type ComplianceStatus } from '@/lib/marketing/content/types';
import { editVariant } from '../../actions';

export const metadata = { title: 'Ad variants | Lucky Diesel admin' };

const UUID = /^[0-9a-f-]{36}$/i;
const LOCKED = ['scheduled', 'live', 'paused', 'completed', 'archived'];

function issuesOf(value: unknown): ClaimIssue[] {
  return Array.isArray(value) ? (value as ClaimIssue[]) : [];
}

export default async function CreativePage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole('admin');
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const db = adminDb();
  const [{ data: creative }, { data: approval }] = await Promise.all([
    db.from('ad_creatives').select('*, ad_creative_variants(*)').eq('id', id).maybeSingle(),
    db.from('marketing_approvals').select('decision, notes').eq('subject_type', 'ad_creative').eq('subject_id', id).order('requested_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!creative) notFound();

  const platform = creative.platform as AdPlatform;
  const variants = [...creative.ad_creative_variants].sort((a, b) => a.label.localeCompare(b.label));
  const blocked = variants.filter((v) => v.compliance_status === 'block').length;
  const locked = LOCKED.includes(creative.status);

  return (
    <>
      <PageHeader
        kicker={`Ads · ${AD_PLATFORM_LABEL[platform] ?? creative.platform}`}
        title="Your ad variants"
        description={creative.name}
        actions={
          <>
            {creative.status === 'pending_approval' && <ButtonLink href="/admin/marketing/ads/approvals">Review approval</ButtonLink>}
            {creative.status === 'approved' && <ButtonLink href="/admin/marketing/ads/campaigns">Add to campaign</ButtonLink>}
            <ButtonLink href="/admin/marketing/ads" variant="secondary">Make another</ButtonLink>
          </>
        }
      />
      <SectionTabs tabs={ADS_TABS} active="/admin/marketing/ads" />
      <div className="mb-6 flex flex-wrap gap-2">
        <StatusBadge status={creative.status} />
        <GeneratorBadge generator={creative.generator} />
        {creative.is_sample && <Badge tone="violet">Sample</Badge>}
      </div>
      {creative.generator === 'demo' && (
        <Notice title="Demo copy, written from templates">Real AI turns on in Connections. Numbers still come from shop data.</Notice>
      )}
      {approval?.decision === 'changes_requested' && approval.notes && <Notice tone="warn" title="Changes requested">{approval.notes}</Notice>}
      {blocked > 0 && <Notice tone="warn" title={`${blocked} variant${blocked === 1 ? '' : 's'} blocked`}>Blocked variants never publish. Edit the flagged words to fix them.</Notice>}

      <ol className="grid gap-6">
        {variants.map((v) => {
          const status = v.compliance_status as ComplianceStatus;
          return (
            <li key={v.id}>
              <Card
                title={`Variant ${v.label}`}
                action={<div className="flex flex-wrap justify-end gap-1.5"><ComplianceBadge status={status} /><GeneratorBadge generator={v.generator} /></div>}
                className={status === 'block' ? 'border-danger/40' : ''}
              >
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                  <ul className="grid grid-cols-2 items-end gap-3 sm:grid-cols-4" aria-label="Rendered sizes">
                    {AD_FORMATS.map((format) => (
                      <li key={format} className="min-w-0">
                        {/* eslint-disable-next-line @next/next/no-img-element -- PNG rendered on demand by our image route (auth-gated for drafts); next/image can't optimize it. */}
                        <img src={`${creativeImage(v.id, format)}`} alt={`${v.headline}, ${format} ad`} loading="lazy" className="w-full rounded-sm border border-line bg-gunmetal" style={{ aspectRatio: format.replace(':', ' / ') }} />
                        <p className="mt-1 text-xs text-steel">{FORMAT_LABEL[format]} {format}</p>
                      </li>
                    ))}
                  </ul>
                  <div className="min-w-0 space-y-3">
                    <dl className="space-y-2 text-sm">
                      <div><dt className="text-xs font-semibold uppercase tracking-widest text-steel">Headline</dt><dd className="text-base font-semibold">{v.headline}</dd></div>
                      <div><dt className="text-xs font-semibold uppercase tracking-widest text-steel">Main text</dt><dd className="whitespace-pre-line text-chalk/85">{v.primary_text}</dd></div>
                      {v.description && <div><dt className="text-xs font-semibold uppercase tracking-widest text-steel">Description</dt><dd className="text-chalk/85">{v.description}</dd></div>}
                      <div><dt className="text-xs font-semibold uppercase tracking-widest text-steel">Button</dt><dd><Badge>{ctaLabel(v.cta)}</Badge></dd></div>
                    </dl>
                    {status === 'block' && <p className="text-sm font-semibold text-danger">Blocked: this variant can’t publish until fixed.</p>}
                    <IssueList issues={issuesOf(v.compliance_issues)} />
                    <VariantEditor variant={{ id: v.id, headline: v.headline, primary: v.primary_text, description: v.description, cta: v.cta }} ctas={AD_LIMITS[platform]?.ctas ?? []} action={editVariant} locked={locked} />
                  </div>
                </div>
              </Card>
            </li>
          );
        })}
      </ol>
    </>
  );
}

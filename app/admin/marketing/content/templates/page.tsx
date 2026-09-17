import Link from 'next/link';
import { Archive, ArchiveRestore, History } from 'lucide-react';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import { CopyButton } from '@/components/admin/marketing/growth-ui/CopyButton';
import { TemplateForm } from '@/components/admin/marketing/ops/TemplateForm';
import { ComplianceBadge, SectionTabs } from '@/components/admin/marketing/studio/Bits';
import { CONTENT_TABS } from '@/components/admin/marketing/studio/labels';
import { Badge, Card, EmptyState, PageHeader } from '@/components/app/ui';
import { SEASONAL_TEMPLATES } from '@/components/admin/marketing/core-ui/seasonal';
import { requireRole } from '@/lib/auth';
import type { Tables } from '@/lib/db/database.types';
import { relativeTime } from '@/lib/format';
import { TEMPLATE_CHANNELS, TEMPLATE_CHANNEL_LABEL, type TemplateChannel } from '@/lib/marketing/content/templates';
import type { ComplianceStatus } from '@/lib/marketing/content/types';
import { createClient } from '@/lib/supabase/server';
import { archiveTemplateAction, restoreVersionAction } from './actions';

export const metadata = { title: 'Templates | Lucky Diesel admin' };

type Row = Tables<'marketing_templates'>;

function chip(active: boolean) {
  return `inline-flex h-8 items-center rounded-full border px-3 text-xs font-semibold ${active ? 'border-clover bg-clover/10 text-clover' : 'border-line text-chalk/75 hover:border-clover hover:text-clover'}`;
}

export default async function TemplatesPage({ searchParams }: { searchParams: Promise<{ channel?: string; archived?: string }> }) {
  await requireRole('admin');
  const params = await searchParams;
  const channel = (TEMPLATE_CHANNELS as readonly string[]).includes(params.channel ?? '') ? (params.channel as TemplateChannel) : null;
  const showArchived = params.archived === '1';
  const supabase = await createClient();
  const [{ data: rows, error }, { count: automationCount }] = await Promise.all([
    supabase.from('marketing_templates').select('*').order('template_key').order('version', { ascending: false }).limit(1000),
    supabase.from('automations').select('key', { count: 'exact', head: true }),
  ]);

  const families = new Map<string, Row[]>();
  for (const row of rows ?? []) families.set(row.template_key, [...(families.get(row.template_key) ?? []), row]);
  const list = [...families.values()].filter(([latest]) => latest && latest.archived === showArchived && (!channel || latest.channel === channel));
  const href = (c: string | null) => `/admin/marketing/content/templates?${new URLSearchParams({ ...(c ? { channel: c } : {}), ...(showArchived ? { archived: '1' } : {}) })}`;

  return (
    <>
      <PageHeader kicker="Marketing · Content" title="Templates" description="Reusable wording for every channel." />
      <SectionTabs tabs={CONTENT_TABS} active="/admin/marketing/content/templates" />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_24rem] xl:items-start">
        <div className="grid min-w-0 gap-4">
          <nav aria-label="Filter templates" className="flex flex-wrap gap-1.5">
            <Link href={href(null)} className={chip(!channel)}>All</Link>
            {TEMPLATE_CHANNELS.map((c) => <Link key={c} href={href(c)} className={chip(channel === c)}>{TEMPLATE_CHANNEL_LABEL[c]}</Link>)}
            <Link href={`/admin/marketing/content/templates?${new URLSearchParams({ ...(channel ? { channel } : {}), ...(showArchived ? {} : { archived: '1' }) })}`} className={chip(showArchived)}>Archived</Link>
          </nav>
          {error && <p role="alert" className="text-sm text-danger">Templates unavailable.</p>}
          {!list.length ? (
            <EmptyState title={showArchived ? 'Nothing archived' : 'No templates yet'}>Save wording you reuse. Every save is versioned.</EmptyState>
          ) : (
            <ul className="grid gap-3">
              {list.map((versions) => {
                const t = versions[0]!;
                return (
                  <li key={t.template_key} className="rounded-md border border-line bg-carbon-2 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold">{t.name}</p>
                        <p className="text-xs text-steel">{TEMPLATE_CHANNEL_LABEL[t.channel as TemplateChannel]} · v{t.version} · {relativeTime(t.created_at)}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <ComplianceBadge status={t.compliance_status as ComplianceStatus} />
                        {t.tags.map((tag) => <Badge key={tag}>{tag}</Badge>)}
                      </div>
                    </div>
                    {t.subject && <p className="mt-2 text-sm font-semibold">{t.subject}</p>}
                    <p className="mt-1 line-clamp-4 whitespace-pre-line text-sm text-chalk/75">{t.body}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <CopyButton value={t.subject ? `${t.subject}\n\n${t.body}` : t.body} label="Copy" />
                      <ActionForm action={archiveTemplateAction} feedback="none">
                        <input type="hidden" name="template_key" value={t.template_key} />
                        <input type="hidden" name="archived" value={String(!t.archived)} />
                        <PendingButton size="sm" variant="ghost">{t.archived ? <><ArchiveRestore className="size-4" aria-hidden="true" /> Restore</> : <><Archive className="size-4" aria-hidden="true" /> Archive</>}</PendingButton>
                      </ActionForm>
                    </div>
                    <details className="mt-3 border-t border-line pt-3">
                      <summary className="cursor-pointer text-sm font-semibold text-clover">Edit</summary>
                      <div className="mt-3"><TemplateForm initial={t} idPrefix={`t-${t.template_key}`} /></div>
                    </details>
                    {versions.length > 1 && (
                      <details className="mt-2">
                        <summary className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-chalk/70"><History className="size-4" aria-hidden="true" /> {versions.length - 1} older version{versions.length === 2 ? '' : 's'}</summary>
                        <ul className="mt-2 grid gap-2">
                          {versions.slice(1).map((v) => (
                            <li key={v.id} className="rounded-sm border border-line bg-carbon p-3 text-sm">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-xs text-steel">v{v.version} · {relativeTime(v.created_at)}</span>
                                <ActionForm action={restoreVersionAction} feedback="none"><input type="hidden" name="id" value={v.id} /><PendingButton size="sm" variant="secondary">Restore</PendingButton></ActionForm>
                              </div>
                              <p className="mt-1 line-clamp-3 whitespace-pre-line text-chalk/70">{v.body}</p>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="grid min-w-0 gap-6">
          <Card title="New template"><TemplateForm idPrefix="new" /></Card>
          <Card title="Built-in wording">
            <ul className="grid gap-2 text-sm">
              <li className="flex items-center justify-between gap-2"><Link href="/admin/automations" className="font-semibold hover:text-clover">Automation messages</Link><Badge>{automationCount ?? 0}</Badge></li>
              <li className="flex items-center justify-between gap-2"><Link href="/admin/marketing/campaigns/seasonal" className="font-semibold hover:text-clover">Seasonal campaigns</Link><Badge>{SEASONAL_TEMPLATES.length}</Badge></li>
              <li className="flex items-center justify-between gap-2"><Link href="/admin/marketing/settings#policy" className="font-semibold hover:text-clover">Policy scan</Link><Badge tone="info">All wording</Badge></li>
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}

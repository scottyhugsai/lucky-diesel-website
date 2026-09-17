import Link from 'next/link';
import { Plus } from 'lucide-react';
import { CampaignList } from '@/components/admin/marketing/core-ui/CampaignList';
import { loadCampaignList } from '@/components/admin/marketing/core-ui/campaigns-data';
import { ButtonLink, EmptyState, PageHeader } from '@/components/app/ui';
import { requireRole } from '@/lib/auth';

export const metadata = { title: 'Campaigns | Marketing' };

const FILTERS = ['', 'draft', 'scheduled', 'sending', 'active', 'paused', 'sent', 'archived'] as const;

export default async function CampaignsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireRole('admin');
  const { status: raw } = await searchParams;
  const status = FILTERS.find((f) => f === raw) ?? '';
  const { rows, error } = await loadCampaignList(status);

  return (
    <>
      <PageHeader kicker="Campaigns" title="Email and text" description="Broadcasts, drips and lifecycle sends."
        actions={<ButtonLink href="/admin/marketing/campaigns/new"><Plus className="size-4" aria-hidden="true" /> New campaign</ButtonLink>} />
      <nav aria-label="Filter by status" className="-mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-1.5">
          {FILTERS.map((f) => (
            <li key={f || 'all'}>
              <Link href={f ? `?status=${f}` : '/admin/marketing/campaigns'} aria-current={status === f ? 'true' : undefined}
                className={`inline-flex h-8 items-center rounded-full border px-3 text-xs font-bold capitalize transition-colors ${status === f ? 'border-clover bg-clover text-carbon' : 'border-line text-chalk/70 hover:border-chalk/40'}`}>
                {f || 'All'}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {error && <p role="alert" className="mb-4 text-sm text-danger">Couldn’t load campaigns: {error}</p>}
      {rows.length ? <CampaignList rows={rows} /> : (
        <EmptyState title="Nothing here" action={<ButtonLink href="/admin/marketing/campaigns/new">Create campaign</ButtonLink>}>Start from scratch or a seasonal template.</EmptyState>
      )}
    </>
  );
}

import Link from 'next/link';
import { AutoRefresh } from '@/components/admin/ops/AutoRefresh';
import { LeadCard, RESPOND_WITHIN_MIN, type LeadAutomationSummary } from '@/components/admin/ops/LeadCard';
import { EmptyState, PageHeader } from '@/components/app/ui';
import { requireRole } from '@/lib/auth';
import type { Enums } from '@/lib/db/database.types';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Leads | Lucky Diesel admin' };

const TABS: { status: Enums<'lead_status'>; label: string }[] = [
  { status: 'new', label: 'New' },
  { status: 'contacted', label: 'Contacted' },
  { status: 'booked', label: 'Booked' },
  { status: 'won', label: 'Won' },
  { status: 'lost', label: 'Lost' },
];
const LIST_LIMIT = 100;

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireRole('admin');
  const params = await searchParams;
  const active = TABS.find((t) => t.status === params.status)?.status ?? 'new';
  const supabase = await createClient();

  const [{ data: all }, { data: leads, error }] = await Promise.all([
    supabase.from('leads').select('status'),
    supabase
      .from('leads')
      .select('id, full_name, status, platform_label, service_label, details, sms_consent, created_at, contacted_at')
      .eq('status', active)
      .order('created_at', { ascending: false })
      .limit(LIST_LIMIT),
  ]);
  const rows = leads ?? [];

  const ids = rows.map((l) => l.id);
  const { data: runs } = ids.length
    ? await supabase.from('automation_runs').select('subject_id, status, automation_key').eq('subject_type', 'lead').in('subject_id', ids)
    : { data: [] };
  const byLead = new Map<string, LeadAutomationSummary>();
  for (const run of runs ?? []) {
    if (!run.subject_id) continue;
    const entry = byLead.get(run.subject_id) ?? { sent: 0, scheduled: 0, skipped: 0 };
    if (run.status === 'sent' && run.automation_key === 'lead_auto_reply') entry.sent += 1;
    if (run.status === 'scheduled') entry.scheduled += 1;
    if (run.status === 'skipped') entry.skipped += 1;
    byLead.set(run.subject_id, entry);
  }

  const counts = new Map<string, number>();
  for (const lead of all ?? []) counts.set(lead.status, (counts.get(lead.status) ?? 0) + 1);
  const now = new Date();
  const overdue = active === 'new' ? rows.filter((l) => now.getTime() - new Date(l.created_at).getTime() > RESPOND_WITHIN_MIN * 60_000).length : 0;

  return (
    <>
      {/* New leads land on screen without a manual refresh (pauses when the tab is hidden). */}
      <AutoRefresh intervalMs={7000} />
      <PageHeader
        kicker="Leads inbox"
        title="Service requests"
        description={`Speed wins the job. Leads answered inside ${RESPOND_WITHIN_MIN} minutes book far more often. The auto-reply buys you time; a call closes it.`}
      />

      <nav aria-label="Lead status" className="-mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-1 border-b border-line">
          {TABS.map((tab) => {
            const isActive = tab.status === active;
            return (
              <li key={tab.status}>
                <Link
                  href={`/admin/leads?status=${tab.status}`}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative -mb-px flex h-11 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition-colors ${isActive ? 'border-clover text-chalk' : 'border-transparent text-steel hover:text-chalk'}`}
                >
                  {tab.label}
                  <span className={`rounded-full px-1.5 text-xs tabular-nums ${isActive ? 'bg-clover text-carbon' : 'bg-gunmetal text-chalk/70'}`}>{counts.get(tab.status) ?? 0}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {overdue > 0 && (
        <p role="status" className="mb-4 rounded-sm border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-200">
          {overdue} new lead{overdue === 1 ? ' has' : 's have'} waited more than {RESPOND_WITHIN_MIN} minutes. Call them first.
        </p>
      )}

      {error && <p role="alert" className="mb-4 text-sm text-danger">Couldn’t load leads: {error.message}</p>}

      {rows.length === 0 ? (
        <EmptyState title={`No ${active} leads`}>{active === 'new' ? 'Inbox zero. New website requests land here instantly.' : 'Nothing in this stage right now.'}</EmptyState>
      ) : (
        <ul className="grid gap-3">
          {rows.map((lead) => <LeadCard key={lead.id} lead={lead} automation={byLead.get(lead.id)} now={now} />)}
        </ul>
      )}
    </>
  );
}

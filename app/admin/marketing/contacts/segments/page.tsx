import Link from 'next/link';
import { Plus, RefreshCw } from 'lucide-react';
import { refreshSegmentAction } from '@/app/admin/marketing/contacts/segment-actions';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import { ButtonLink, EmptyState, PageHeader } from '@/components/app/ui';
import { requireRole } from '@/lib/auth';
import { relativeTime } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Segments | Marketing' };

export default async function SegmentsPage() {
  await requireRole('admin');
  const supabase = await createClient();
  const [{ data: segments, error }, { data: campaigns }] = await Promise.all([
    supabase.from('segments').select('id, name, description, member_count, refreshed_at, rules').order('updated_at', { ascending: false }),
    supabase.from('campaigns').select('segment_id').not('segment_id', 'is', null).neq('status', 'archived'),
  ]);
  const usage = new Map<string, number>();
  for (const c of campaigns ?? []) usage.set(c.segment_id!, (usage.get(c.segment_id!) ?? 0) + 1);
  const max = Math.max(1, ...(segments ?? []).map((s) => s.member_count));

  return (
    <>
      <PageHeader kicker="Contacts" title="Segments" description="Saved audiences. They refresh before every send."
        actions={<ButtonLink href="/admin/marketing/contacts/segments/new"><Plus className="size-4" aria-hidden="true" /> Build segment</ButtonLink>} />
      {error && <p role="alert" className="mb-4 text-sm text-danger">Couldn’t load segments: {error.message}</p>}
      {segments?.length ? (
        <ul className="grid gap-3 md:grid-cols-2">
          {segments.map((s) => {
            const rules = s.rules as { conditions?: unknown[]; match?: string } | null;
            return (
              <li key={s.id} className="group relative flex flex-col rounded-md border border-line bg-carbon-2 p-4 transition-colors hover:border-clover/40">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="display text-2xl not-italic">
                      <Link href={`/admin/marketing/contacts/segments/${s.id}`} className="after:absolute after:inset-0 hover:text-clover">{s.name}</Link>
                    </h2>
                    <p className="mt-0.5 text-sm text-chalk/60">{s.description ?? `${rules?.conditions?.length ?? 0} rules · match ${rules?.match ?? 'all'}`}</p>
                  </div>
                  <p className="display text-4xl not-italic tabular-nums text-clover">{s.member_count}</p>
                </div>
                <svg width="100%" height="6" className="mt-3 block" aria-hidden="true">
                  <rect width="100%" height="6" rx="3" fill="var(--gunmetal)" />
                  <rect width={`${Math.max(1, (s.member_count / max) * 100)}%`} height="6" rx="3" fill="var(--clover)" />
                </svg>
                <div className="relative z-10 mt-3 flex items-center justify-between gap-2 text-xs text-steel">
                  <span>{s.refreshed_at ? `Refreshed ${relativeTime(s.refreshed_at)}` : 'Never refreshed'} · {usage.get(s.id) ?? 0} campaign{usage.get(s.id) === 1 ? '' : 's'}</span>
                  <ActionForm action={refreshSegmentAction} feedback="none">
                    <input type="hidden" name="id" value={s.id} />
                    <PendingButton variant="ghost" size="sm" aria-label={`Refresh ${s.name}`}><RefreshCw className="size-3.5" aria-hidden="true" /> Refresh</PendingButton>
                  </ActionForm>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState title="No segments yet" action={<ButtonLink href="/admin/marketing/contacts/segments/new">Build segment</ButtonLink>}>Group people by truck, visits or value.</EmptyState>
      )}
    </>
  );
}

import { Phone } from 'lucide-react';
import { InviteForm } from '@/components/admin/ops/InviteForm';
import { StaffActiveToggle } from '@/components/admin/ops/StaffActiveToggle';
import { dayLabel, mondayOf, shopDate } from '@/components/admin/ops/time';
import { Avatar, Badge, Card, EmptyState, PageHeader } from '@/components/app/ui';
import { requireRole } from '@/lib/auth';
import { shopWallTime } from '@/lib/scheduling/slots';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Team | Lucky Diesel admin' };

const OPEN_JOB_STATUSES = ['estimate', 'awaiting_approval', 'approved', 'in_progress', 'waiting_parts', 'quality_check', 'ready'] as const;

export default async function TeamPage() {
  const viewer = await requireRole('admin');
  const supabase = await createClient();
  const now = new Date();
  const weekStart = shopWallTime(mondayOf(shopDate(now)), 0);

  const [{ data: staff, error }, { data: jobs }, { data: entries }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email, phone, title, role, active, avatar_color').in('role', ['admin', 'employee']).order('role').order('full_name'),
    supabase.from('work_orders').select('assigned_tech_id').in('status', [...OPEN_JOB_STATUSES]).not('assigned_tech_id', 'is', null),
    supabase.from('time_entries').select('tech_id, started_at, ended_at').gte('started_at', weekStart.toISOString()),
  ]);

  const jobCount = new Map<string, number>();
  for (const job of jobs ?? []) if (job.assigned_tech_id) jobCount.set(job.assigned_tech_id, (jobCount.get(job.assigned_tech_id) ?? 0) + 1);
  const minutes = new Map<string, number>();
  for (const e of entries ?? []) {
    const end = e.ended_at ? new Date(e.ended_at) : now;
    minutes.set(e.tech_id, (minutes.get(e.tech_id) ?? 0) + Math.max(0, (end.getTime() - new Date(e.started_at).getTime()) / 60_000));
  }

  return (
    <>
      <PageHeader kicker="Team" title="Shop crew" description={`Hours are for the week starting ${dayLabel(mondayOf(shopDate(now)))}. Deactivated accounts can’t sign in.`} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-label="Staff" className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-3">
          {error && <p role="alert" className="text-sm text-danger">Couldn’t load the team: {error.message}</p>}
          {(staff ?? []).length === 0 && <EmptyState title="No staff yet">Invite your first tech.</EmptyState>}
          {(staff ?? []).map((member) => {
            const hours = (minutes.get(member.id) ?? 0) / 60;
            return (
              <article key={member.id} className={`grid grid-cols-[minmax(0,1fr)] gap-4 rounded-md border border-line bg-carbon-2 p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:p-5 ${member.active ? '' : 'opacity-60'}`}>
                <div className="flex min-w-0 items-center gap-3 sm:contents">
                  <Avatar name={member.full_name || member.email || '?'} color={member.avatar_color} size={44} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="display text-2xl not-italic">{member.full_name || member.email}</h2>
                      <Badge tone={member.role === 'admin' ? 'good' : 'info'}>{member.role === 'admin' ? 'Admin' : 'Employee'}</Badge>
                      {!member.active && <Badge tone="bad">Deactivated</Badge>}
                    </div>
                    <p className="mt-0.5 truncate text-sm text-chalk/60">{member.title ?? '—'} · {member.email}</p>
                    {member.phone && <a href={`tel:${member.phone.replace(/[^\d+]/g, '')}`} className="mt-1 inline-flex items-center gap-1.5 text-sm text-chalk/75 hover:text-clover"><Phone className="size-3.5" aria-hidden="true" />{member.phone}</a>}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-6 sm:justify-end">
                  <dl className="flex gap-5 text-center">
                    <div><dd className="display text-3xl not-italic tabular-nums">{jobCount.get(member.id) ?? 0}</dd><dt className="text-[0.65rem] font-bold uppercase tracking-widest text-steel">Open jobs</dt></div>
                    <div><dd className="display text-3xl not-italic tabular-nums">{hours.toFixed(1)}</dd><dt className="text-[0.65rem] font-bold uppercase tracking-widest text-steel">Hrs this wk</dt></div>
                  </dl>
                  <StaffActiveToggle profileId={member.id} active={member.active} name={member.full_name} isSelf={member.id === viewer.userId} />
                </div>
              </article>
            );
          })}
        </section>
        <Card title="Invite employee" className="self-start">
          <p className="mb-4 text-sm text-chalk/60">They get an email to set a password, then land in the shop-floor app with employee access only.</p>
          <InviteForm />
        </Card>
      </div>
    </>
  );
}

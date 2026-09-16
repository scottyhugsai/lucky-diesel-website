import { ClockBanner, type BannerEntry } from '@/components/shop/ClockBanner';
import { JobCard, type JobCardData } from '@/components/shop/JobCard';
import { BoardSection } from '@/components/shop/BoardSection';
import { requireRole } from '@/lib/auth';
import { firstName, SHOP_TIME_ZONE } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import { ACTIVE_STATUSES, engineName, truckName } from './_lib/labels';
import { serverNow } from './_lib/time';

export const metadata = { title: 'My jobs | Lucky Diesel Shop' };

const JOB_SELECT =
  'id, number, title, status, bay, promised_at, assigned_tech_id, customers(full_name), vehicles(year, make, model, platform, generation, engine_code), part_requests(status), inspections(status), tech:profiles!work_orders_assigned_tech_id_fkey(full_name)';

function greeting(now: number): string {
  const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: SHOP_TIME_ZONE }).format(now));
  return hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
}

export default async function ShopBoardPage() {
  const viewer = await requireRole('employee', 'admin');
  const supabase = await createClient();
  const now = serverNow();

  const [{ data: jobs, error }, { data: openEntry }] = await Promise.all([
    supabase.from('work_orders').select(JOB_SELECT).in('status', [...ACTIVE_STATUSES]).order('promised_at', { ascending: true, nullsFirst: false }),
    supabase
      .from('time_entries')
      .select('id, started_at, work_order_id, work_orders(number, title, vehicles(year, make, model))')
      .eq('tech_id', viewer.userId)
      .is('ended_at', null)
      .maybeSingle(),
  ]);

  const cards: (JobCardData & { assignedTo: string | null })[] = (jobs ?? []).map((job) => ({
    id: job.id,
    number: job.number,
    title: job.title,
    status: job.status,
    vehicle: truckName(job.vehicles),
    engine: engineName(job.vehicles),
    customerFirstName: firstName(job.customers?.full_name),
    promisedAt: job.promised_at,
    bay: job.bay,
    openPartRequests: (job.part_requests ?? []).filter((request) => request.status !== 'received').length,
    inspectionSent: job.inspections?.status === 'sent',
    techName: job.assigned_tech_id && job.assigned_tech_id !== viewer.userId ? firstName(job.tech?.full_name) : null,
    clockedIn: openEntry?.work_order_id === job.id,
    assignedTo: job.assigned_tech_id,
  }));

  const mine = cards.filter((job) => job.assignedTo === viewer.userId && job.status !== 'awaiting_approval');
  const unassigned = cards.filter((job) => !job.assignedTo && job.status !== 'awaiting_approval');
  const waiting = cards
    .filter((job) => job.status === 'awaiting_approval')
    .sort((a, b) => Number(b.assignedTo === viewer.userId) - Number(a.assignedTo === viewer.userId));

  const banner: BannerEntry | null = openEntry?.work_orders
    ? {
        id: openEntry.id,
        startedAt: openEntry.started_at,
        workOrderId: openEntry.work_order_id,
        number: openEntry.work_orders.number,
        title: openEntry.work_orders.title,
        vehicle: truckName(openEntry.work_orders.vehicles),
      }
    : null;

  const today = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: SHOP_TIME_ZONE }).format(now);

  return (
    <div className="grid gap-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="kicker">{today}</p>
          <h1 className="display mt-2 text-5xl sm:text-6xl">
            {greeting(now)}, <span className="text-clover">{firstName(viewer.profile.full_name) || 'tech'}</span>
          </h1>
        </div>
        <p className="text-sm text-chalk/60">
          <strong className="text-chalk tabular-nums">{mine.length}</strong> on your board · <strong className="text-chalk tabular-nums">{unassigned.length}</strong> up for grabs
        </p>
      </header>

      <ClockBanner entry={banner} serverNow={now} />

      {error && <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 p-4 text-danger">Couldn’t load jobs. Pull to refresh.</p>}

      <BoardSection id="mine" title="My jobs" count={mine.length} empty="Nothing assigned to you. Grab one from Unassigned below.">
        {mine.map((job) => <JobCard key={job.id} job={job} now={now} />)}
      </BoardSection>

      <BoardSection id="unassigned" title="Unassigned" count={unassigned.length} empty="Every job has a tech. Nice.">
        {unassigned.map((job) => <JobCard key={job.id} job={job} now={now} canTake />)}
      </BoardSection>

      <BoardSection id="waiting" title="Waiting on customer" count={waiting.length} empty="No estimates out for approval." muted>
        {waiting.map((job) => <JobCard key={job.id} job={job} now={now} />)}
      </BoardSection>
    </div>
  );
}

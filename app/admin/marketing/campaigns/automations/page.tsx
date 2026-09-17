import { AutomationFlowCard, type RunCounts } from '@/components/admin/ops/AutomationFlowCard';
import { EmptyState, PageHeader } from '@/components/app/ui';
import { requireRole } from '@/lib/auth';
import { isMarketingAutomationKey } from '@/lib/marketing/core/policy';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Marketing automations | Marketing' };

const RUN_SAMPLE = 5000;

const GROUPS: { label: string; blurb: string; match: (key: string, event: string) => boolean }[] = [
  { label: 'Bring them back', blurb: 'Win-backs and service reminders.', match: (k, e) => /win_back|service\.due|fleet_pm/.test(`${k} ${e}`) },
  { label: 'Seasonal', blurb: 'Towing, hurricane and winter prep.', match: (_k, e) => e.startsWith('marketing.seasonal') },
  { label: 'After the job', blurb: 'Tune check-ins and dyno re-checks.', match: (k) => /tune|dyno|build_plan|checkout/.test(k) },
  { label: 'Moments and referrals', blurb: 'Birthdays, anniversaries, referral rewards.', match: (k) => /birthday|anniversary|referral/.test(k) },
  { label: 'Feedback and alerts', blurb: 'Surveys and owner alerts.', match: () => true },
];

export default async function MarketingAutomationsPage() {
  await requireRole('admin');
  const supabase = await createClient();
  const [{ data: automations, error }, { data: runs }] = await Promise.all([
    supabase.from('automations').select('*').order('sort'),
    supabase.from('automation_runs').select('automation_key, status').order('created_at', { ascending: false }).limit(RUN_SAMPLE),
  ]);
  const marketing = (automations ?? []).filter((a) => isMarketingAutomationKey(a.key) || a.trigger_event.startsWith('marketing.') || a.trigger_event === 'service.due');
  const counts = new Map<string, RunCounts>();
  for (const run of runs ?? []) {
    const entry = counts.get(run.automation_key) ?? { sent: 0, scheduled: 0, skipped: 0, failed: 0 };
    if (run.status !== 'cancelled') counts.set(run.automation_key, { ...entry, [run.status]: entry[run.status] + 1 });
  }
  const placed = new Set<string>();
  const grouped = GROUPS.map((group) => {
    const items = marketing.filter((a) => !placed.has(a.key) && group.match(a.key, a.trigger_event));
    items.forEach((a) => placed.add(a.key));
    return { ...group, items };
  }).filter((g) => g.items.length);
  const on = marketing.filter((a) => a.enabled).length;

  return (
    <>
      <PageHeader kicker="Campaigns" title="Lifecycle automations" description={`${on} of ${marketing.length} on. Tap a name to edit wording or timing.`} />
      {error && <p role="alert" className="mb-4 text-sm text-danger">Couldn’t load automations: {error.message}</p>}
      {grouped.length === 0 ? (
        <EmptyState title="No marketing automations">Run the marketing seed to add them.</EmptyState>
      ) : (
        <div className="grid gap-10">
          {grouped.map((group) => (
            <section key={group.label} aria-labelledby={`grp-${group.label}`}>
              <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 id={`grp-${group.label}`} className="kicker">{group.label}</h2>
                <p className="text-sm text-steel">{group.blurb} · {group.items.filter((i) => i.enabled).length}/{group.items.length} on</p>
              </header>
              <div className="grid gap-3 xl:grid-cols-2">
                {group.items.map((a) => (
                  <AutomationFlowCard key={a.key} automation={a} counts={counts.get(a.key) ?? { sent: 0, scheduled: 0, skipped: 0, failed: 0 }} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { AutomationFlowCard } from '@/components/admin/ops/AutomationFlowCard';
import { AutomationStatsRow } from '@/components/admin/ops/AutomationStatsRow';
import { STAGES, stageOf } from '@/components/admin/ops/automation-meta';
import { loadAutomationOverview } from '@/components/admin/ops/automation-data';
import { DemoTools } from '@/components/admin/ops/DemoTools';
import { ButtonLink, EmptyState, PageHeader } from '@/components/app/ui';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Automations | Lucky Diesel admin' };

const EMPTY_COUNTS = { sent: 0, scheduled: 0, skipped: 0, failed: 0 };

export default async function AutomationsPage() {
  await requireRole('admin');
  const supabase = await createClient();
  const { automations, counts, stats, demoCustomers, error } = await loadAutomationOverview(supabase, new Date());
  const onCount = automations.filter((a) => a.enabled).length;

  return (
    <>
      <PageHeader
        kicker="Automations center"
        title="Every message, on autopilot"
        description={`${onCount} of ${automations.length} automations are on. Every text and email below is logged, and you can switch any of them off or change the wording.`}
        actions={<ButtonLink href="/admin/automations/runs" variant="secondary">Run log</ButtonLink>}
      />

      {error && <p role="alert" className="mb-4 rounded-sm border border-danger/40 bg-danger/10 p-3 text-sm text-danger">Couldn’t load everything: {error}</p>}

      <AutomationStatsRow stats={stats} />

      <div className="mt-6">
        <DemoTools customers={demoCustomers} />
      </div>

      {automations.length === 0 ? (
        <div className="mt-8"><EmptyState title="No automations yet">Run the database seed to install the default automations.</EmptyState></div>
      ) : (
        <div className="mt-10 space-y-12">
          {STAGES.map((stage, index) => {
            const items = automations.filter((a) => stageOf(a) === stage.id);
            if (!items.length) return null;
            return (
              <section key={stage.id} aria-labelledby={`stage-${stage.id}`} className="relative lg:grid lg:grid-cols-[12rem_1fr] lg:gap-8">
                <header className="mb-4 lg:sticky lg:top-8 lg:mb-0 lg:self-start">
                  <p className="display text-6xl not-italic leading-none text-chalk/10" aria-hidden="true">{String(index + 1).padStart(2, '0')}</p>
                  <h2 id={`stage-${stage.id}`} className="kicker -mt-4">{stage.label}</h2>
                  <p className="mt-2 text-sm text-chalk/55">{stage.blurb}</p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-steel">{items.filter((i) => i.enabled).length}/{items.length} on</p>
                </header>
                <div className="relative grid gap-3 border-l border-dashed border-clover/25 pl-4 sm:pl-6 xl:grid-cols-2 xl:border-l-0 xl:pl-0">
                  {items.map((automation) => (
                    <AutomationFlowCard key={automation.key} automation={automation} counts={counts.get(automation.key) ?? EMPTY_COUNTS} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <aside className="mt-12 rounded-md border border-line bg-carbon-2 p-5">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em] text-clover">
          <ShieldCheck className="size-4" aria-hidden="true" /> Compliance built in
        </h2>
        <ul className="mt-3 grid gap-2 text-sm text-chalk/75 sm:grid-cols-2">
          <li>Texts only go to customers with recorded SMS consent (time, IP and wording version stored).</li>
          <li>STOP opt-outs are honoured automatically. Opted-out numbers are skipped and logged.</li>
          <li>Delayed customer texts respect quiet hours: nothing lands between 9pm and 8am.</li>
          <li>Review requests go to every customer. No filtering by happiness, per Google policy.</li>
        </ul>
        <p className="mt-3 text-xs text-steel">
          Want proof? Every skip is in the <Link href="/admin/automations/runs?status=skipped" className="underline hover:text-clover">run log</Link> with its reason.
        </p>
      </aside>
    </>
  );
}

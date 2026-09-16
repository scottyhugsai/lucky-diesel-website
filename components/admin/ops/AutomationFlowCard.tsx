import Link from 'next/link';
import { ArrowRight, Clock, Mail, MessageSquare, Users, Zap } from 'lucide-react';
import { describeTiming } from '@/lib/automations/catalog';
import type { Tables } from '@/lib/db/database.types';
import { AUDIENCE_LABEL, triggerLabel } from './automation-meta';
import { AutomationSwitch } from './AutomationSwitch';

export interface RunCounts {
  sent: number;
  scheduled: number;
  skipped: number;
  failed: number;
}

function Node({ icon, label, value, tone = 'default' }: { icon: React.ReactNode; label: string; value: React.ReactNode; tone?: 'default' | 'trigger' }) {
  return (
    <div className={`min-w-0 rounded-sm border px-2.5 py-2 ${tone === 'trigger' ? 'border-clover/35 bg-clover/[0.07]' : 'border-line bg-carbon'}`}>
      <p className="flex items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-widest text-steel">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold leading-snug text-chalk">{value}</p>
    </div>
  );
}

/** One automation as a trigger → timing → channel → audience rail, with its switch and run counts. */
export function AutomationFlowCard({ automation, counts }: { automation: Tables<'automations'>; counts: RunCounts }) {
  const timing = describeTiming({ anchor: automation.anchor as 'event' | 'before_appointment', delayMinutes: automation.delay_minutes });
  const off = !automation.enabled;
  return (
    <article className={`group relative rounded-md border bg-carbon-2 transition-colors ${off ? 'border-line' : 'border-line hover:border-clover/40'}`}>
      <span className={`absolute inset-y-3 left-0 w-[3px] rounded-r ${off ? 'bg-steel/30' : 'bg-clover'}`} aria-hidden="true" />
      <div className="flex items-start justify-between gap-3 px-4 pt-4 sm:px-5">
        <div className="min-w-0">
          <h3 className={`display text-2xl not-italic ${off ? 'text-chalk/50' : ''}`}>
            <Link href={`/admin/automations/${automation.key}`} className="hover:text-clover focus-visible:text-clover">
              {automation.name}
            </Link>
          </h3>
          <p className="mt-1 text-sm text-chalk/60">{automation.description}</p>
        </div>
        <AutomationSwitch automationKey={automation.key} name={automation.name} enabled={automation.enabled} />
      </div>

      <div className={`grid grid-cols-2 items-stretch gap-2 px-4 py-4 sm:grid-cols-[1.3fr_auto_1fr_auto_0.9fr_auto_0.9fr] sm:items-center sm:px-5 ${off ? 'opacity-45' : ''}`}>
        <Node tone="trigger" icon={<Zap className="size-3" aria-hidden="true" />} label="When" value={triggerLabel(automation.trigger_event)} />
        <ArrowRight className="hidden size-4 text-clover/70 sm:block" aria-hidden="true" />
        <Node icon={<Clock className="size-3" aria-hidden="true" />} label="Timing" value={timing} />
        <ArrowRight className="hidden size-4 text-clover/70 sm:block" aria-hidden="true" />
        <Node
          icon={automation.channels.includes('sms') ? <MessageSquare className="size-3" aria-hidden="true" /> : <Mail className="size-3" aria-hidden="true" />}
          label="Send"
          value={automation.channels.map((c) => (c === 'sms' ? 'Text' : 'Email')).join(' + ')}
        />
        <ArrowRight className="hidden size-4 text-clover/70 sm:block" aria-hidden="true" />
        <Node icon={<Users className="size-3" aria-hidden="true" />} label="To" value={AUDIENCE_LABEL[automation.audience] ?? automation.audience} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2.5 text-xs sm:px-5">
        <p className="flex flex-wrap gap-x-4 gap-y-1 tabular-nums text-chalk/60">
          <span><b className="text-clover">{counts.sent}</b> sent</span>
          <span><b className="text-sky-300">{counts.scheduled}</b> scheduled</span>
          <span><b className="text-amber-300">{counts.skipped}</b> skipped</span>
          {counts.failed > 0 && <span><b className="text-danger">{counts.failed}</b> failed</span>}
        </p>
        <Link href={`/admin/automations/${automation.key}`} className="font-semibold text-chalk/70 hover:text-clover">
          Edit wording <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
}

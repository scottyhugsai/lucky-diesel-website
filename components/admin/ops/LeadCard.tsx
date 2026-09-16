import Link from 'next/link';
import { Bot, Clock, MessageSquareOff, ShieldCheck, Truck, Wrench } from 'lucide-react';
import { Badge } from '@/components/app/ui';
import type { Tables } from '@/lib/db/database.types';
import { ageLabel } from './time';

export const RESPOND_WITHIN_MIN = 15;

export type LeadRow = Pick<Tables<'leads'>, 'id' | 'full_name' | 'status' | 'platform_label' | 'service_label' | 'details' | 'sms_consent' | 'created_at' | 'contacted_at'>;

export interface LeadAutomationSummary {
  sent: number;
  scheduled: number;
  skipped: number;
}

export function LeadCard({ lead, automation, now }: { lead: LeadRow; automation: LeadAutomationSummary | undefined; now: Date }) {
  const ageMinutes = (now.getTime() - new Date(lead.created_at).getTime()) / 60_000;
  const urgent = lead.status === 'new' && ageMinutes > RESPOND_WITHIN_MIN;
  return (
    <li>
      <Link
        href={`/admin/leads/${lead.id}`}
        className={`group grid gap-3 rounded-md border bg-carbon-2 p-4 transition-colors hover:border-clover/50 sm:grid-cols-[1fr_auto] sm:p-5 ${urgent ? 'border-amber-400/40' : 'border-line'}`}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="display text-2xl not-italic group-hover:text-clover">{lead.full_name}</h3>
            {urgent && (
              <Badge tone="warn"><span className="size-1.5 animate-pulse rounded-full bg-current" aria-hidden="true" />Respond now</Badge>
            )}
          </div>
          <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-chalk/75">
            <span className="inline-flex items-center gap-1.5"><Truck className="size-3.5 text-steel" aria-hidden="true" />{lead.platform_label ?? 'Truck not given'}</span>
            <span className="inline-flex items-center gap-1.5"><Wrench className="size-3.5 text-steel" aria-hidden="true" />{lead.service_label ?? 'Service not given'}</span>
          </p>
          {lead.details && <p className="mt-2 line-clamp-2 text-sm text-chalk/55">“{lead.details}”</p>}
        </div>
        <div className="flex flex-wrap items-start gap-2 sm:flex-col sm:items-end">
          <span className={`inline-flex items-center gap-1.5 text-sm font-semibold tabular-nums ${urgent ? 'text-amber-300' : 'text-chalk/70'}`}>
            <Clock className="size-3.5" aria-hidden="true" />{ageLabel(lead.created_at, now)}
          </span>
          {lead.sms_consent ? (
            <Badge tone="good"><ShieldCheck className="size-3" aria-hidden="true" />SMS OK</Badge>
          ) : (
            <Badge><MessageSquareOff className="size-3" aria-hidden="true" />No SMS consent</Badge>
          )}
          {automation?.sent ? (
            <Badge tone="info"><Bot className="size-3" aria-hidden="true" />Auto-replied</Badge>
          ) : (
            <Badge><Bot className="size-3" aria-hidden="true" />No auto-reply</Badge>
          )}
          {automation?.scheduled ? <span className="text-xs text-steel">{automation.scheduled} follow-up{automation.scheduled === 1 ? '' : 's'} queued</span> : null}
        </div>
      </Link>
    </li>
  );
}

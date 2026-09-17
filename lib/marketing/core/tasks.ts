/** Today's task queue with call scripts. Pure. */

import { isOpenStatus, isSnoozed, isStale, quoteNudgeDue, slaLevel, snoozeJustEnded, type CrmRules } from './speed';

export type TaskKind = 'new_lead' | 'unanswered' | 'hot' | 'follow_up' | 'stale' | 'quote_expiring';

export interface TaskLead {
  id: string;
  name: string;
  phone: string | null;
  serviceId: string | null;
  serviceLabel: string | null;
  platformLabel: string | null;
  status: string;
  score: number;
  createdAt: Date;
  contactedAt: Date | null;
  lastActivityAt: Date;
  snoozedUntil: Date | null;
  assignedTo: string | null;
  dealValueCents: number;
}

export interface TaskThread {
  key: string;
  name: string;
  preview: string;
  lastAt: Date;
}

export interface TaskQuote {
  workOrderId: string;
  number: number;
  name: string;
  expiresAt: Date;
}

export interface Task {
  id: string;
  kind: TaskKind;
  title: string;
  detail: string;
  script: string;
  leadId: string | null;
  threadKey: string | null;
  workOrderId: string | null;
  phone: string | null;
  priority: number;
}

const KIND_PRIORITY: Record<TaskKind, number> = { new_lead: 100, unanswered: 90, hot: 70, follow_up: 60, quote_expiring: 55, stale: 40 };

const SERVICE_OPENERS: Record<string, string> = {
  tuning: 'Ask what they tow, current mods, and whether they want economy or power.',
  turbo: 'Ask about symptoms (smoke, whistle, boost codes) and mileage on the turbo.',
  fuel: 'Ask about hard starts, smoke or codes. Mention we test before replacing injectors.',
  engine: 'Ask what happened, current mileage, and whether the truck still runs.',
  injectors: 'Ask about hard starts, smoke or codes. Mention we test before replacing.',
  transmission: 'Ask about slipping, shift feel and what they tow.',
  exhaust: 'Ask what system they have now and what they want to change.',
  diagnostics: 'Ask for codes, symptoms and when it started.',
};

/** A short call script: opener, one service-specific question, and the ask. Never quotes prices. */
export function callScript(kind: TaskKind, lead: { name: string; serviceId: string | null; serviceLabel: string | null; platformLabel: string | null }): string {
  const first = lead.name.split(/\s+/)[0] || 'there';
  const truck = lead.platformLabel ?? 'your truck';
  const service = (lead.serviceLabel ?? 'service').toLowerCase();
  const opener = {
    new_lead: `Hey ${first}, this is Lucky Diesel. You asked about ${service} for ${truck}. Got a minute?`,
    unanswered: `Hey ${first}, Lucky Diesel here, following up on your text.`,
    hot: `Hey ${first}, Lucky Diesel here. Wanted to get your ${truck} on the schedule.`,
    follow_up: `Hey ${first}, Lucky Diesel checking back in like we said.`,
    quote_expiring: `Hey ${first}, Lucky Diesel here. Your estimate is about to expire. Any questions on it?`,
    stale: `Hey ${first}, Lucky Diesel here. Still thinking about ${service} for ${truck}?`,
  }[kind];
  const question = SERVICE_OPENERS[lead.serviceId ?? ''] ?? 'Ask what is going on with the truck and how they use it.';
  return `${opener}\n• ${question}\n• Offer a time to bring it in. No price quotes before we see it.`;
}

export interface QueueInput {
  leads: readonly TaskLead[];
  threads: readonly TaskThread[];
  quotes: readonly TaskQuote[];
  now: Date;
  rules: CrmRules;
  /** Only the viewer's tasks plus unassigned ones. */
  viewerId?: string | null;
}

/** Builds the call/text list: one task per lead (its most urgent reason), highest priority first. */
export function buildTaskQueue(input: QueueInput): Task[] {
  const { now, rules } = input;
  const tasks: Task[] = [];
  for (const lead of input.leads) {
    if (!isOpenStatus(lead.status)) continue;
    if (input.viewerId && lead.assignedTo && lead.assignedTo !== input.viewerId) continue;
    const due = snoozeJustEnded(lead.snoozedUntil, now);
    if (isSnoozed(lead.snoozedUntil, now)) continue;
    const kind: TaskKind | null =
      lead.status === 'new' && !lead.contactedAt ? 'new_lead'
        : due ? 'follow_up'
          : lead.score >= rules.hotScore && lead.status !== 'booked' ? 'hot'
            : isStale(lead, now, rules.staleHours) ? 'stale'
              : null;
    if (!kind) continue;
    const waitedMinutes = Math.floor((now.getTime() - lead.createdAt.getTime()) / 60_000);
    const late = kind === 'new_lead' ? slaLevel(lead, now, rules) : 0;
    tasks.push({
      id: `lead:${lead.id}`, kind, leadId: lead.id, threadKey: null, workOrderId: null, phone: lead.phone,
      title: lead.name,
      detail: kind === 'new_lead' ? `Waiting ${waitedMinutes < 120 ? `${waitedMinutes} min` : `${Math.floor(waitedMinutes / 60)} h`}` : [lead.platformLabel, lead.serviceLabel].filter(Boolean).join(' · ') || 'Open deal',
      script: callScript(kind, lead),
      priority: KIND_PRIORITY[kind] + late * 5 + Math.round(lead.score / 10),
    });
  }
  for (const thread of input.threads) {
    tasks.push({
      id: `thread:${thread.key}`, kind: 'unanswered', leadId: null, threadKey: thread.key, workOrderId: null, phone: null,
      title: thread.name, detail: thread.preview, script: callScript('unanswered', { name: thread.name, serviceId: null, serviceLabel: null, platformLabel: null }),
      priority: KIND_PRIORITY.unanswered,
    });
  }
  for (const quote of input.quotes) {
    if (!quoteNudgeDue(quote.expiresAt, now, rules.quoteNudgeDays)) continue;
    tasks.push({
      id: `quote:${quote.workOrderId}`, kind: 'quote_expiring', leadId: null, threadKey: null, workOrderId: quote.workOrderId, phone: null,
      title: quote.name, detail: `Estimate #${quote.number} expires ${quote.expiresAt.toISOString().slice(0, 10)}`,
      script: callScript('quote_expiring', { name: quote.name, serviceId: null, serviceLabel: 'your estimate', platformLabel: null }),
      priority: KIND_PRIORITY.quote_expiring,
    });
  }
  return tasks.sort((a, b) => b.priority - a.priority);
}

export const TASK_LABELS: Record<TaskKind, string> = {
  new_lead: 'New lead', unanswered: 'Unanswered', hot: 'Hot', follow_up: 'Follow up', stale: 'Gone quiet', quote_expiring: 'Quote expiring',
};

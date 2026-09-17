import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCrmSettings, staffAddresses } from './crm-data';
import type { Db } from './settings';
import { groupThreads, type InboxMessage } from './inbox';
import { isSnoozed } from './speed';
import { buildTaskQueue, type Task, type TaskLead, type TaskQuote, type TaskThread } from './tasks';

const DAY_MS = 86_400_000;
const LEAD_WINDOW_DAYS = 120;
const MESSAGE_WINDOW_DAYS = 14;

/**
 * Today's call/text list: open leads, conversations waiting on us and estimates
 * about to expire, ordered by urgency. Read-only; the rules live in `tasks.ts`.
 */
export async function loadTaskQueue(viewerId: string, db: Db = createAdminClient(), now = new Date()): Promise<{ tasks: Task[]; mine: Task[] }> {
  const [{ data: leadRows }, { data: messageRows }, staff, { data: threadStates }, { data: quoteRows }, rules] = await Promise.all([
    db.from('leads')
      .select('id, full_name, phone, service_id, service_label, platform_label, status, lead_score, created_at, contacted_at, last_activity_at, snoozed_until, assigned_to, deal_value_cents')
      .in('status', ['new', 'contacted', 'booked'])
      .gte('created_at', new Date(now.getTime() - LEAD_WINDOW_DAYS * DAY_MS).toISOString())
      .limit(500),
    db.from('messages')
      .select('id, channel, direction, to_address, body, subject, status, automation_key, customer_id, created_at')
      .gte('created_at', new Date(now.getTime() - MESSAGE_WINDOW_DAYS * DAY_MS).toISOString())
      .neq('status', 'queued')
      .order('created_at', { ascending: false })
      .limit(1200),
    staffAddresses(db),
    db.from('inbox_threads').select('channel, address, snoozed_until, closed_at'),
    db.from('work_orders')
      .select('id, number, estimate_expires_at, customers(full_name)')
      .eq('status', 'awaiting_approval')
      .not('estimate_expires_at', 'is', null)
      .gt('estimate_expires_at', now.toISOString())
      .limit(100),
    getCrmSettings(db),
  ]);

  const leads: TaskLead[] = (leadRows ?? []).map((lead) => ({
    id: lead.id,
    name: lead.full_name,
    phone: lead.phone,
    serviceId: lead.service_id,
    serviceLabel: lead.service_label,
    platformLabel: lead.platform_label,
    status: lead.status,
    score: lead.lead_score,
    createdAt: new Date(lead.created_at),
    contactedAt: lead.contacted_at ? new Date(lead.contacted_at) : null,
    lastActivityAt: new Date(lead.last_activity_at),
    snoozedUntil: lead.snoozed_until ? new Date(lead.snoozed_until) : null,
    assignedTo: lead.assigned_to,
    dealValueCents: lead.deal_value_cents,
  }));

  const messages: InboxMessage[] = (messageRows ?? []).map((m) => ({
    id: m.id, channel: m.channel, direction: m.direction, address: m.to_address, body: m.body,
    subject: m.subject, status: m.status, automationKey: m.automation_key, customerId: m.customer_id, createdAt: m.created_at,
  }));
  const muted = new Set(
    (threadStates ?? [])
      .filter((s) => s.closed_at || isSnoozed(s.snoozed_until ? new Date(s.snoozed_until) : null, now))
      .map((s) => `${s.channel}:${s.address}`),
  );
  const threads: TaskThread[] = groupThreads(messages, staff)
    .filter((t) => t.awaitingReply && !muted.has(t.key))
    .map((t) => ({ key: t.key, name: t.address, preview: t.preview, lastAt: new Date(t.lastAt) }));

  const quotes: TaskQuote[] = (quoteRows ?? []).flatMap((job) =>
    job.estimate_expires_at
      ? [{ workOrderId: job.id, number: job.number, name: job.customers?.full_name ?? 'Customer', expiresAt: new Date(job.estimate_expires_at) }]
      : [],
  );

  const tasks = buildTaskQueue({ leads, threads, quotes, now, rules });
  const mine = buildTaskQueue({ leads, threads, quotes, now, rules, viewerId });
  return { tasks, mine };
}

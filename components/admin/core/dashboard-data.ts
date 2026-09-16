import 'server-only';
import type { Enums } from '@/lib/db/database.types';
import { createClient } from '@/lib/supabase/server';
import { DAY_MS, computeKpis, leadFunnel, revenueByService, weeklyRevenue, type PaidJobRow, type PaymentRow } from './metrics';
import { shopDayRange } from './time';

const HOUR_MS = 3_600_000;
const ESTIMATE_WAIT_MS = 4 * HOUR_MS;
export const IN_SHOP: Enums<'work_order_status'>[] = ['approved', 'in_progress', 'waiting_parts', 'quality_check', 'ready'];
const DONE: Enums<'work_order_status'>[] = ['ready', 'invoiced', 'paid', 'cancelled'];

export interface AttentionItem {
  id: string;
  href: string;
  kind: 'overdue' | 'estimate' | 'parts';
  title: string;
  detail: string;
  since: string;
}

export async function loadDashboard(nowDate = new Date()) {
  const supabase = await createClient();
  const now = nowDate.getTime();
  const since60 = new Date(now - 60 * DAY_MS).toISOString();
  const since90 = new Date(now - 90 * DAY_MS).toISOString();
  const today = shopDayRange(nowDate);

  const [payments, paidInvoices, decisions, leads, appointments, activeJobs, openInvoices, parts, events] = await Promise.all([
    supabase.from('payments').select('amount_cents, created_at, invoices(work_orders(title))').gte('created_at', since90),
    supabase
      .from('invoices')
      .select('total_cents, paid_at, work_orders(line_items(kind, quantity, unit_price_cents, unit_cost_cents, approval), time_entries(started_at, ended_at))')
      .eq('status', 'paid')
      .gte('paid_at', since60),
    supabase.from('work_orders').select('created_at, line_items(approval, quantity, unit_price_cents)').gte('created_at', since60),
    supabase.from('leads').select('status').gte('created_at', since90),
    supabase.from('appointments').select('id', { count: 'exact', head: true }).gte('starts_at', today.start).lt('starts_at', today.end).not('status', 'in', '(cancelled,no_show)'),
    supabase
      .from('work_orders')
      .select('id, number, title, status, promised_at, customers(full_name), work_order_events(to_status, created_at)')
      .not('status', 'in', '(paid,cancelled)'),
    supabase.from('invoices').select('total_cents').eq('status', 'open'),
    supabase.from('part_requests').select('id, description, status, created_at, work_orders(id, number, title)').in('status', ['requested', 'ordered']).order('created_at'),
    supabase
      .from('work_order_events')
      .select('id, from_status, to_status, note, created_at, profiles(full_name, avatar_color), work_orders(id, number, title, customers(full_name))')
      .order('created_at', { ascending: false })
      .limit(8),
  ]);

  const firstError = [payments, paidInvoices, decisions, leads, activeJobs, openInvoices, parts, events].find((r) => r.error)?.error;
  if (firstError) throw new Error(`Dashboard query failed: ${firstError.message}`);

  const paymentRows: PaymentRow[] = (payments.data ?? []).map((p) => ({ amount_cents: p.amount_cents, created_at: p.created_at, title: p.invoices?.work_orders?.title ?? null }));
  const paidJobs: PaidJobRow[] = (paidInvoices.data ?? []).map((invoice) => ({
    total_cents: invoice.total_cents,
    paid_at: invoice.paid_at,
    lines: invoice.work_orders?.line_items ?? [],
    timeEntries: invoice.work_orders?.time_entries ?? [],
  }));
  const decisionLines = (decisions.data ?? []).flatMap((wo) => wo.line_items.map((line) => ({ ...line, created_at: wo.created_at })));

  const jobs = activeJobs.data ?? [];
  const attention: AttentionItem[] = [];
  for (const job of jobs) {
    const who = job.customers?.full_name ?? 'Customer';
    if (job.promised_at && new Date(job.promised_at).getTime() < now && !DONE.includes(job.status)) {
      attention.push({ id: `late-${job.id}`, href: `/admin/jobs/${job.id}`, kind: 'overdue', title: `WO #${job.number} past promised time`, detail: `${who} · ${job.title}`, since: job.promised_at });
    }
    if (job.status === 'awaiting_approval') {
      const sentAt = job.work_order_events.filter((e) => e.to_status === 'awaiting_approval').map((e) => e.created_at).sort().at(-1);
      if (sentAt && now - new Date(sentAt).getTime() > ESTIMATE_WAIT_MS) {
        attention.push({ id: `est-${job.id}`, href: `/admin/jobs/${job.id}`, kind: 'estimate', title: `WO #${job.number} estimate unanswered`, detail: `${who} · ${job.title}`, since: sentAt });
      }
    }
  }
  for (const part of parts.data ?? []) {
    if (!part.work_orders) continue;
    attention.push({
      id: `part-${part.id}`, href: `/admin/jobs/${part.work_orders.id}#parts`, kind: 'parts',
      title: `Part ${part.status}: WO #${part.work_orders.number}`, detail: part.description, since: part.created_at,
    });
  }
  attention.sort((a, b) => a.since.localeCompare(b.since));

  const last90 = paymentRows;
  return {
    today: {
      appointments: appointments.count ?? 0,
      inShop: jobs.filter((j) => IN_SHOP.includes(j.status)).length,
      awaitingApproval: jobs.filter((j) => j.status === 'awaiting_approval').length,
      unpaidCents: (openInvoices.data ?? []).reduce((sum, i) => sum + i.total_cents, 0),
      unpaidCount: openInvoices.data?.length ?? 0,
    },
    kpis: computeKpis(now, paymentRows, paidJobs, decisionLines),
    weekly: weeklyRevenue(now, paymentRows),
    byService: revenueByService(last90),
    funnel: leadFunnel((leads.data ?? []).map((l) => l.status)),
    attention,
    events: events.data ?? [],
  };
}

export type DashboardData = Awaited<ReturnType<typeof loadDashboard>>;

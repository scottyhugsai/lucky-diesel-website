import 'server-only';
import type { Tables } from '@/lib/db/database.types';
import { dateTime, firstName, money, vehicleLabel } from '@/lib/format';
import { BUSINESS } from '@/lib/site';
import { siteUrl } from '@/lib/site-url';
import { createAdminClient } from '@/lib/supabase/admin';
import type { TemplateVars } from '@/lib/messaging/template';
import { computeTotals } from '@/lib/work-orders/totals';

type Db = ReturnType<typeof createAdminClient>;

export interface Recipient {
  email: string | null;
  phone: string | null;
  customerId: string | null;
  /** Customer texts need consent; staff alerts don't. */
  isCustomer: boolean;
}

export interface RunContext {
  vars: TemplateVars;
  customer: Recipient;
  tech: Recipient | null;
  workOrderId: string | null;
  /** Why this run should not send (e.g. lead already booked). Null = send. */
  skipReason: string | null;
}

async function settings(db: Db): Promise<Tables<'shop_settings'> | null> {
  const { data } = await db.from('shop_settings').select('*').eq('id', 1).maybeSingle();
  return data;
}

export async function ownerRecipient(db: Db): Promise<Recipient> {
  const shop = await settings(db);
  return { email: shop?.owner_email ?? BUSINESS.email, phone: shop?.owner_phone ?? BUSINESS.phoneDisplay, customerId: null, isCustomer: false };
}

function baseVars(): TemplateVars {
  const base = siteUrl();
  return {
    shop_phone: BUSINESS.phoneDisplay,
    booking_link: `${base}/book`,
    portal_link: `${base}/portal`,
    admin_link: `${base}/admin`,
  };
}

function customerRecipient(customer: Pick<Tables<'customers'>, 'id' | 'email' | 'phone'> | null): Recipient {
  return { email: customer?.email ?? null, phone: customer?.phone ?? null, customerId: customer?.id ?? null, isCustomer: true };
}

async function leadContext(db: Db, id: string, automationKey: string): Promise<RunContext | null> {
  const { data: lead } = await db.from('leads').select('*').eq('id', id).maybeSingle();
  if (!lead) return null;
  const isFollowUp = automationKey.startsWith('lead_follow_up');
  return {
    vars: {
      ...baseVars(),
      customer_name: lead.full_name,
      first_name: firstName(lead.full_name),
      customer_phone: lead.phone,
      customer_email: lead.email,
      vehicle: lead.platform_label ?? 'your truck',
      service: (lead.service_label ?? 'service').toLowerCase(),
      mileage: lead.mileage || 'not given',
      details: lead.details ?? '',
      admin_link: `${siteUrl()}/admin/leads/${lead.id}`,
    },
    customer: { email: lead.email, phone: lead.phone, customerId: lead.customer_id, isCustomer: true },
    tech: null,
    workOrderId: null,
    skipReason: isFollowUp && !['new', 'contacted'].includes(lead.status) ? `lead is ${lead.status}` : null,
  };
}

async function appointmentContext(db: Db, id: string, automationKey: string): Promise<RunContext | null> {
  const { data: appointment } = await db
    .from('appointments')
    .select('*, customers(*), vehicles(*)')
    .eq('id', id)
    .maybeSingle();
  if (!appointment) return null;
  const isReminder = automationKey.startsWith('appointment_reminder');
  const inactive = ['cancelled', 'no_show', 'completed', 'checked_in'].includes(appointment.status);
  return {
    vars: {
      ...baseVars(),
      customer_name: appointment.customers?.full_name,
      first_name: firstName(appointment.customers?.full_name),
      vehicle: vehicleLabel(appointment.vehicles),
      service: appointment.service_label,
      appointment_time: dateTime(appointment.starts_at),
    },
    customer: customerRecipient(appointment.customers),
    tech: null,
    workOrderId: appointment.work_order_id,
    skipReason: isReminder && inactive ? `appointment is ${appointment.status}` : null,
  };
}

async function workOrderContext(db: Db, id: string, automationKey: string): Promise<RunContext | null> {
  const [{ data: wo }, shop] = await Promise.all([
    db.from('work_orders').select('*, customers(*), vehicles(*), line_items(*), approvals(id)').eq('id', id).maybeSingle(),
    settings(db),
  ]);
  if (!wo) return null;
  const taxRate = Number(shop?.tax_rate ?? 0);
  const lines = wo.line_items ?? [];
  const pendingOrApproved = lines.filter((l) => l.approval !== 'declined');
  const approved = lines.filter((l) => l.approval === 'approved');
  const declined = lines.filter((l) => l.approval === 'declined');

  let tech: Recipient | null = null;
  if (wo.assigned_tech_id) {
    const { data: profile } = await db.from('profiles').select('email, phone').eq('id', wo.assigned_tech_id).maybeSingle();
    tech = { email: profile?.email ?? null, phone: profile?.phone ?? null, customerId: null, isCustomer: false };
  }

  let skipReason: string | null = null;
  if (automationKey === 'estimate_nudge' && (wo.approvals?.length ?? 0) > 0) skipReason = 'estimate already answered';
  if (automationKey === 'declined_work_follow_up' && declined.length === 0) skipReason = 'nothing was declined';
  if (wo.status === 'cancelled') skipReason = 'job cancelled';

  return {
    vars: {
      ...baseVars(),
      customer_name: wo.customers?.full_name,
      first_name: firstName(wo.customers?.full_name),
      vehicle: vehicleLabel(wo.vehicles),
      work_order: wo.number,
      job_title: wo.title,
      estimate_total: money(computeTotals(pendingOrApproved, taxRate).totalCents),
      approved_total: money(computeTotals(approved, taxRate).totalCents),
      recommended_count: lines.filter((l) => l.recommended).length || lines.length,
      declined_items: declined.map((l) => l.description).join(', '),
      approval_link: `${siteUrl()}/portal/jobs/${wo.id}`,
      portal_link: `${siteUrl()}/portal/jobs/${wo.id}`,
      admin_link: `${siteUrl()}/admin/jobs/${wo.id}`,
    },
    customer: customerRecipient(wo.customers),
    tech,
    workOrderId: wo.id,
    skipReason,
  };
}

async function invoiceContext(db: Db, id: string): Promise<RunContext | null> {
  const [{ data: invoice }, shop] = await Promise.all([
    db.from('invoices').select('*, customers(*), work_orders(id, number, vehicles(*))').eq('id', id).maybeSingle(),
    settings(db),
  ]);
  if (!invoice) return null;
  return {
    vars: {
      ...baseVars(),
      customer_name: invoice.customers?.full_name,
      first_name: firstName(invoice.customers?.full_name),
      vehicle: vehicleLabel(invoice.work_orders?.vehicles),
      invoice_number: invoice.number,
      invoice_total: money(invoice.total_cents),
      work_order: invoice.work_orders?.number,
      pay_link: `${siteUrl()}/portal/invoices/${invoice.id}`,
      review_link: shop?.google_review_url || `${siteUrl()}/review`,
      portal_link: `${siteUrl()}/portal`,
    },
    customer: customerRecipient(invoice.customers),
    tech: null,
    workOrderId: invoice.work_order_id,
    skipReason: invoice.status === 'void' ? 'invoice voided' : null,
  };
}

async function customerContext(db: Db, id: string, context: Record<string, unknown>): Promise<RunContext | null> {
  const { data: customer } = await db.from('customers').select('*').eq('id', id).maybeSingle();
  if (!customer) return null;
  let vehicle = null;
  if (typeof context.vehicle_id === 'string') {
    vehicle = (await db.from('vehicles').select('*').eq('id', context.vehicle_id).maybeSingle()).data;
  }
  return {
    vars: {
      ...baseVars(),
      customer_name: customer.full_name,
      first_name: firstName(customer.full_name),
      vehicle: vehicleLabel(vehicle),
      due_service: typeof context.due_service === 'string' ? context.due_service : 'service',
    },
    customer: customerRecipient(customer),
    tech: null,
    workOrderId: null,
    skipReason: null,
  };
}

async function shopContext(db: Db): Promise<RunContext> {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay.getTime() + 86_400_000);
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const dayAgo = new Date(now.getTime() - 86_400_000);

  const [appointments, openJobs, leads, awaiting, unpaid, paid] = await Promise.all([
    db.from('appointments').select('id', { count: 'exact', head: true }).gte('starts_at', startOfDay.toISOString()).lt('starts_at', endOfDay.toISOString()).neq('status', 'cancelled'),
    db.from('work_orders').select('id', { count: 'exact', head: true }).in('status', ['approved', 'in_progress', 'waiting_parts', 'quality_check']),
    db.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', dayAgo.toISOString()),
    db.from('work_orders').select('id', { count: 'exact', head: true }).eq('status', 'awaiting_approval'),
    db.from('invoices').select('total_cents').eq('status', 'open'),
    db.from('payments').select('amount_cents').gte('created_at', weekAgo.toISOString()),
  ]);

  return {
    vars: {
      ...baseVars(),
      appointments_today: appointments.count ?? 0,
      open_jobs: openJobs.count ?? 0,
      new_leads: leads.count ?? 0,
      awaiting_approval: awaiting.count ?? 0,
      unpaid_total: money((unpaid.data ?? []).reduce((sum, row) => sum + row.total_cents, 0)),
      week_revenue: money((paid.data ?? []).reduce((sum, row) => sum + row.amount_cents, 0)),
    },
    customer: { email: null, phone: null, customerId: null, isCustomer: true },
    tech: null,
    workOrderId: null,
    skipReason: null,
  };
}

export async function buildRunContext(
  db: Db,
  run: Pick<Tables<'automation_runs'>, 'subject_type' | 'subject_id' | 'automation_key' | 'context'>,
): Promise<RunContext | null> {
  const id = run.subject_id;
  const extra = (run.context ?? {}) as Record<string, unknown>;
  switch (run.subject_type) {
    case 'lead': return id ? leadContext(db, id, run.automation_key) : null;
    case 'appointment': return id ? appointmentContext(db, id, run.automation_key) : null;
    case 'work_order': return id ? workOrderContext(db, id, run.automation_key) : null;
    case 'invoice': return id ? invoiceContext(db, id) : null;
    case 'customer': return id ? customerContext(db, id, extra) : null;
    case 'shop': return shopContext(db);
    default: return null;
  }
}

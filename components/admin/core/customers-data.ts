import 'server-only';
import { vehicleLabel } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export interface CustomerSummary {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  smsStatus: 'consented' | 'opted_out' | 'none';
  hasPortal: boolean;
  trucks: string[];
  vins: string[];
  lifetimeCents: number;
  openCents: number;
  lastVisit: string | null;
  createdAt: string;
}

export async function loadCustomers(): Promise<CustomerSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('customers')
    .select('id, full_name, phone, email, sms_consent, sms_opted_out_at, profile_id, created_at, vehicles(vin, year, make, model, engine_code), invoices(total_cents, status), work_orders(created_at, status)')
    .order('full_name')
    .limit(2000);
  if (error) throw new Error(`Could not load customers: ${error.message}`);

  return (data ?? []).map((c) => {
    const visits = c.work_orders.filter((wo) => wo.status !== 'cancelled').map((wo) => wo.created_at).sort();
    return {
      id: c.id,
      fullName: c.full_name,
      phone: c.phone,
      email: c.email,
      smsStatus: c.sms_opted_out_at ? 'opted_out' : c.sms_consent ? 'consented' : 'none',
      hasPortal: Boolean(c.profile_id),
      trucks: c.vehicles.map((v) => vehicleLabel(v)),
      vins: c.vehicles.map((v) => v.vin ?? '').filter(Boolean),
      lifetimeCents: c.invoices.filter((i) => i.status === 'paid').reduce((sum, i) => sum + i.total_cents, 0),
      openCents: c.invoices.filter((i) => i.status === 'open').reduce((sum, i) => sum + i.total_cents, 0),
      lastVisit: visits.at(-1) ?? null,
      createdAt: c.created_at,
    };
  });
}

export function searchCustomers(customers: CustomerSummary[], q: string): CustomerSummary[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return customers;
  const digits = needle.replace(/\D/g, '');
  return customers.filter((c) =>
    c.fullName.toLowerCase().includes(needle) ||
    (c.email ?? '').toLowerCase().includes(needle) ||
    (digits.length >= 3 && (c.phone ?? '').replace(/\D/g, '').includes(digits)) ||
    c.vins.some((v) => v.toLowerCase().includes(needle)) ||
    c.trucks.some((t) => t.toLowerCase().includes(needle)));
}

export async function loadCustomerDetail(id: string) {
  const supabase = await createClient();
  const [customer, jobs, invoices, leads, messages] = await Promise.all([
    supabase.from('customers').select('*, vehicles(*)').eq('id', id).maybeSingle(),
    supabase.from('work_orders').select('id, number, title, status, created_at, vehicle_id, line_items(kind, quantity, unit_price_cents, taxable, approval)').eq('customer_id', id).order('created_at', { ascending: false }),
    supabase.from('invoices').select('id, number, status, total_cents, created_at, due_at, paid_at').eq('customer_id', id).order('created_at', { ascending: false }),
    supabase.from('leads').select('id, status, service_label, platform_label, details, source, created_at').eq('customer_id', id).order('created_at', { ascending: false }),
    supabase.from('messages').select('id, channel, direction, to_address, subject, body, status, error, automation_key, created_at').eq('customer_id', id).order('created_at', { ascending: false }).limit(30),
  ]);
  if (customer.error) throw new Error(`Could not load customer: ${customer.error.message}`);
  if (!customer.data) return null;
  return {
    customer: customer.data,
    jobs: jobs.data ?? [],
    invoices: invoices.data ?? [],
    leads: leads.data ?? [],
    messages: messages.data ?? [],
  };
}

export type CustomerDetail = NonNullable<Awaited<ReturnType<typeof loadCustomerDetail>>>;

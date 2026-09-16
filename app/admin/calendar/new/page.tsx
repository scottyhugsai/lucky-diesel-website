import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { DemoCustomer } from '@/components/admin/ops/DemoTools';
import { isDate, isUuid } from '@/components/admin/ops/form';
import { NewAppointmentForm } from '@/components/admin/ops/NewAppointmentForm';
import { shopDate } from '@/components/admin/ops/time';
import { PageHeader } from '@/components/app/ui';
import { requireRole } from '@/lib/auth';
import { vehicleLabel } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'New appointment | Lucky Diesel admin' };

const CUSTOMER_LIMIT = 500;

export default async function NewAppointmentPage({ searchParams }: { searchParams: Promise<{ customer?: string; date?: string }> }) {
  await requireRole('admin');
  const params = await searchParams;
  const today = shopDate();
  const supabase = await createClient();
  const { data } = await supabase
    .from('customers')
    .select('id, full_name, vehicles(id, year, make, model, engine_code, nickname)')
    .order('full_name')
    .limit(CUSTOMER_LIMIT);

  const customers: DemoCustomer[] = (data ?? []).map((c) => ({
    id: c.id,
    name: c.full_name,
    vehicles: (c.vehicles ?? []).map((v) => ({ id: v.id, label: v.nickname ? `${vehicleLabel(v)} “${v.nickname}”` : vehicleLabel(v) })),
  }));
  const initialCustomerId = isUuid(params.customer) && customers.some((c) => c.id === params.customer) ? params.customer : '';
  const initialDate = isDate(params.date) && params.date >= today ? params.date : today;

  return (
    <>
      <Link href="/admin/calendar" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-steel hover:text-clover">
        <ArrowLeft className="size-4" aria-hidden="true" /> Calendar
      </Link>
      <PageHeader kicker="Calendar" title="New appointment" description="Only open slots show up, based on shop hours and bay capacity." />
      <NewAppointmentForm customers={customers} initialCustomerId={initialCustomerId} initialDate={initialDate} />
    </>
  );
}

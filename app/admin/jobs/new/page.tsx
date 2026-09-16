import { NewJobForm } from '@/components/admin/core/NewJobForm';
import { UUID_RE } from '@/components/admin/core/parse';
import { PageHeader } from '@/components/app/ui';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'New job | Lucky Diesel Admin' };

export default async function NewJobPage({ searchParams }: { searchParams: Promise<{ customer?: string | string[] }> }) {
  await requireRole('admin');
  const { customer } = await searchParams;
  const initialCustomerId = typeof customer === 'string' && UUID_RE.test(customer) ? customer : null;
  const supabase = await createClient();

  const [customers, techs, settings] = await Promise.all([
    supabase.from('customers').select('id, full_name, phone, email, vehicles(id, year, make, model, engine_code, vin)').order('full_name').limit(1000),
    supabase.from('profiles').select('id, full_name').eq('role', 'employee').eq('active', true).order('full_name'),
    supabase.from('shop_settings').select('labor_rate_cents, bay_count').eq('id', 1).maybeSingle(),
  ]);
  if (customers.error) throw new Error(`Could not load customers: ${customers.error.message}`);

  const bayCount = settings.data?.bay_count ?? 3;
  return (
    <div>
      <PageHeader kicker="Jobs" title="New job" description="Pick the customer and truck, start from a template, and it lands on the board as an estimate." />
      <NewJobForm
        customers={customers.data ?? []}
        techs={techs.data ?? []}
        bays={Array.from({ length: bayCount }, (_, i) => `Bay ${i + 1}`)}
        laborRateCents={settings.data?.labor_rate_cents ?? 16500}
        initialCustomerId={initialCustomerId}
      />
    </div>
  );
}

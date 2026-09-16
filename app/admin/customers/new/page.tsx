import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { CustomerForm } from '@/components/admin/core/CustomerForms';
import { PageHeader } from '@/components/app/ui';
import { requireRole } from '@/lib/auth';

export const metadata = { title: 'New customer | Lucky Diesel Admin' };

export default async function NewCustomerPage() {
  await requireRole('admin');
  return (
    <div className="max-w-3xl">
      <Link href="/admin/customers" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-steel hover:text-chalk">
        <ArrowLeft className="size-4" aria-hidden="true" /> Customers
      </Link>
      <PageHeader kicker="Customers" title="New customer" description="Add their trucks and start a job from the next screen. Texts stay off until you record their consent." />
      <div className="rounded-md border border-line bg-carbon-2 p-4 sm:p-6">
        <CustomerForm />
      </div>
    </div>
  );
}

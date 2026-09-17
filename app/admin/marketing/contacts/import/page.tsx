import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ContactImport } from '@/components/admin/marketing/core-ui/ContactImport';
import { Card, PageHeader } from '@/components/app/ui';
import { requireRole } from '@/lib/auth';
import { dateTime } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Import contacts | Marketing' };

export default async function ImportContactsPage() {
  await requireRole('admin');
  const supabase = await createClient();
  const { data: imports } = await supabase
    .from('contact_imports')
    .select('id, file_name, total_rows, created_count, updated_count, skipped_count, email_opt_ins, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  return (
    <>
      <Link href="/admin/marketing/contacts" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-steel hover:text-clover">
        <ArrowLeft className="size-4" aria-hidden="true" /> All contacts
      </Link>
      <PageHeader kicker="Contacts" title="Import CSV" description="Match your columns, then dry run before importing." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card title="Upload"><ContactImport /></Card>
        <div className="grid content-start gap-6">
          <Card title="Rules">
            <ul className="grid gap-2 text-sm text-chalk/75">
              <li>Matches people by email or phone; only fills blanks and adds tags.</li>
              <li>Everyone gets an <span className="font-mono text-xs">imported</span> tag.</li>
              <li>Dead email domains are dropped, not imported.</li>
              <li>Texting consent is never imported — get it from the person.</li>
              <li>Anyone who opted out before stays out.</li>
            </ul>
          </Card>
          <Card title="Recent imports">
            {imports?.length ? (
              <ol className="grid gap-2">
                {imports.map((row) => (
                  <li key={row.id} className="border-b border-line pb-2 text-sm last:border-b-0 last:pb-0">
                    <p className="truncate font-semibold">{row.file_name}</p>
                    <p className="text-xs text-steel">
                      {row.created_count} new · {row.updated_count} updated · {row.skipped_count} skipped · {row.email_opt_ins} opt-ins
                    </p>
                    <time className="text-xs text-steel" dateTime={row.created_at}>{dateTime(row.created_at)}</time>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-steel">No imports yet.</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

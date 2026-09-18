import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { EmptyState, PageHeader, TableWrap, tableClass } from '@/components/app/ui';
import { requireRole } from '@/lib/auth';
import { dateTime } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Website history | Lucky Diesel admin' };

export default async function SiteHistoryPage() {
  await requireRole('admin');
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('site_audit_log')
    .select('id, action, entity, entity_key, summary, actor_email, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  const entries = data ?? [];

  return (
    <>
      <Link href="/admin/site" className="mb-4 inline-flex items-center gap-1.5 text-sm text-steel hover:text-chalk">
        <ArrowLeft className="size-4" aria-hidden="true" /> Site control
      </Link>
      <PageHeader kicker="Website" title="Change history" description="Every edit to the website, most recent first." />
      {error && <p role="alert" className="mb-4 text-sm text-danger">Couldn’t load the history: {error.message}</p>}
      {entries.length === 0 ? (
        <EmptyState title="Nothing yet">Changes to the website will be listed here.</EmptyState>
      ) : (
        <TableWrap>
          <table className={tableClass}>
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Who</th>
                <th scope="col">What</th>
                <th scope="col">Change</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="whitespace-nowrap text-steel">{dateTime(entry.created_at)}</td>
                  <td className="text-steel">{entry.actor_email ?? '—'}</td>
                  <td>
                    <span className="font-semibold">{entry.action}</span>
                    <p className="text-xs text-steel">{entry.entity_key}</p>
                  </td>
                  <td className="text-steel">{entry.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </>
  );
}

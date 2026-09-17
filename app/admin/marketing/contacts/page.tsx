import Link from 'next/link';
import { Upload } from 'lucide-react';
import { ContactFiltersForm, ContactList } from '@/components/admin/marketing/core-ui/ContactList';
import { loadContacts } from '@/components/admin/marketing/core-ui/contacts-data';
import { ButtonLink, EmptyState, PageHeader } from '@/components/app/ui';
import { requireRole } from '@/lib/auth';
import { money } from '@/lib/format';

export const metadata = { title: 'Contacts | Marketing' };

type Params = Record<string, string | string[] | undefined>;

function first(params: Params, key: string, max = 80): string {
  const value = params[key];
  return (Array.isArray(value) ? value[0] : value)?.slice(0, max) ?? '';
}

export default async function ContactsPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireRole('admin');
  const params = await searchParams;
  const filters = { q: first(params, 'q'), stage: first(params, 'stage', 20), consent: first(params, 'consent', 10), tag: first(params, 'tag', 40) };
  const { rows, total, tags, error } = await loadContacts(filters);
  const filtered = Boolean(filters.q || filters.stage || filters.consent || filters.tag);
  const ltv = rows.reduce((sum, r) => sum + r.ltvCents, 0);

  return (
    <>
      <PageHeader kicker="Contacts" title="Your people" description="Find anyone. Tap to see their full history."
        actions={<ButtonLink href="/admin/marketing/contacts/import" variant="secondary" size="sm"><Upload className="size-4" aria-hidden="true" /> Import CSV</ButtonLink>} />
      <ContactFiltersForm filters={filters} tags={tags} />
      {error && <p role="alert" className="mb-4 text-sm text-danger">Couldn’t load contacts: {error}</p>}
      <p className="mb-3 text-sm text-steel" aria-live="polite">
        {total} contact{total === 1 ? '' : 's'} · {money(ltv, { whole: true })} lifetime value
        {filtered && <> · <Link href="/admin/marketing/contacts" className="text-clover hover:underline">Clear filters</Link></>}
        {total > rows.length && ` · showing first ${rows.length}`}
      </p>
      {rows.length ? <ContactList rows={rows} /> : <EmptyState title="No matches">Try fewer filters.</EmptyState>}
    </>
  );
}

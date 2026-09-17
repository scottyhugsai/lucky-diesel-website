import Link from 'next/link';
import { addBioLinkAction, createLanding, createMagnet, removeBioLinkAction, setMagnetPublished } from '@/app/admin/marketing/pages/actions';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import { ToggleButton } from '@/components/admin/marketing/growth-ui/forms';
import { Field, SampleTag, SubTabs, areaClass, shortDate } from '@/components/admin/marketing/growth-ui/kit';
import { loadLandingPages, loadMagnets } from '@/components/admin/marketing/growth-ui/pages-data';
import { AbTestCard, PopupCard, PriceRangeCard, SiteBarCard } from '@/components/admin/marketing/growth-ui/SitePanels';
import { loadSiteData } from '@/components/admin/marketing/growth-ui/site-data';
import { Badge, Card, EmptyState, PageHeader, fieldClass } from '@/components/app/ui';
import { requireRole } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const metadata = { title: 'Pages | Lucky Diesel admin' };

async function LandingSection() {
  const pages = await loadLandingPages();
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section aria-label="Landing pages" className="min-w-0">
        {pages.length === 0 ? <EmptyState title="No pages yet">Make one on the right.</EmptyState> : (
          <ul className="grid gap-3">
            {pages.map((p) => (
              <li key={p.id}>
                <Link href={`/admin/marketing/pages/${p.id}`} className="grid gap-3 rounded-md border border-line bg-carbon-2 p-4 transition-colors hover:border-clover/60 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-5">
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="display text-xl not-italic">{p.title}</span>
                      {p.published ? <Badge tone="good">Live</Badge> : <Badge tone="warn">Draft</Badge>}
                      {p.isSample && <SampleTag />}
                    </span>
                    <span className="mt-1 block truncate font-mono text-xs text-steel">/l/{p.slug} · edited {shortDate(p.updatedAt)}</span>
                  </span>
                  <span className="flex gap-6">
                    <span><span className="block text-xs uppercase tracking-widest text-steel">Views</span><span className="font-mono text-2xl tabular-nums">{p.views}</span></span>
                    <span><span className="block text-xs uppercase tracking-widest text-steel">Leads</span><span className="font-mono text-2xl tabular-nums text-clover">{p.leads}</span></span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Card title="New page">
        <ActionForm action={createLanding} className="grid gap-3" aria-label="New landing page">
          <Field label="Title" htmlFor="np-title"><input id="np-title" name="title" required maxLength={80} placeholder="Winter fuel special" className={fieldClass} /></Field>
          <Field label="Link" htmlFor="np-slug" hint="Blank = made from the title."><input id="np-slug" name="slug" maxLength={60} placeholder="winter-fuel" className={fieldClass} /></Field>
          <PendingButton>Create page</PendingButton>
        </ActionForm>
      </Card>
    </div>
  );
}

async function MagnetSection() {
  const magnets = await loadMagnets();
  const sent = magnets[0]?.sent30d ?? 0;
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section aria-label="Lead magnets" className="grid grid-cols-1 content-start gap-3">
        <p className="text-sm text-chalk/65">{sent} checklist emails sent in the last 30 days.</p>
        {magnets.length === 0 ? <EmptyState title="No checklists yet" /> : (
          <ul className="grid gap-3">
            {magnets.map((m) => (
              <li key={m.id} className="grid gap-3 rounded-md border border-line bg-carbon-2 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-5">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2"><span className="font-semibold">{m.title}</span>{m.published ? <Badge tone="good">Live</Badge> : <Badge tone="warn">Hidden</Badge>}{m.isSample && <SampleTag />}</p>
                  <p className="mt-1 text-sm text-chalk/65">{m.description}</p>
                  <p className="mt-1 text-xs text-steel">{m.items} items · on {m.pages} page{m.pages === 1 ? '' : 's'} · also offered in the site popup</p>
                </div>
                <div className="flex items-center gap-4">
                  <span><span className="block text-xs uppercase tracking-widest text-steel">Sent</span><span className="font-mono text-2xl tabular-nums text-clover">{m.downloads}</span></span>
                  <ToggleButton action={setMagnetPublished} name="published" hidden={{ magnet_id: m.id }} next={!m.published} onLabel="Publish" offLabel="Hide" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Card title="New checklist">
        <ActionForm action={createMagnet} resetOnSuccess className="grid gap-3" aria-label="New checklist">
          <Field label="Title" htmlFor="nm-title"><input id="nm-title" name="title" required maxLength={80} placeholder="Winter diesel checklist" className={fieldClass} /></Field>
          <Field label="One-line pitch" htmlFor="nm-desc"><input id="nm-desc" name="description" required maxLength={240} className={fieldClass} /></Field>
          <Field label="Checklist" htmlFor="nm-items" hint="One item per line."><textarea id="nm-items" name="items" rows={6} required className={areaClass} /></Field>
          <label className="flex items-center gap-2 text-sm text-chalk/75"><input type="checkbox" name="published" defaultChecked className="size-4 accent-clover" /> Publish now</label>
          <PendingButton>Save checklist</PendingButton>
        </ActionForm>
      </Card>
    </div>
  );
}

/** The /links page for Instagram and TikTok bios. Every button is a counted short link. */
async function BioSection() {
  const { data } = await createAdminClient()
    .from('bio_links')
    .select('id, label, sort, short_links(code, clicks)')
    .eq('active', true)
    .order('sort')
    .limit(20);
  const rows = data ?? [];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section aria-label="Bio buttons" className="min-w-0">
        <p className="mb-3 text-sm text-chalk/70">
          Live at <Link href="/links" className="font-semibold text-clover hover:underline">/links</Link>. With no buttons it falls back to booking, offers, the store and the gallery.
        </p>
        {rows.length === 0 ? (
          <EmptyState title="Using the defaults">Add a button to take over the page.</EmptyState>
        ) : (
          <ul className="grid gap-2">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-3 rounded-md border border-line bg-carbon-2 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">{row.label}</span>
                  <span className="block font-mono text-xs text-steel">/r/{row.short_links?.code} · {row.short_links?.clicks ?? 0} taps</span>
                </span>
                <ActionForm action={removeBioLinkAction} feedback="none" confirm="Remove this button?" aria-label="Remove button">
                  <input type="hidden" name="id" value={row.id} />
                  <PendingButton variant="ghost" size="sm">Remove</PendingButton>
                </ActionForm>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Card title="New button">
        <ActionForm action={addBioLinkAction} resetOnSuccess className="grid gap-3" aria-label="New bio button">
          <Field label="Label" htmlFor="bio-label"><input id="bio-label" name="label" required maxLength={60} placeholder="Tow-season inspection" className={fieldClass} /></Field>
          <Field label="Goes to" htmlFor="bio-target" hint="A path on this site, like /l/tow-ready."><input id="bio-target" name="target" required maxLength={500} placeholder="/l/tow-ready" className={fieldClass} /></Field>
          <Field label="Order" htmlFor="bio-sort"><input id="bio-sort" name="sort" type="number" step={1} min={0} max={99} defaultValue={rows.length + 1} className={fieldClass} /></Field>
          <PendingButton>Add button</PendingButton>
        </ActionForm>
      </Card>
    </div>
  );
}

/** Site-wide engagement: the bar, popups, starting-at prices and wording tests. */
async function SiteSection() {
  const data = await loadSiteData();
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
      <SiteBarCard data={data} />
      <PriceRangeCard data={data} />
      <PopupCard data={data} />
      <AbTestCard data={data} />
    </div>
  );
}

export default async function PagesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireRole('admin');
  const { tab } = await searchParams;
  const active = tab === 'magnets' ? 'magnets' : tab === 'links' ? 'links' : tab === 'site' ? 'site' : 'landing';
  return (
    <>
      <PageHeader kicker="Marketing" title="Pages" description="Pages and checklists that turn clicks into leads." />
      <SubTabs label="Page type" active={active} items={[
        { key: 'landing', label: 'Landing pages', href: '/admin/marketing/pages' },
        { key: 'magnets', label: 'Free checklists', href: '/admin/marketing/pages?tab=magnets' },
        { key: 'links', label: 'Link in bio', href: '/admin/marketing/pages?tab=links' },
        { key: 'site', label: 'Site widgets', href: '/admin/marketing/pages?tab=site' },
      ]} />
      {active === 'landing' ? <LandingSection /> : active === 'magnets' ? <MagnetSection /> : active === 'links' ? <BioSection /> : <SiteSection />}
    </>
  );
}

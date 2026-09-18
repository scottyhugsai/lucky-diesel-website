import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BlockForm } from '@/components/admin/site/BlockForm';
import { PageHeader } from '@/components/app/ui';
import { requireRole } from '@/lib/auth';
import { DESIGNS, DESIGN_LABELS } from '@/lib/design';
import type { BlockGroup } from '@/lib/site-content/fields';
import { GROUPS, blocksInGroup } from '@/lib/site-content/registry';
import { editorValues, findStored, loadBlocks, loadLibrary, statusOf } from '../data';

interface GroupPageProps {
  params: Promise<{ group: string }>;
  searchParams: Promise<{ design?: string }>;
}

const SCOPES = ['all', ...DESIGNS] as const;

function scopeLabel(scope: string): string {
  return scope === 'all' ? 'All designs' : (DESIGN_LABELS[scope as (typeof DESIGNS)[number]] ?? scope);
}

export async function generateMetadata({ params }: GroupPageProps) {
  const { group: groupId } = await params;
  const group = GROUPS.find((entry) => entry.id === groupId);
  return { title: `${group?.label ?? 'Website'} | Lucky Diesel admin` };
}

export default async function SiteGroupPage({ params, searchParams }: GroupPageProps) {
  await requireRole('admin');
  const { group: groupId } = await params;
  const group = GROUPS.find((entry) => entry.id === groupId);
  if (!group) notFound();

  const requested = (await searchParams).design;
  const design = (SCOPES as readonly string[]).includes(requested ?? '') ? (requested as string) : 'all';
  const [blocks, library] = await Promise.all([loadBlocks(), loadLibrary()]);
  const defs = blocksInGroup(group.id as BlockGroup);

  return (
    <>
      <PageHeader kicker="Website" title={group.label} description={group.blurb} />

      <nav aria-label="Which design" className="mb-4 flex flex-wrap gap-2">
        {SCOPES.map((scope) => (
          <Link
            key={scope}
            href={`/admin/site/${group.id}${scope === 'all' ? '' : `?design=${scope}`}`}
            aria-current={scope === design ? 'page' : undefined}
            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${scope === design ? 'border-clover bg-clover/15 text-clover' : 'border-line text-steel hover:border-chalk/40'}`}
          >
            {scopeLabel(scope)}
          </Link>
        ))}
      </nav>
      <p className="mb-5 max-w-2xl text-sm text-steel">
        {design === 'all'
          ? 'These words are used by every design. Pick a design above only if you want different wording on that one.'
          : `Only the ${scopeLabel(design)} design uses what you write here. Anything left blank falls back to “All designs”.`}
      </p>

      <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
        {defs.map((def) => {
          const stored = findStored(blocks, def.key, design);
          return (
            <BlockForm
              key={def.key}
              def={def}
              design={design}
              values={editorValues(def, stored ?? (design === 'all' ? null : findStored(blocks, def.key, 'all')), design)}
              status={statusOf(def, stored)}
              library={library}
            />
          );
        })}
      </div>
    </>
  );
}

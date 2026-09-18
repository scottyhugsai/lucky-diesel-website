import { ArrowUpRight, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import { Badge, Card, PageHeader, buttonClass } from '@/components/app/ui';
import { requireRole } from '@/lib/auth';
import { GROUPS, blocksInGroup } from '@/lib/site-content/registry';
import { isPreviewing } from '@/lib/site-content/read';
import { createClient } from '@/lib/supabase/server';
import { publishEverythingAction, setPreviewAction } from './actions';
import { countDrafts, findStored, loadBlocks, statusOf } from './data';

export const metadata = { title: 'Website | Lucky Diesel admin' };

export default async function SiteHubPage() {
  await requireRole('admin');
  const [blocks, preview] = await Promise.all([loadBlocks(), isPreviewing()]);
  const drafts = countDrafts(blocks);

  const supabase = await createClient();
  const { data: recent } = await supabase
    .from('site_audit_log')
    .select('id, action, entity_key, summary, actor_email, created_at')
    .order('created_at', { ascending: false })
    .limit(6);

  return (
    <>
      <PageHeader
        kicker="Website"
        title="Site control"
        description="Edit the public website. Changes are saved as drafts until you publish them."
        actions={
          <a href="/" target="_blank" rel="noopener noreferrer" className={buttonClass('secondary')}>
            View site <ArrowUpRight className="size-4" aria-hidden="true" />
          </a>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Unpublished changes">
          <p className="text-sm text-steel">
            {drafts === 0 ? 'Everything you have edited is live.' : `${drafts} section${drafts === 1 ? ' has' : 's have'} edits that nobody can see yet.`}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <ActionForm action={publishEverythingAction} className="contents" confirm="Publish every draft to the live site?">
              <PendingButton disabled={drafts === 0}>Publish all changes</PendingButton>
            </ActionForm>
            <ActionForm action={setPreviewAction} className="contents">
              <input type="hidden" name="on" value={preview ? 'false' : 'true'} />
              <PendingButton variant="secondary">
                {preview ? <><EyeOff className="size-4" aria-hidden="true" /> Stop previewing</> : <><Eye className="size-4" aria-hidden="true" /> Preview drafts</>}
              </PendingButton>
            </ActionForm>
          </div>
          {preview && (
            <p className="mt-3 rounded-md border border-clover/40 bg-clover/10 px-3 py-2 text-sm">
              Preview is on. The site shows your drafts — but only to you, while you are signed in.
            </p>
          )}
        </Card>

        <Card title="Recent changes" action={<Link href="/admin/site/history" className="text-sm text-clover hover:underline">All history</Link>}>
          {(recent ?? []).length === 0 ? (
            <p className="text-sm text-steel">Nothing has been changed yet.</p>
          ) : (
            <ol className="space-y-2.5">
              {(recent ?? []).map((entry) => (
                <li key={entry.id} className="text-sm">
                  <span className="font-semibold">{entry.action}</span>{' '}
                  <span className="text-steel">{entry.entity_key}</span>
                  <p className="text-xs text-steel">{entry.summary} · {new Date(entry.created_at).toLocaleString('en-US')}</p>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {GROUPS.map((group) => {
          const pending = blocksInGroup(group.id).filter((def) => statusOf(def, findStored(blocks, def.key, 'all')) === 'draft').length;
          return (
            <Link key={group.id} href={`/admin/site/${group.id}`} className="rounded-md border border-line bg-carbon-2 p-4 transition-colors hover:border-clover">
              <div className="flex items-center justify-between gap-2">
                <h2 className="display text-xl not-italic">{group.label}</h2>
                {pending > 0 && <Badge tone="warn">{pending} draft</Badge>}
              </div>
              <p className="mt-1 text-sm text-steel">{group.blurb}</p>
            </Link>
          );
        })}
        <Link href="/admin/site/media" className="rounded-md border border-line bg-carbon-2 p-4 transition-colors hover:border-clover">
          <h2 className="display text-xl not-italic">Media</h2>
          <p className="mt-1 text-sm text-steel">Photos you can use anywhere on the site.</p>
        </Link>
        <Link href="/admin/site/parts" className="rounded-md border border-line bg-carbon-2 p-4 transition-colors hover:border-clover">
          <h2 className="display text-xl not-italic">Parts listings</h2>
          <p className="mt-1 text-sm text-steel">Retitle, re-photograph, hide or feature a part.</p>
        </Link>
      </div>
    </>
  );
}

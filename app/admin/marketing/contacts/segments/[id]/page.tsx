import { notFound } from 'next/navigation';
import { RefreshCw, Trash2 } from 'lucide-react';
import { deleteSegmentAction, refreshSegmentAction } from '@/app/admin/marketing/contacts/segment-actions';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import { UUID_RE } from '@/components/admin/core/parse';
import { SegmentBuilder } from '@/components/admin/marketing/core-ui/SegmentBuilder';
import { PageHeader } from '@/components/app/ui';
import { requireRole } from '@/lib/auth';
import { relativeTime } from '@/lib/format';
import { parseSegmentRules } from '@/lib/marketing/core/segment-rules';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Segment | Marketing' };

export default async function SegmentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string }> }) {
  await requireRole('admin');
  const [{ id }, { notice }] = await Promise.all([params, searchParams]);
  if (!UUID_RE.test(id)) notFound();
  const supabase = await createClient();
  const { data: segment } = await supabase.from('segments').select('*').eq('id', id).maybeSingle();
  if (!segment) notFound();
  const parsed = parseSegmentRules(segment.rules);

  return (
    <>
      <PageHeader
        kicker="Segment"
        title={segment.name}
        description={`${segment.member_count} people · ${segment.refreshed_at ? `refreshed ${relativeTime(segment.refreshed_at)}` : 'never refreshed'}`}
        actions={
          <>
            <ActionForm action={refreshSegmentAction}>
              <input type="hidden" name="id" value={id} />
              <PendingButton variant="secondary" size="sm"><RefreshCw className="size-4" aria-hidden="true" /> Refresh</PendingButton>
            </ActionForm>
            <ActionForm action={deleteSegmentAction} confirm="Delete this segment?">
              <input type="hidden" name="id" value={id} />
              <PendingButton variant="danger" size="sm"><Trash2 className="size-4" aria-hidden="true" /> Delete</PendingButton>
            </ActionForm>
          </>
        }
      />
      {notice && <p role="status" className="mb-4 rounded-sm border border-clover/35 bg-clover/10 px-3 py-2 text-sm font-semibold text-clover">{notice.slice(0, 200)}</p>}
      {!parsed.ok && <p role="alert" className="mb-4 text-sm text-danger">Stored rules are invalid: {parsed.error}</p>}
      <SegmentBuilder id={id} name={segment.name} description={segment.description} rules={parsed.ok ? parsed.rules : undefined} />
    </>
  );
}

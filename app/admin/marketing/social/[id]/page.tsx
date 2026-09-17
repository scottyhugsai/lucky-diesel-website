import { notFound } from 'next/navigation';
import { CalendarClock, Send } from 'lucide-react';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import { toShopInputValue } from '@/components/admin/core/parse';
import { Badge, ButtonLink, Card, PageHeader, fieldClass } from '@/components/app/ui';
import { ComplianceBadge, IssueList, Notice, SectionTabs, StatusBadge } from '@/components/admin/marketing/studio/Bits';
import { SOCIAL_LABEL, SOCIAL_TABS } from '@/components/admin/marketing/studio/labels';
import { PostEditor } from '@/components/admin/marketing/studio/PostEditor';
import { pickerOptions, timeSuggestions } from '@/components/admin/marketing/studio/post-editor-data';
import { requireRole } from '@/lib/auth';
import { dateTime } from '@/lib/format';
import { adminDb } from '@/lib/marketing/content/db';
import { SOCIAL_PLATFORMS } from '@/components/admin/marketing/studio/labels';
import type { ClaimIssue, ComplianceStatus, SocialPlatform } from '@/lib/marketing/content/types';
import { movePost, publishNow, savePost, schedulePost, writeCaption } from '../actions';

export const metadata = { title: 'Post | Lucky Diesel admin' };

const UUID = /^[0-9a-f-]{36}$/i;

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole('admin');
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const db = adminDb();
  const { data: post } = await db.from('social_posts').select('*, social_post_targets(*)').eq('id', id).maybeSingle();
  if (!post) notFound();

  const networks = SOCIAL_PLATFORMS.filter((p) => post.social_post_targets.some((t) => t.platform === p));
  const [images, suggestions] = await Promise.all([pickerOptions({ id: post.id, hasImage: Boolean(post.image_template) }), timeSuggestions(networks[0] ?? 'instagram')]);
  const published = post.status === 'published';
  const canPost = ['approved', 'scheduled'].includes(post.status);
  const postId = <input type="hidden" name="postId" value={post.id} />;

  return (
    <>
      <PageHeader
        kicker="Marketing · Social"
        title="Post"
        description={post.title}
        actions={post.status === 'pending_approval' ? <ButtonLink href="/admin/marketing/ads/approvals">Review approval</ButtonLink> : undefined}
      />
      <SectionTabs tabs={SOCIAL_TABS} active="/admin/marketing/social" />
      <div className="mb-4 flex flex-wrap gap-2">
        <StatusBadge status={post.status} />
        <ComplianceBadge status={post.compliance_status as ComplianceStatus} />
        {post.needs_privacy_review && <Badge tone="warn">Check plates/faces</Badge>}
        {post.pillar && <Badge tone="violet">{post.pillar.replace(/_/g, ' ')}</Badge>}
      </div>
      {post.needs_privacy_review && <Notice tone="warn" title="Owner photo: check before posting">{post.privacy_note ?? 'Blur plates, VINs and faces unless you have a release.'}</Notice>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
        <Card title="Edit">
          {published ? <p className="text-sm text-chalk/60">Published posts can’t change.</p> : (
            <PostEditor
              draft={{ id: post.id, title: post.title, caption: post.caption, hashtags: post.hashtags.join(' '), networks: networks.length ? networks : ['instagram'], scheduledFor: toShopInputValue(post.scheduled_for), image: post.image_template ? 'keep' : 'none' }}
              images={images}
              suggestions={suggestions}
              save={savePost}
              write={writeCaption}
            />
          )}
          <IssueList issues={Array.isArray(post.compliance_issues) ? (post.compliance_issues as unknown as ClaimIssue[]) : []} />
        </Card>

        <div className="grid gap-6">
          <Card title="Publish">
            <p className="mb-3 text-sm text-chalk/65">{post.scheduled_for ? `Set for ${dateTime(post.scheduled_for)}` : 'No time set'}</p>
            {!canPost && !published && <p className="mb-3 text-sm text-amber-300">Approve it before posting.</p>}
            <div className="grid gap-2">
              <ActionForm action={publishNow} confirm="Post to every selected network now?">{postId}<PendingButton disabled={!canPost} className="w-full"><Send className="size-4" aria-hidden="true" />Publish now</PendingButton></ActionForm>
              <ActionForm action={schedulePost}>{postId}<PendingButton variant="secondary" disabled={post.status !== 'approved'} className="w-full"><CalendarClock className="size-4" aria-hidden="true" />{post.status === 'scheduled' ? 'Scheduled' : 'Schedule it'}</PendingButton></ActionForm>
            </div>
          </Card>

          {!published && (
            <Card title="Move">
              <ActionForm action={movePost} className="grid gap-2">
                {postId}
                <label htmlFor="move-when" className="text-sm text-chalk/65">New time. Needs re-approval.</label>
                <input id="move-when" name="scheduledFor" type="datetime-local" className={fieldClass} defaultValue={toShopInputValue(post.scheduled_for)} required />
                <PendingButton size="sm" variant="secondary">Move post</PendingButton>
              </ActionForm>
            </Card>
          )}

          <Card title="Networks">
            <ul className="grid gap-2">
              {post.social_post_targets.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <strong>{SOCIAL_LABEL[t.platform as SocialPlatform] ?? t.platform}</strong>
                  <span className="flex items-center gap-1.5">
                    <StatusBadge status={t.status} />
                    {t.simulated && t.status !== 'pending' && <Badge tone="info">Demo</Badge>}
                  </span>
                  {t.error && <p className="basis-full text-xs text-danger">{t.error}</p>}
                  {t.platform === 'tiktok' && <p className="basis-full text-xs text-chalk/55">Private until TikTok audits the app.</p>}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}

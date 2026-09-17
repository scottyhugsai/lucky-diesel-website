import { recycleEvergreenAction, toggleCommunityTaskAction } from '@/app/admin/marketing/social/actions';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import { CopyButton } from '@/components/admin/marketing/growth-ui/CopyButton';
import { Badge, Card } from '@/components/app/ui';
import { COMMUNITY_TASKS, monthPeriod, nextdoorPost, pickEvergreen, shotListFor, weekPeriod, type RecycleCandidate } from '@/lib/marketing/content/social';
import { adminDb } from '@/lib/marketing/content/db';
import { siteUrl } from '@/lib/site-url';

/**
 * This week's organic to-dos: an old post worth another run, the community
 * tasks, the monthly Nextdoor copy (no API) and the shot list for open jobs.
 */
export async function IdeasPanel() {
  const db = adminDb();
  const now = new Date();
  const [{ data: posts }, { data: ticks }, { data: jobs }] = await Promise.all([
    db.from('social_posts').select('id, title, source_type, published_at, compliance_status, needs_privacy_review, last_recycled_at').eq('status', 'published').limit(200),
    db.from('social_task_log').select('task_key, period').eq('period', weekPeriod(now)),
    db.from('work_orders').select('title, status').in('status', ['in_progress', 'awaiting_approval', 'ready']).limit(10),
  ]);

  const candidates: RecycleCandidate[] = (posts ?? []).map((p) => ({
    // Post-level click counts need a connected platform; oldest-first is the honest order until then.
    id: p.id, sourceType: p.source_type, publishedAt: p.published_at, clicks: 0,
    complianceStatus: p.compliance_status, needsPrivacyReview: p.needs_privacy_review, lastRecycledAt: p.last_recycled_at,
  }));
  const evergreen = pickEvergreen(candidates, now);
  const titleById = new Map((posts ?? []).map((p) => [p.id, p.title]));
  const done = new Set((ticks ?? []).map((t) => t.task_key));
  const shots = shotListFor((jobs ?? []).map((job) => job.title));
  const nextdoor = nextdoorPost(now.getMonth() + 1, `${siteUrl()}/book`);

  return (
    <Card title="This week’s ideas">
      <div className="grid gap-5">
        <section aria-labelledby="idea-evergreen">
          <h3 id="idea-evergreen" className="mb-2 text-xs font-bold uppercase tracking-widest text-steel">Worth another run</h3>
          {evergreen.length === 0 ? (
            <p className="text-sm text-steel">Nothing old enough yet. Posts qualify after 90 days.</p>
          ) : (
            <ul className="grid gap-2">
              {evergreen.map((post) => (
                <li key={post.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{titleById.get(post.id) ?? 'Post'}<span className="block text-xs text-steel">Published {post.publishedAt?.slice(0, 10)}</span></span>
                  <ActionForm action={recycleEvergreenAction} feedback="none" aria-label="Run it again">
                    <input type="hidden" name="post_id" value={post.id} />
                    <PendingButton variant="secondary" size="sm">Run again</PendingButton>
                  </ActionForm>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="idea-tasks">
          <h3 id="idea-tasks" className="mb-2 text-xs font-bold uppercase tracking-widest text-steel">Community, {weekPeriod(now)}</h3>
          <ul className="grid gap-1.5">
            {COMMUNITY_TASKS.map((task) => {
              const isDone = done.has(task.key);
              return (
                <li key={task.key} className="flex items-center gap-2 text-sm">
                  <ActionForm action={toggleCommunityTaskAction} feedback="none" aria-label={task.label}>
                    <input type="hidden" name="task_key" value={task.key} />
                    {isDone && <input type="hidden" name="done" value="on" />}
                    <PendingButton variant="ghost" size="sm">{isDone ? '✓' : '○'}</PendingButton>
                  </ActionForm>
                  <span className={isDone ? 'text-steel line-through' : 'text-chalk/85'}>{task.label}</span>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="idea-nextdoor">
          <h3 id="idea-nextdoor" className="mb-2 text-xs font-bold uppercase tracking-widest text-steel">Nextdoor, {monthPeriod(now)}</h3>
          <p className="mb-2 text-sm text-chalk/75">{nextdoor}</p>
          <CopyButton value={nextdoor} label="Copy post" />
          <p className="mt-1 text-xs text-steel">Nextdoor has no posting API. Paste it into your business page.</p>
        </section>

        <section aria-labelledby="idea-shots">
          <h3 id="idea-shots" className="mb-2 text-xs font-bold uppercase tracking-widest text-steel">Shots to grab</h3>
          <ul className="grid gap-1.5 text-sm">
            {shots.slice(0, 8).map((shot) => (
              <li key={shot.key} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-chalk/85">{shot.label}</span>
                {shot.needsRelease && <Badge tone="warn">Release</Badge>}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Card>
  );
}

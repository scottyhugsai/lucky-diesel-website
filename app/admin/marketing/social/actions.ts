'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { type ActionState, InputError, checkbox, guard, requiredText, requiredUuid, shopDateTime } from '@/components/admin/core/parse';
import { requireRole } from '@/lib/auth';
import { submitForApproval } from '@/lib/marketing/content/approvals-service';
import { writeFromPrompt } from '@/lib/marketing/content/assistant';
import { adminDb, toJson, type Db } from '@/lib/marketing/content/db';
import { draftPillarPosts, draftPostsForBuild, draftPostsForDynoRun, publishSocialPost } from '@/lib/marketing/content/social-service';
import { COMMUNITY_TASKS, weekPeriod } from '@/lib/marketing/content/social';
import { PRIVACY_NOTE, parsePostForm } from './post-save';

function refresh(postId?: string) {
  revalidatePath('/admin/marketing/social');
  revalidatePath('/admin/marketing/ads/approvals');
  if (postId) revalidatePath(`/admin/marketing/social/${postId}`);
}

/** Edits reset approval: back to draft, then re-queued unless blocked. */
async function requeue(db: Db, postId: string, blocked: boolean, userId: string): Promise<string> {
  await db.from('social_posts').update({ status: 'draft' }).eq('id', postId);
  if (blocked) return 'Saved as draft. Blocked wording can’t be approved.';
  const queued = await submitForApproval('social_post', postId, userId, db);
  if (!queued.ok) throw new InputError(queued.error);
  return 'Saved and sent for approval.';
}

export async function savePost(_prev: ActionState, form: FormData): Promise<ActionState> {
  const viewer = await requireRole('admin');
  const db = adminDb();
  let createdId = '';
  const state = await guard(async () => {
    const postId = form.get('postId') ? requiredUuid(form, 'postId', 'Post') : null;
    const input = await parsePostForm(db, form);
    const image = input.image === 'keep' ? {} : {
      image_template: input.image.template, image_params: toJson(input.image.params),
      needs_privacy_review: input.image.privacy, privacy_note: input.image.privacy ? PRIVACY_NOTE : null,
    };
    const fields = {
      title: input.title, caption: input.caption, hashtags: input.hashtags, scheduled_for: input.scheduledFor,
      compliance_status: input.compliance.status, compliance_issues: toJson(input.compliance.issues), ...image,
    };

    let id = postId;
    if (id) {
      const { data: existing } = await db.from('social_posts').select('status').eq('id', id).maybeSingle();
      if (!existing) throw new InputError('Post not found.');
      if (existing.status === 'published') throw new InputError('Already published. Make a new post.');
      const { error } = await db.from('social_posts').update(fields).eq('id', id);
      if (error) throw new Error(error.message);
      await db.from('social_post_targets').delete().eq('post_id', id).in('status', ['pending', 'failed', 'scheduled']).not('platform', 'in', `(${input.networks.join(',')})`);
    } else {
      const { data, error } = await db.from('social_posts').insert({ ...fields, source_type: 'manual', generator: 'manual', created_by: viewer.userId, link_url: null }).select('id').single();
      if (error || !data) throw new Error(error?.message ?? 'Could not save the post.');
      id = data.id;
      createdId = id;
      await db.from('content_calendar_items').insert({ scheduled_for: input.scheduledFor, kind: 'social_post', title: input.title, ref_type: 'social_post', ref_id: id, status: 'drafted', generator: 'manual' });
    }
    const targets = input.networks.map((platform) => ({ post_id: id!, platform, platform_options: toJson(platform === 'tiktok' ? { mode: 'inbox_draft' } : {}) }));
    await db.from('social_post_targets').upsert(targets, { onConflict: 'post_id,platform', ignoreDuplicates: true });
    await db.from('content_calendar_items').update({ scheduled_for: input.scheduledFor, title: input.title }).eq('ref_type', 'social_post').eq('ref_id', id);
    const notice = await requeue(db, id, input.compliance.status === 'block', viewer.userId);
    refresh(id);
    return { notice };
  });
  if (state.error || !createdId) return state;
  redirect(`/admin/marketing/social/${createdId}`);
}

/** Moves a post to a new time. The time is part of what was approved, so it re-queues. */
export async function movePost(_prev: ActionState, form: FormData): Promise<ActionState> {
  const viewer = await requireRole('admin');
  return guard(async () => {
    const postId = requiredUuid(form, 'postId', 'Post');
    const at = shopDateTime(form, 'scheduledFor', 'New time');
    if (!at) throw new InputError('Pick a new time.');
    const db = adminDb();
    const { data: post } = await db.from('social_posts').select('status, compliance_status').eq('id', postId).maybeSingle();
    if (!post) throw new InputError('Post not found.');
    if (post.status === 'published') throw new InputError('Already published.');
    await db.from('social_posts').update({ scheduled_for: at }).eq('id', postId);
    await db.from('content_calendar_items').update({ scheduled_for: at }).eq('ref_type', 'social_post').eq('ref_id', postId);
    const notice = await requeue(db, postId, post.compliance_status === 'block', viewer.userId);
    refresh(postId);
    return { notice: `Moved. ${notice}` };
  });
}

export async function publishNow(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const postId = requiredUuid(form, 'postId', 'Post');
    const result = await publishSocialPost(postId);
    if (!result.ok) throw new InputError(result.error);
    refresh(postId);
    return { notice: result.data.results.map((r) => `${r.platform}: ${r.status.replace('_', ' ')}`).join(' · ') || 'Nothing left to post.' };
  });
}

/** Confirms an approved post goes out automatically at its time. */
export async function schedulePost(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const postId = requiredUuid(form, 'postId', 'Post');
    const db = adminDb();
    const { data, error } = await db.from('social_posts').update({ status: 'scheduled' }).eq('id', postId).eq('status', 'approved').select('id');
    if (error) throw new Error(error.message);
    if (!data?.length) throw new InputError('Approve it first.');
    await db.from('social_post_targets').update({ status: 'scheduled' }).eq('post_id', postId).eq('status', 'pending');
    refresh(postId);
    return { notice: 'Scheduled. It posts on time.' };
  });
}

export async function autoDraft(_prev: ActionState, form: FormData): Promise<ActionState> {
  const viewer = await requireRole('admin');
  return guard(async () => {
    const source = requiredText(form, 'source', 'Source', 50);
    const [kind, id] = source.split(':');
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw new InputError('Pick a build or dyno run.');
    if (kind === 'build') {
      const r = await draftPostsForBuild(id, viewer.userId);
      if (!r.ok) throw new InputError(r.error);
      refresh();
      return { notice: r.data.created ? 'Drafted for IG, FB, GBP and TikTok.' : 'Already drafted.' };
    }
    if (kind !== 'dyno') throw new InputError('Pick a build or dyno run.');
    const r = await draftPostsForDynoRun(id, viewer.userId);
    if (!r.ok) throw new InputError(r.error);
    refresh();
    return { notice: !r.data ? 'Needs a baseline pull to compare.' : r.data.created ? 'Dyno card drafted.' : 'Already drafted.' };
  });
}

export async function draftPillars(): Promise<ActionState> {
  const viewer = await requireRole('admin');
  return guard(async () => {
    const r = await draftPillarPosts(14, viewer.userId);
    if (!r.ok) throw new InputError(r.error);
    refresh();
    return { notice: r.data.created ? `Drafted ${r.data.created} pillar posts.` : 'Next two weeks already covered.' };
  });
}

export interface CaptionResult {
  text?: string;
  error?: string;
  status?: string;
  generator?: string;
}

/** "Write it for me": caption from a short prompt, compliance-checked. */
export async function writeCaption(prompt: string): Promise<CaptionResult> {
  const viewer = await requireRole('admin');
  const clean = typeof prompt === 'string' ? prompt.trim() : '';
  if (clean.length < 3 || clean.length > 300) return { error: 'Describe the post in 3–300 characters.' };
  const answer = await writeFromPrompt({ kind: 'caption', prompt: clean, requestedBy: viewer.userId });
  return { text: answer.text, status: answer.compliance.status, generator: answer.generator };
}

/** Runs an old evergreen post again as a fresh draft. Cooldown is 90 days. */
export async function recycleEvergreenAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const id = requiredUuid(form, 'post_id', 'Post');
    const db = adminDb();
    const { data: post } = await db.from('social_posts').select('*').eq('id', id).maybeSingle();
    if (!post) return { error: 'Post not found.' };
    const { error: insertError } = await db.from('social_posts').insert({
      title: post.title, caption: post.caption, hashtags: post.hashtags, link_url: post.link_url,
      asset_ids: post.asset_ids, image_template: post.image_template, image_params: post.image_params,
      pillar: post.pillar, source_type: post.source_type, source_id: post.source_id,
      status: 'draft', generator: post.generator, compliance_status: post.compliance_status,
    });
    if (insertError) return { error: 'Couldn’t copy the post.' };
    const { error } = await db.from('social_posts').update({ last_recycled_at: new Date().toISOString() }).eq('id', id);
    if (error) return { error: 'Copied, but couldn’t mark it recycled.' };
    revalidatePath('/admin/marketing/social');
    return { notice: 'Draft ready. Edit and reschedule it.' };
  });
}

/** Ticks or unticks one community task for this week. */
export async function toggleCommunityTaskAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const viewer = await requireRole('admin');
  return guard(async () => {
    const key = requiredText(form, 'task_key', 'Task', 60);
    if (!COMMUNITY_TASKS.some((task) => task.key === key)) return { error: 'Unknown task.' };
    const period = weekPeriod(new Date());
    const db = adminDb();
    if (checkbox(form, 'done')) {
      const { error } = await db.from('social_task_log').delete().match({ task_key: key, period });
      if (error) return { error: 'Couldn’t update that.' };
    } else {
      const { error } = await db.from('social_task_log').insert({ task_key: key, period, done_by: viewer.userId });
      if (error && error.code !== '23505') return { error: 'Couldn’t update that.' };
    }
    revalidatePath('/admin/marketing/social');
    return { notice: 'Saved.' };
  });
}

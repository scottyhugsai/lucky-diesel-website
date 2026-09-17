'use server';

import { revalidatePath } from 'next/cache';
import { type ActionState, InputError, checkbox, guard, oneOf, requiredText, text } from '@/components/admin/core/parse';
import { requireRole } from '@/lib/auth';
import { checkEndorsement } from '@/lib/marketing/content/endorsement';
import { releaseFromRow } from '@/lib/marketing/content/endorsement';
import { createAdminClient } from '@/lib/supabase/admin';

const PATH = '/admin/marketing/social/releases';
const METHODS = ['signed_form', 'web_form', 'email', 'text', 'verbal'] as const;
const UUID = /^[0-9a-f-]{36}$/i;

function uuidOrNull(form: FormData, field: string): string | null {
  const value = (form.get(field) ?? '').toString().trim();
  return UUID.test(value) ? value : null;
}

/** Records what a customer said we may publish. Owner-entered; no photo uploads here. */
export async function saveReleaseAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const viewer = await requireRole('admin');
  return guard(async () => {
    const { error } = await createAdminClient().from('media_releases').insert({
      customer_id: uuidOrNull(form, 'customer_id'),
      work_order_id: uuidOrNull(form, 'work_order_id'),
      person_name: requiredText(form, 'person_name', 'Name', 120),
      allow_truck: checkbox(form, 'allow_truck'),
      allow_plate: checkbox(form, 'allow_plate'),
      allow_face: checkbox(form, 'allow_face'),
      allow_name: checkbox(form, 'allow_name'),
      allow_testimonial: checkbox(form, 'allow_testimonial'),
      incentivized: checkbox(form, 'incentivized'),
      method: oneOf(form, 'method', METHODS, 'method'),
      evidence: text(form, 'evidence', { max: 500, label: 'Where it is filed' }),
      source: 'owner',
      created_by: viewer.userId,
    });
    if (error) return { error: 'Couldn’t save the release.' };
    revalidatePath(PATH);
    return { notice: 'Release saved.' };
  });
}

/** Revokes a release. Anything relying on it must come down. */
export async function revokeReleaseAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const id = uuidOrNull(form, 'id');
    if (!id) throw new InputError('Unknown release.');
    const { error } = await createAdminClient().from('media_releases').update({ revoked_at: new Date().toISOString() }).eq('id', id);
    if (error) return { error: 'Couldn’t revoke it.' };
    revalidatePath(PATH);
    return { notice: 'Revoked. Take down anything that used it.' };
  });
}

/**
 * Approves a customer photo: records the release they agreed to, then drafts a
 * post. Nothing is published here — the draft still goes through approval.
 */
export async function decideUgcAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const viewer = await requireRole('admin');
  return guard(async () => {
    const id = uuidOrNull(form, 'id');
    if (!id) throw new InputError('Unknown submission.');
    const approve = (form.get('decision') ?? '').toString() === 'approve';
    const db = createAdminClient();
    const { data: row } = await db.from('ugc_submissions').select('*').eq('id', id).maybeSingle();
    if (!row) return { error: 'Submission not found.' };

    if (!approve) {
      const { error } = await db.from('ugc_submissions').update({ status: 'rejected', reviewed_by: viewer.userId, reviewed_at: new Date().toISOString() }).eq('id', id);
      if (error) return { error: 'Couldn’t save that.' };
      revalidatePath(PATH);
      return { notice: 'Rejected. Nothing was published.' };
    }

    const { data: release, error: releaseError } = await db.from('media_releases').insert({
      person_name: row.name,
      allow_truck: true,
      allow_plate: false,
      allow_face: false,
      allow_name: row.credit_ok,
      allow_testimonial: false,
      incentivized: false,
      method: 'web_form',
      evidence: `Submitted ${row.created_at} from the site form`,
      source: 'ugc',
      created_by: viewer.userId,
    }).select('*').single();
    if (releaseError || !release) return { error: 'Couldn’t record the release.' };

    const caption = `${row.truck ? `${row.truck} — ` : ''}${row.caption ?? 'Customer truck'}${row.credit_ok && row.handle ? ` (${row.handle})` : ''}`;
    const issues = checkEndorsement({
      customerContent: true,
      caption,
      needs: row.credit_ok ? ['truck', 'name'] : ['truck'],
      releases: [releaseFromRow(release)],
    });
    if (issues.some((issue) => issue.severity === 'block')) {
      return { error: issues.map((issue) => issue.reason).join(' ') };
    }

    const { data: post, error: postError } = await db.from('social_posts').insert({
      title: `Customer truck: ${row.truck ?? row.name}`,
      caption,
      hashtags: ['#LuckyDiesel', '#CharlestonSC'],
      source_type: 'manual',
      status: 'draft',
      generator: 'demo',
      pillar: 'customer',
      needs_privacy_review: true,
      privacy_note: 'Customer photo: check plates, VINs and faces before posting.',
    }).select('id').single();
    if (postError || !post) return { error: 'Couldn’t draft the post.' };

    const { error } = await db.from('ugc_submissions')
      .update({ status: 'approved', reviewed_by: viewer.userId, reviewed_at: new Date().toISOString(), release_id: release.id, post_id: post.id })
      .eq('id', id);
    if (error) return { error: 'Couldn’t save that.' };
    revalidatePath(PATH);
    revalidatePath('/admin/marketing/social');
    return { notice: 'Release recorded and a draft is waiting in Social.' };
  });
}

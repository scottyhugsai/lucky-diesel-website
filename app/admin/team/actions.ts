'use server';

import { revalidatePath } from 'next/cache';
import { EMAIL_PATTERN, fail, formatPhone, isUuid, ok, str, type ActionState } from '@/components/admin/ops/form';
import { requireRole } from '@/lib/auth';
import { siteUrl } from '@/lib/site-url';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const MAX_NAME = 80;
const MAX_TITLE = 60;

export async function inviteEmployee(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireRole('admin');
  const fullName = str(formData, 'full_name');
  const email = str(formData, 'email').toLowerCase();
  const rawPhone = str(formData, 'phone');
  const title = str(formData, 'title');
  if (fullName.length < 2 || fullName.length > MAX_NAME) return fail('Enter their full name.');
  if (!EMAIL_PATTERN.test(email) || email.length > 254) return fail('Enter a valid email.');
  const phone = rawPhone ? formatPhone(rawPhone) : null;
  if (rawPhone && !phone) return fail('Enter a 10-digit phone number, or leave it blank.');
  if (title.length > MAX_TITLE) return fail(`Keep the title under ${MAX_TITLE} characters.`);

  const admin = createAdminClient();
  const invite = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo: `${siteUrl()}/auth/callback?next=/shop`,
  });
  let user = invite.data.user;
  let emailed = true;
  if (invite.error || !user) {
    const message = invite.error?.message ?? 'unknown error';
    if (/already|registered|exists/i.test(message)) return fail('Someone with that email already has an account.');
    // The mail provider refused the address (e.g. a test domain). Create the account anyway so the owner can finish setup.
    const created = await admin.auth.admin.createUser({ email, email_confirm: false, user_metadata: { full_name: fullName } });
    if (created.error || !created.data.user) return fail(`Invite failed: ${created.error?.message ?? message}`);
    user = created.data.user;
    emailed = false;
  }

  const userId = user.id;
  const { error: roleError } = await admin.auth.admin.updateUserById(userId, { app_metadata: { role: 'employee' } });
  if (roleError) return fail(`Invite sent, but the employee role couldn’t be set: ${roleError.message}`);

  const supabase = await createClient();
  const { error: profileError } = await supabase.from('profiles').update({ full_name: fullName, phone, title: title || null, role: 'employee' }).eq('id', userId);
  if (profileError) return fail('Invite sent, but their phone and title didn’t save. Edit them from the list.');

  await admin.from('audit_log').insert({ actor_id: viewer.userId, entity: 'profile', entity_id: userId, action: 'invited', data: { email } });
  revalidatePath('/admin/team');
  return ok(emailed
    ? `Invite emailed to ${email}. They’ll land in the shop app after setting a password.`
    : `Account created for ${email}, but the invite email couldn’t be delivered to that address. Once it’s a real inbox they can use “Email me a link” on the sign-in page.`);
}

export async function setStaffActive(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireRole('admin');
  const id = formData.get('profile_id');
  const active = str(formData, 'active');
  if (!isUuid(id) || (active !== 'true' && active !== 'false')) return fail('Unknown team member.');
  if (id === viewer.userId && active === 'false') return fail('You can’t deactivate your own account.');

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .update({ active: active === 'true' })
    .eq('id', id)
    .in('role', ['admin', 'employee'])
    .select('full_name')
    .maybeSingle();
  if (error || !data) return fail('Couldn’t update that team member.');

  await createAdminClient().from('audit_log').insert({ actor_id: viewer.userId, entity: 'profile', entity_id: id, action: active === 'true' ? 'activated' : 'deactivated', data: {} });
  revalidatePath('/admin/team');
  return ok(`${data.full_name || 'Team member'} ${active === 'true' ? 'can sign in again' : 'no longer has access'}.`);
}

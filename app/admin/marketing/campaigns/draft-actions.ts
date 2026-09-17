'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { insertStarterDraft } from '@/components/admin/marketing/core-ui/campaign-write';
import { seasonalTemplate } from '@/components/admin/marketing/core-ui/seasonal';
import { SAMPLE_VARS } from '@/components/admin/ops/automation-meta';
import { fail, isUuid, ok, str, type ActionState } from '@/components/admin/ops/form';
import { requireRole } from '@/lib/auth';
import { suggestNextCampaign } from '@/lib/marketing/content/assistant';
import { checkClaims } from '@/lib/marketing/core/compliance';
import { sendMessage } from '@/lib/messaging/send';
import { renderTemplate } from '@/lib/messaging/template';
import { BUSINESS } from '@/lib/site';
import { siteUrl } from '@/lib/site-url';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const BASE = '/admin/marketing/campaigns';

const TEST_VARS = {
  ...SAMPLE_VARS,
  platform: 'cummins',
  business_name: BUSINESS.name,
  link: `${siteUrl()}/book`,
  offer_code: 'DIESEL25',
  referral_code: 'CODY-7K2P',
  referral_link: `${siteUrl()}/book`,
  unsubscribe_link: `${siteUrl()}/api/marketing/unsubscribe`,
};

/** Sends every variant of step 1 to the owner. Demo mode routes email to the presenter inbox. */
export async function testSendAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireRole('admin');
  const id = str(formData, 'id');
  if (!isUuid(id)) return fail('Unknown campaign.');
  const supabase = await createClient();
  const [{ data: campaign }, { data: steps }] = await Promise.all([
    supabase.from('campaigns').select('name, channel').eq('id', id).maybeSingle(),
    supabase.from('campaign_steps').select('step_order, variant, subject, body').eq('campaign_id', id).order('step_order').order('variant'),
  ]);
  if (!campaign) return fail('Campaign not found.');
  const first = (steps ?? []).filter((s) => s.step_order === (steps?.[0]?.step_order ?? 1));
  if (!first.length) return fail('Add a message first.');

  const to = campaign.channel === 'sms' ? viewer.profile.phone ?? BUSINESS.phoneDisplay : viewer.profile.email ?? process.env.DEMO_EMAIL_TO;
  if (!to) return fail('Add an email or phone to your profile first.');

  const results: string[] = [];
  for (const step of first) {
    const body = renderTemplate(step.body, TEST_VARS);
    if (checkClaims(`${step.subject ?? ''}\n${body}`).risk === 'fail') return fail(`Variant ${step.variant} fails the claims check. Fix it first.`);
    const subject = step.subject ? `[Test ${step.variant}] ${renderTemplate(step.subject, TEST_VARS)}` : undefined;
    const result = await sendMessage({ channel: campaign.channel, to, subject, body: campaign.channel === 'sms' ? `[Test ${step.variant}] ${body}` : body, purpose: 'transactional' });
    results.push(`${step.variant}: ${result.status}${result.error ? ` (${result.error})` : ''}`);
  }
  revalidatePath('/admin/messages');
  const failed = results.some((r) => r.includes('failed') || r.includes('skipped'));
  return failed ? fail(`Test not delivered. ${results.join(' · ')}`) : ok(`Test sent to ${to}. ${results.join(' · ')}`);
}

export async function createFromTemplateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireRole('admin');
  const template = seasonalTemplate(str(formData, 'key'));
  if (!template) return fail('Unknown template.');
  const supabase = await createClient();
  const created = await insertStarterDraft(supabase, {
    name: `${template.name} ${new Date().getFullYear()}`, channel: template.channel, subject: template.subject, body: template.body,
    seasonalKey: template.key, segmentId: null,
  }, viewer.userId);
  if ('error' in created) return fail(`Could not create: ${created.error}`);
  revalidatePath(BASE);
  redirect(`${BASE}/${created.id}?notice=${encodeURIComponent('Draft created. Pick an audience, then schedule.')}`);
}

export async function nextBestCampaignAction(): Promise<ActionState> {
  const viewer = await requireRole('admin');
  let suggestion: Awaited<ReturnType<typeof suggestNextCampaign>>;
  try {
    suggestion = await suggestNextCampaign(createAdminClient());
  } catch (caught) {
    return fail(`Assistant unavailable: ${caught instanceof Error ? caught.message : 'unknown error'}`);
  }
  const title = suggestion.item?.title ?? 'Service reminder push';
  const reason = suggestion.item?.reason ?? 'Keep regulars coming back.';
  const supabase = await createClient();
  const { data: segment } = await supabase.from('segments').select('id').order('member_count', { ascending: false }).limit(1).maybeSingle();
  const created = await insertStarterDraft(supabase, {
    name: title.slice(0, 120), channel: 'email', subject: title.slice(0, 120),
    body: `Hey {{first_name}},\n\n${reason}\n\nBook a bay: {{link}}\n\n— Lucky Diesel`,
    seasonalKey: null, segmentId: segment?.id ?? null,
  }, viewer.userId);
  if ('error' in created) return fail(`Could not create: ${created.error}`);
  revalidatePath(BASE);
  revalidatePath('/admin/marketing');
  redirect(`${BASE}/${created.id}?notice=${encodeURIComponent('Assistant draft ready. Review, then schedule.')}`);
}

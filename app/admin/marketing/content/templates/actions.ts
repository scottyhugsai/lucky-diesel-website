'use server';

import { revalidatePath } from 'next/cache';
import { fail, isUuid, ok, str, type ActionState } from '@/components/admin/ops/form';
import { requireRole } from '@/lib/auth';
import { toJson } from '@/lib/marketing/content/db';
import { parseTemplateInput } from '@/lib/marketing/content/templates';
import { createClient } from '@/lib/supabase/server';

const PATH = '/admin/marketing/content/templates';
const MAX_VERSIONS = 50;

/** Saves a template. Editing an existing key adds a new version; old versions stay. */
export async function saveTemplateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireRole('admin');
  const existingKey = str(formData, 'template_key');
  const parsed = parseTemplateInput({ key: existingKey, name: str(formData, 'name'), channel: str(formData, 'channel'), subject: str(formData, 'subject'), body: str(formData, 'body'), tags: str(formData, 'tags') });
  if (!parsed.ok) return fail(parsed.error);
  const { key, name, channel, subject, body, tags } = parsed.value;

  const supabase = await createClient();
  const { data: latest, error: readError } = await supabase.from('marketing_templates').select('version, channel').eq('template_key', key).order('version', { ascending: false }).limit(1).maybeSingle();
  if (readError) return fail('Could not load the template.');
  if (!existingKey && latest) return fail('A template with that name exists. Edit it instead.');
  if (existingKey && !latest) return fail('Template not found.');
  if (latest && latest.channel !== channel) return fail('A template keeps its channel. Save a new one instead.');
  if ((latest?.version ?? 0) >= MAX_VERSIONS) return fail(`Templates keep ${MAX_VERSIONS} versions max.`);

  const { error } = await supabase.from('marketing_templates').insert({
    template_key: key, version: (latest?.version ?? 0) + 1, name, channel, subject, body, tags,
    compliance_status: parsed.report.status, compliance_issues: toJson(parsed.report.issues), created_by: viewer.userId,
  });
  if (error) return fail(error.code === '23505' ? 'Someone saved this template at the same time. Reload.' : 'Could not save.');
  revalidatePath(PATH);
  return ok(latest ? `Saved as version ${latest.version + 1}.` : 'Template saved.');
}

export async function archiveTemplateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('admin');
  const key = str(formData, 'template_key');
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(key)) return fail('Unknown template.');
  const archived = str(formData, 'archived') === 'true';
  const supabase = await createClient();
  const { error } = await supabase.from('marketing_templates').update({ archived }).eq('template_key', key);
  if (error) return fail('Could not update.');
  revalidatePath(PATH);
  return ok(archived ? 'Archived.' : 'Restored.');
}

/** Copies an older version to the top as a new version. */
export async function restoreVersionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireRole('admin');
  const id = str(formData, 'id');
  if (!isUuid(id)) return fail('Unknown version.');
  const supabase = await createClient();
  const { data: row } = await supabase.from('marketing_templates').select('*').eq('id', id).maybeSingle();
  if (!row) return fail('Version not found.');
  const { data: latest } = await supabase.from('marketing_templates').select('version').eq('template_key', row.template_key).order('version', { ascending: false }).limit(1).single();
  const { error } = await supabase.from('marketing_templates').insert({
    template_key: row.template_key, version: (latest?.version ?? row.version) + 1, name: row.name, channel: row.channel, subject: row.subject, body: row.body, tags: row.tags,
    compliance_status: row.compliance_status, compliance_issues: row.compliance_issues, created_by: viewer.userId,
  });
  if (error) return fail('Could not restore.');
  revalidatePath(PATH);
  return ok(`Restored v${row.version} as the latest.`);
}

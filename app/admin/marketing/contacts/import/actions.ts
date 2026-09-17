'use server';

import { revalidatePath } from 'next/cache';
import { fail, oneOf, ok, str, type ActionState } from '@/components/admin/ops/form';
import { requireRole } from '@/lib/auth';
import { IMPORT_MAX_BYTES, parseCsv, parseMapping } from '@/lib/marketing/core/contact-import';
import { runContactImport } from '@/lib/marketing/core/contact-import-run';
import { createAdminClient } from '@/lib/supabase/admin';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export async function importContactsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireRole('admin');
  const csv = formData.get('csv');
  if (typeof csv !== 'string' || !csv.trim()) return fail('Pick a CSV file.');
  if (new TextEncoder().encode(csv).length > IMPORT_MAX_BYTES) return fail('File is too big. Split it under 500 KB.');
  const fileName = (str(formData, 'file_name').replace(/[^\w .()-]/g, '').slice(0, 200)) || 'contacts.csv';
  const mode = oneOf(formData.get('mode'), ['preview', 'commit'] as const) ?? 'preview';
  const basis = oneOf(formData.get('basis'), ['none', 'column', 'all'] as const);
  if (!basis) return fail('Pick an email consent option.');
  const basisNote = str(formData, 'basis_note').slice(0, 300) || null;
  if (basis !== 'none' && !basisNote) return fail('Say how these people opted in to email.');

  const header = parseCsv(csv, 1)[0] ?? [];
  let rawMapping: unknown;
  try {
    rawMapping = JSON.parse(str(formData, 'mapping') || '{}');
  } catch {
    return fail('Column mapping is not valid.');
  }
  const mapping = parseMapping(rawMapping, header.length);
  if (mapping.email === undefined && mapping.phone === undefined) return fail('Map an email or phone column.');
  if (mapping.full_name === undefined && mapping.first_name === undefined) return fail('Map a name column.');
  if (basis === 'column' && mapping.email_consent === undefined) return fail('Map the email opt-in column.');

  try {
    const summary = await runContactImport(createAdminClient(), { fileName, csv, mapping, basis, basisNote, actorId: viewer.userId, dryRun: mode === 'preview' });
    const counts = `${plural(summary.created, 'new contact')}, ${plural(summary.updated, 'update')}, ${summary.skipped} skipped, ${plural(summary.emailOptIns, 'email opt-in')}.`;
    const firstIssues = summary.issues.slice(0, 3).map((i) => `Row ${i.line}: ${i.reason}`).join(' · ');
    const more = summary.issues.length > 3 ? ` · +${summary.issues.length - 3} more` : '';
    if (mode === 'preview') return ok(`Ready: ${counts}${firstIssues ? ` ${firstIssues}${more}` : ''}`);
    revalidatePath('/admin/marketing/contacts');
    revalidatePath('/admin/marketing/contacts/import');
    return ok(`Imported: ${counts}${firstIssues ? ` ${firstIssues}${more}` : ''}`);
  } catch (caught) {
    console.error('[marketing] import failed', caught);
    return fail('Import failed. Nothing after the error was saved.');
  }
}

import 'server-only';
import { randomUUID } from 'node:crypto';
import { recordConsent } from './consent';
import { buildImportRows, parseCsv, type EmailBasis, type ImportIssue, type ImportMapping } from './contact-import';
import { checkEmailDomain, type DomainStatus } from './email-check';
import { normalizeEmail, phoneTail } from './policy';
import type { Db } from './settings';

const MAX_DOMAIN_LOOKUPS = 150;
const LOOKUP_CONCURRENCY = 8;
const INSERT_CHUNK = 200;

export interface ImportRequest {
  fileName: string;
  csv: string;
  mapping: ImportMapping;
  basis: EmailBasis;
  basisNote: string | null;
  actorId: string | null;
  dryRun: boolean;
}

export interface ImportSummary {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  emailOptIns: number;
  issues: ImportIssue[];
}

async function domainStatuses(domains: string[]): Promise<Map<string, DomainStatus>> {
  const result = new Map<string, DomainStatus>();
  const queue = domains.slice(0, MAX_DOMAIN_LOOKUPS);
  await Promise.all(Array.from({ length: LOOKUP_CONCURRENCY }, async () => {
    for (let domain = queue.shift(); domain; domain = queue.shift()) result.set(domain, await checkEmailDomain(domain));
  }));
  return result;
}

/**
 * Imports contacts from CSV. Matches existing customers by email or phone and
 * only fills blanks and adds tags. Email opt-ins are written to the consent
 * ledger with the import id as evidence, never over an earlier opt-out. SMS
 * marketing consent is never granted by import.
 */
export async function runContactImport(db: Db, request: ImportRequest): Promise<ImportSummary> {
  const table = parseCsv(request.csv);
  const built = buildImportRows(table, request.mapping, request.basis);
  const issues = [...built.issues];

  const domains = [...new Set(built.rows.flatMap((r) => (r.email ? [r.email.slice(r.email.lastIndexOf('@') + 1)] : [])))];
  const status = await domainStatuses(domains);
  const rows = built.rows.map((row) => {
    if (row.email && status.get(row.email.slice(row.email.lastIndexOf('@') + 1)) === 'dead') {
      issues.push({ line: row.line, reason: `Email domain can't get mail: ${row.email}` });
      return { ...row, email: null, emailOptIn: false };
    }
    return row;
  }).filter((row) => {
    if (row.email || row.phone) return true;
    issues.push({ line: row.line, reason: 'Skipped: no working email or phone' });
    return false;
  });

  const [{ data: customers, error }, { data: suppressed }] = await Promise.all([
    db.from('customers').select('id, email, phone, tags, anonymized_at, email_marketing_status'),
    db.from('suppressions').select('address').eq('channel', 'email'),
  ]);
  if (error) throw new Error(`customers lookup failed: ${error.message}`);
  const byEmail = new Map<string, NonNullable<typeof customers>[number]>();
  const byPhone = new Map<string, NonNullable<typeof customers>[number]>();
  for (const c of customers ?? []) {
    if (c.anonymized_at) continue;
    if (c.email) byEmail.set(normalizeEmail(c.email), c);
    if (c.phone && phoneTail(c.phone).length === 10) byPhone.set(phoneTail(c.phone), c);
  }
  const optedOut = new Set((suppressed ?? []).map((s) => s.address));

  const importId = randomUUID();
  const summary: ImportSummary = { total: Math.max(0, table.length - 1), created: 0, updated: 0, skipped: 0, emailOptIns: 0, issues };
  const inserts: { full_name: string; email: string | null; phone: string | null; tags: string[]; source: string; email_marketing_status: 'unsubscribed' }[] = [];
  const grants: { email: string; customerId: string | null; line: number }[] = [];

  for (const row of rows) {
    const match = (row.email && byEmail.get(row.email)) || (row.phone && byPhone.get(phoneTail(row.phone))) || null;
    const wantsGrant = row.emailOptIn && row.email;
    if (wantsGrant && optedOut.has(row.email!)) issues.push({ line: row.line, reason: `Opted out before, not re-subscribed: ${row.email}` });
    const grant = wantsGrant && !optedOut.has(row.email!) && !(match && match.email === row.email && match.email_marketing_status !== 'unsubscribed');

    if (!match) {
      summary.created += 1;
      // Imported people start unsubscribed from email unless this import proves an opt-in.
      inserts.push({ full_name: row.fullName, email: row.email, phone: row.phone, tags: [...new Set(['imported', ...row.tags])], source: 'import', email_marketing_status: 'unsubscribed' });
      if (grant) grants.push({ email: row.email!, customerId: null, line: row.line });
      continue;
    }
    const patch = {
      ...(!match.email && row.email ? { email: row.email } : {}),
      ...(!match.phone && row.phone ? { phone: row.phone } : {}),
      ...(row.tags.some((t) => !match.tags.includes(t)) ? { tags: [...new Set([...match.tags, ...row.tags])] } : {}),
    };
    if (Object.keys(patch).length) {
      summary.updated += 1;
      if (!request.dryRun) {
        const { error: updateError } = await db.from('customers').update(patch).eq('id', match.id);
        if (updateError) issues.push({ line: row.line, reason: 'Update failed' });
      }
    } else {
      summary.skipped += 1;
    }
    // A matched person with a different email on file only gets the grant if their record now holds this email.
    if (grant && (match.email === row.email || !match.email)) grants.push({ email: row.email!, customerId: match.id, line: row.line });
  }
  summary.skipped += built.issues.filter((i) => i.reason.startsWith('Skipped')).length;
  summary.emailOptIns = grants.length;
  if (request.dryRun) return summary;

  const createdIds = new Map<string, string>();
  for (let i = 0; i < inserts.length; i += INSERT_CHUNK) {
    const chunk = inserts.slice(i, i + INSERT_CHUNK);
    const { data, error: insertError } = await db.from('customers').insert(chunk.map((c) => ({ ...c, lifecycle_stage: 'customer' as const }))).select('id, email');
    if (insertError) throw new Error(`import insert failed: ${insertError.message}`);
    for (const c of data ?? []) if (c.email) createdIds.set(c.email, c.id);
  }

  let granted = 0;
  for (const g of grants) {
    const result = await recordConsent(db, {
      customerId: g.customerId ?? createdIds.get(g.email) ?? null, channel: 'email', purpose: 'marketing', action: 'granted', method: 'import',
      address: g.email, consentTextVersion: `import-${request.basis}`,
      evidence: { import_id: importId, file: request.fileName, line: g.line, basis: request.basis, note: request.basisNote },
    });
    if (result.ok) granted += 1;
    else issues.push({ line: g.line, reason: 'Could not record opt-in' });
  }
  summary.emailOptIns = granted;

  const { error: logError } = await db.from('contact_imports').insert({
    id: importId, file_name: request.fileName, email_basis: request.basis, basis_note: request.basisNote, total_rows: summary.total,
    created_count: summary.created, updated_count: summary.updated, skipped_count: summary.skipped, email_opt_ins: granted,
    issues: issues.slice(0, 200).map((x) => ({ line: x.line, reason: x.reason })), created_by: request.actorId,
  });
  if (logError) console.error(`[marketing] import log failed: ${logError.message}`);
  return summary;
}

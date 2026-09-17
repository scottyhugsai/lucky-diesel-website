/**
 * CSV contact import: parsing, column mapping and row validation. Pure and
 * client-safe, so the browser previews exactly what the server will import.
 *
 * Consent rules: import can record EMAIL opt-ins only, with a stated basis.
 * It never grants SMS marketing consent (TCPA needs proof from the person).
 */

import { EMAIL_SYNTAX, suggestEmailFix } from './email-typo';

export const IMPORT_MAX_BYTES = 500_000;
export const IMPORT_MAX_ROWS = 1000;
const MAX_CELL = 300;

export const IMPORT_FIELDS = ['full_name', 'first_name', 'last_name', 'email', 'phone', 'tags', 'email_consent'] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];
export type ImportMapping = Partial<Record<ImportField, number>>;
export type EmailBasis = 'none' | 'column' | 'all';

export const IMPORT_FIELD_LABEL: Record<ImportField, string> = {
  full_name: 'Full name', first_name: 'First name', last_name: 'Last name', email: 'Email', phone: 'Phone', tags: 'Tags', email_consent: 'Email opt-in',
};

/** RFC 4180-style CSV: quoted cells, doubled quotes, CRLF or LF, optional BOM. */
export function parseCsv(text: string, maxRows = IMPORT_MAX_ROWS + 1): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i]!;
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') { cell += '"'; i += 1; } else if (ch === '"') quoted = false; else cell += ch;
      continue;
    }
    if (ch === '"' && cell === '') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') i += 1;
      row.push(cell); cell = '';
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
      if (rows.length >= maxRows) return rows;
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows.slice(0, maxRows);
}

const HEADER_HINTS: [ImportField, RegExp][] = [
  ['email_consent', /(?:email|newsletter|marketing).*(?:opt|consent|subscri)|accepts?.*marketing|opt.?in/],
  ['first_name', /^first|first.?name|given/],
  ['last_name', /^last|last.?name|surname|family/],
  ['full_name', /^(?:full.?)?name$|customer.?name|contact.?name|^customer$/],
  ['email', /e.?mail/],
  ['phone', /phone|mobile|cell|tel/],
  ['tags', /tags?|labels?|groups?/],
];

/** Best-guess column for each field from the header row. */
export function guessMapping(headers: readonly string[]): ImportMapping {
  const mapping: ImportMapping = {};
  const used = new Set<number>();
  for (const [field, pattern] of HEADER_HINTS) {
    const index = headers.findIndex((h, i) => !used.has(i) && pattern.test(h.trim().toLowerCase()));
    if (index >= 0) { mapping[field] = index; used.add(index); }
  }
  return mapping;
}

/** Parses a mapping sent from the browser. Unknown fields and bad indexes are dropped. */
export function parseMapping(raw: unknown, columns: number): ImportMapping {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const mapping: ImportMapping = {};
  for (const field of IMPORT_FIELDS) {
    const value = (raw as Record<string, unknown>)[field];
    if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < columns) mapping[field] = value;
  }
  return mapping;
}

const YES = /^(?:y|yes|true|1|x|subscribed|opted.?in|opt.?in|accepted|granted)$/i;
const TAG = /^[a-z0-9][a-z0-9 _-]{0,31}$/;

export interface ImportRow {
  line: number;
  fullName: string;
  email: string | null;
  phone: string | null;
  tags: string[];
  emailOptIn: boolean;
}

export interface ImportIssue {
  line: number;
  reason: string;
}

/** "(843) 555-0142" for 10-digit US numbers, null otherwise. */
export function formatImportPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  const local = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  return local.length === 10 ? `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}` : null;
}

/**
 * Turns CSV rows (header first) into validated contacts. Rows without a name
 * or any way to reach them are skipped; duplicate emails/phones keep the first.
 */
export function buildImportRows(rows: readonly string[][], mapping: ImportMapping, basis: EmailBasis): { rows: ImportRow[]; issues: ImportIssue[] } {
  const out: ImportRow[] = [];
  const issues: ImportIssue[] = [];
  const seen = new Set<string>();
  const get = (row: readonly string[], field: ImportField) => {
    const index = mapping[field];
    return index === undefined ? '' : (row[index] ?? '').trim().slice(0, MAX_CELL);
  };

  rows.slice(1, IMPORT_MAX_ROWS + 1).forEach((row, i) => {
    const line = i + 2;
    const fullName = (get(row, 'full_name') || [get(row, 'first_name'), get(row, 'last_name')].filter(Boolean).join(' ')).replace(/\s+/g, ' ').slice(0, 120);
    const rawEmail = get(row, 'email').toLowerCase();
    const rawPhone = get(row, 'phone');
    let email: string | null = null;
    if (rawEmail) {
      if (EMAIL_SYNTAX.test(rawEmail)) email = rawEmail;
      else issues.push({ line, reason: `Bad email “${rawEmail.slice(0, 60)}”` });
      const fix = email ? suggestEmailFix(email) : null;
      if (fix) issues.push({ line, reason: `Check email: ${email} (did you mean ${fix}?)` });
    }
    const phone = rawPhone ? formatImportPhone(rawPhone) : null;
    if (rawPhone && !phone) issues.push({ line, reason: `Bad phone “${rawPhone.slice(0, 30)}”` });

    if (fullName.length < 2) { issues.push({ line, reason: 'Skipped: no name' }); return; }
    if (!email && !phone) { issues.push({ line, reason: 'Skipped: no email or phone' }); return; }
    const keys = [email && `e:${email}`, phone && `p:${phone.replace(/\D/g, '')}`].filter((k): k is string => Boolean(k));
    if (keys.some((k) => seen.has(k))) { issues.push({ line, reason: 'Skipped: duplicate in file' }); return; }
    keys.forEach((k) => seen.add(k));

    const tags = [...new Set(get(row, 'tags').split(/[,;|]/).map((t) => t.trim().toLowerCase()).filter((t) => TAG.test(t)))].slice(0, 10);
    const emailOptIn = Boolean(email) && (basis === 'all' || (basis === 'column' && YES.test(get(row, 'email_consent'))));
    out.push({ line, fullName, email, phone, tags, emailOptIn });
  });
  return { rows: out, issues };
}

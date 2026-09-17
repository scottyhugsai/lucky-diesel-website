'use client';

import { useMemo, useState } from 'react';
import { importContactsAction } from '@/app/admin/marketing/contacts/import/actions';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import { Badge, fieldClass, labelClass } from '@/components/app/ui';
import {
  buildImportRows, guessMapping, IMPORT_FIELD_LABEL, IMPORT_FIELDS, IMPORT_MAX_BYTES, IMPORT_MAX_ROWS, parseCsv,
  type EmailBasis, type ImportField, type ImportMapping,
} from '@/lib/marketing/core/contact-import';

const BASIS_LABEL: Record<EmailBasis, string> = {
  none: 'No email opt-in',
  column: 'Use opt-in column',
  all: 'All opted in',
};

const PREVIEW_ROWS = 5;

/**
 * CSV import with column mapping and an explicit email-consent basis.
 * The browser previews exactly what the server will do (same pure parser).
 * SMS marketing consent is never granted by import.
 */
export function ContactImport() {
  const [fileName, setFileName] = useState('');
  const [csv, setCsv] = useState('');
  const [mapping, setMapping] = useState<ImportMapping>({});
  const [basis, setBasis] = useState<EmailBasis>('none');
  const [fileError, setFileError] = useState<string | null>(null);

  const table = useMemo(() => (csv ? parseCsv(csv) : []), [csv]);
  const headers = table[0] ?? [];
  const built = useMemo(() => (headers.length ? buildImportRows(table, mapping, basis) : { rows: [], issues: [] }), [table, headers.length, mapping, basis]);

  async function pick(file: File | null) {
    setFileError(null);
    setCsv('');
    setMapping({});
    setFileName('');
    if (!file) return;
    if (file.size > IMPORT_MAX_BYTES) { setFileError('File is too big. Split it under 500 KB.'); return; }
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length < 2) { setFileError('That file has no rows under the header.'); return; }
    setFileName(file.name);
    setCsv(text);
    setMapping(guessMapping(rows[0] ?? []));
  }

  const setField = (field: ImportField, value: string) => setMapping((prev) => {
    const next = { ...prev };
    if (value === '') delete next[field];
    else next[field] = Number(value);
    return next;
  });

  const optIns = built.rows.filter((r) => r.emailOptIn).length;
  const ready = headers.length > 0 && (mapping.email !== undefined || mapping.phone !== undefined)
    && (mapping.full_name !== undefined || mapping.first_name !== undefined)
    && (basis !== 'column' || mapping.email_consent !== undefined);

  return (
    <ActionForm action={importContactsAction} className="grid gap-5" feedback="below">
      <input type="hidden" name="csv" value={csv} />
      <input type="hidden" name="file_name" value={fileName} />
      <input type="hidden" name="mapping" value={JSON.stringify(mapping)} />

      <div>
        <label htmlFor="file"><span className={labelClass}>CSV file</span></label>
        <input id="file" type="file" accept=".csv,text/csv" onChange={(e) => void pick(e.target.files?.[0] ?? null)}
          className="block w-full cursor-pointer rounded-sm border border-line bg-carbon p-2 text-sm file:mr-3 file:cursor-pointer file:rounded-sm file:border-0 file:bg-clover file:px-3 file:py-1.5 file:text-sm file:font-bold file:text-carbon" />
        <p className="mt-1.5 text-xs text-steel">Header row required. Up to {IMPORT_MAX_ROWS} rows, 500 KB.</p>
        {fileError && <p role="alert" className="mt-1.5 text-sm font-semibold text-danger">{fileError}</p>}
      </div>

      {headers.length > 0 && (
        <>
          <fieldset>
            <legend className={labelClass}>Match columns</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {IMPORT_FIELDS.map((field) => (
                <label key={field} className="text-sm">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-steel">{IMPORT_FIELD_LABEL[field]}</span>
                  <select value={mapping[field] ?? ''} onChange={(e) => setField(field, e.target.value)} className={fieldClass}>
                    <option value="">Skip</option>
                    {headers.map((h, i) => <option key={`${h}-${i}`} value={i}>{h.trim().slice(0, 40) || `Column ${i + 1}`}</option>)}
                  </select>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className={labelClass}>Email consent</legend>
            <div className="grid gap-1.5">
              {(['none', 'column', 'all'] as const).map((value) => (
                <label key={value} className="flex cursor-pointer items-center gap-2 rounded-sm border border-line px-3 py-2 text-sm has-[:checked]:border-clover has-[:checked]:bg-clover/[0.06]">
                  <input type="radio" name="basis" value={value} checked={basis === value} onChange={() => setBasis(value)} className="size-4 accent-clover" />
                  {BASIS_LABEL[value]}
                </label>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-steel">Texting consent is never imported. People start unsubscribed unless this proves an opt-in.</p>
          </fieldset>

          {basis !== 'none' && (
            <label><span className={labelClass}>How they opted in</span>
              <input name="basis_note" maxLength={300} required placeholder="Checked the newsletter box at the counter" className={fieldClass} />
              <span className="mt-1.5 block text-xs text-steel">Stored with every opt-in as proof.</span>
            </label>
          )}

          <div className="rounded-sm border border-line bg-carbon-2 p-3">
            <p className="flex flex-wrap items-center gap-2 text-sm font-bold">
              Preview <Badge tone="info">{built.rows.length} rows</Badge>
              {optIns > 0 && <Badge tone="good">{optIns} email opt-ins</Badge>}
              {built.issues.length > 0 && <Badge tone="warn">{built.issues.length} to check</Badge>}
            </p>
            <ul className="mt-2 grid gap-1 text-sm text-chalk/75">
              {built.rows.slice(0, PREVIEW_ROWS).map((row) => (
                <li key={row.line} className="truncate">
                  <span className="font-semibold text-chalk">{row.fullName}</span> · {[row.email, row.phone].filter(Boolean).join(' · ') || 'no contact'}
                  {row.tags.length > 0 && <span className="text-steel"> · {row.tags.join(', ')}</span>}
                </li>
              ))}
              {built.rows.length > PREVIEW_ROWS && <li className="text-steel">+{built.rows.length - PREVIEW_ROWS} more</li>}
              {built.rows.length === 0 && <li className="text-steel">Nothing importable yet. Check the column matches.</li>}
            </ul>
            {built.issues.length > 0 && (
              <ul className="mt-2 grid gap-1 border-t border-line pt-2 text-xs text-amber-300">
                {built.issues.slice(0, PREVIEW_ROWS).map((issue, i) => <li key={`${issue.line}-${i}`} className="truncate">Row {issue.line}: {issue.reason}</li>)}
                {built.issues.length > PREVIEW_ROWS && <li className="text-steel">+{built.issues.length - PREVIEW_ROWS} more</li>}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <PendingButton name="mode" value="preview" variant="secondary" disabled={!ready}>Dry run</PendingButton>
            <PendingButton name="mode" value="commit" disabled={!ready || built.rows.length === 0}>Import {built.rows.length} contacts</PendingButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}

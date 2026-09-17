'use client';

import { LoaderCircle, Plus, Sparkles, Users } from 'lucide-react';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { nlSegmentAction, previewSegmentAction, saveSegmentAction, type NlSegmentResponse, type PreviewResult } from '@/app/admin/marketing/contacts/segment-actions';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import { buttonClass, fieldClass, labelClass } from '@/components/app/ui';
import { NL_MAX_CHARS } from '@/lib/marketing/core/segment-nl';
import type { SegmentRules } from '@/lib/marketing/core/segment-rules';
import { ConditionRow } from './ConditionRow';
import { fromRules, newRow, toRules, type RowState } from './segment-fields';

const PREVIEW_DELAY_MS = 450;
const NL_EXAMPLE = 'Cummins owners who tow, 100k+ miles, not seen in a year';

interface SegmentBuilderProps {
  id?: string;
  name?: string;
  description?: string | null;
  rules?: SegmentRules;
}

/** Visual rule builder with a live member count. */
export function SegmentBuilder({ id, name = '', description = '', rules }: SegmentBuilderProps) {
  const [match, setMatch] = useState<'all' | 'any'>(rules?.match ?? 'all');
  const [rows, setRows] = useState<RowState[]>(() => (rules?.conditions.length ? fromRules(rules) : [newRow('platform', 'init-0')]));
  const [preview, setPreview] = useState<PreviewResult>({ count: null, sample: [], error: null });
  const [pending, startTransition] = useTransition();
  const [nlText, setNlText] = useState('');
  const [nl, setNl] = useState<NlSegmentResponse | null>(null);
  const [nlPending, startNl] = useTransition();

  const { rules: built, incomplete } = useMemo(() => toRules(match, rows), [match, rows]);
  const json = JSON.stringify(built);

  useEffect(() => {
    const timer = setTimeout(() => {
      startTransition(async () => setPreview(await previewSegmentAction(json)));
    }, PREVIEW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [json]);

  const update = (key: string, next: RowState) => setRows((prev) => prev.map((r) => (r.key === key ? next : r)));

  function describe() {
    if (!nlText.trim() || nlPending) return;
    startNl(async () => {
      const result = await nlSegmentAction(nlText);
      setNl(result);
      if (result.rules.conditions.length) {
        setMatch(result.rules.match);
        setRows(fromRules(result.rules));
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <ActionForm action={saveSegmentAction} className="grid min-w-0 content-start gap-5">
        {id && <input type="hidden" name="id" value={id} />}
        <input type="hidden" name="rules" value={json} />

        <div className="rounded-md border border-dashed border-clover/40 bg-clover/[0.04] p-3">
          <label htmlFor="nl" className="flex items-center gap-1.5 text-sm font-bold text-clover">
            <Sparkles className="size-4" aria-hidden="true" /> Describe it
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <input id="nl" value={nlText} maxLength={NL_MAX_CHARS} placeholder={NL_EXAMPLE} onChange={(e) => setNlText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); describe(); } }}
              className={`${fieldClass} min-w-[14rem] flex-1`} />
            <button type="button" onClick={describe} disabled={nlPending || !nlText.trim()} className={buttonClass('secondary')}>
              {nlPending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}Build rules
            </button>
          </div>
          <p aria-live="polite" className="mt-2 text-xs text-steel">
            {nl?.error ? <span className="font-semibold text-danger">{nl.error}</span>
              : nl ? <>Read: {nl.understood.join(', ') || 'nothing'}{nl.ignored.length ? ` · Ignored: ${nl.ignored.join(', ')}` : ''}. Check the rules below.</>
              : 'Plain English turns into rules you can edit.'}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label><span className={labelClass}>Name</span>
            <input name="name" required maxLength={80} defaultValue={name} placeholder="Duramax owners, 150k+" className={fieldClass} />
          </label>
          <label><span className={labelClass}>Note <span className="font-normal text-steel">(optional)</span></span>
            <input name="description" maxLength={300} defaultValue={description ?? ''} placeholder="Who this is for" className={fieldClass} />
          </label>
        </div>

        <fieldset className="min-w-0">
          <legend className="mb-2 flex flex-wrap items-center gap-2 text-sm font-semibold">
            Match
            <span role="group" aria-label="Match mode" className="inline-flex rounded-sm border border-line bg-carbon p-0.5">
              {(['all', 'any'] as const).map((m) => (
                <button key={m} type="button" aria-pressed={match === m} onClick={() => setMatch(m)}
                  className={`h-7 rounded-sm px-3 text-xs font-bold uppercase tracking-widest ${match === m ? 'bg-clover text-carbon' : 'text-steel hover:text-chalk'}`}>
                  {m}
                </button>
              ))}
            </span>
            of these rules
          </legend>
          <ol className="grid gap-2">
            {rows.map((row, index) => (
              <ConditionRow key={row.key} row={row} index={index} onChange={(next) => update(row.key, next)} onRemove={() => setRows((prev) => prev.filter((r) => r.key !== row.key))} />
            ))}
          </ol>
          <button type="button" onClick={() => setRows((prev) => [...prev, newRow('days_since_last_visit')])}
            className="mt-2 inline-flex h-10 items-center gap-1.5 rounded-sm border border-dashed border-clover/40 px-3 text-sm font-semibold text-clover hover:border-clover hover:bg-clover/[0.06]">
            <Plus className="size-4" aria-hidden="true" /> Add rule
          </button>
        </fieldset>

        <div className="flex flex-wrap items-center gap-3">
          <PendingButton disabled={!built.conditions.length}>{id ? 'Save and refresh' : 'Save segment'}</PendingButton>
          {incomplete > 0 && <p className="text-sm text-amber-300">{incomplete} rule{incomplete === 1 ? '' : 's'} unfinished, skipped.</p>}
        </div>
      </ActionForm>

      <aside aria-live="polite" className="order-first h-fit rounded-md border border-clover/30 bg-gradient-to-b from-clover/[0.08] to-carbon-2 p-4 lg:sticky lg:top-24 lg:order-none lg:p-5">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-clover">
          <Users className="size-4" aria-hidden="true" /> Live count
          {pending && <LoaderCircle className="size-3.5 animate-spin" aria-label="Counting" />}
        </p>
        <p className="display mt-1 text-5xl not-italic tabular-nums lg:mt-2 lg:text-6xl">{preview.count ?? '—'}</p>
        <p className="text-sm text-chalk/60">{built.conditions.length ? 'people match right now' : 'Add a rule to count'}</p>
        {preview.error && <p role="alert" className="mt-2 text-sm text-danger">{preview.error}</p>}
        {preview.sample.length > 0 && (
          <ul className="mt-4 hidden gap-1 border-t border-line pt-3 text-sm text-chalk/75 lg:grid">
            {preview.sample.map((person) => <li key={person} className="truncate">{person}</li>)}
            {(preview.count ?? 0) > preview.sample.length && <li className="text-steel">+{(preview.count ?? 0) - preview.sample.length} more</li>}
          </ul>
        )}
      </aside>
    </div>
  );
}

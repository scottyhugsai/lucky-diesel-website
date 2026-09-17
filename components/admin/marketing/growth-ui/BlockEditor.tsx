'use client';

import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { saveLanding } from '@/app/admin/marketing/pages/actions';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import { fieldClass } from '@/components/app/ui';
import type { LandingBlock } from '@/lib/marketing/content/landing-blocks';
import { BLOCK_LABEL, BlockFields, NEW_BLOCK } from './BlockFields';
import { Field } from './kit';

interface BlockEditorProps {
  pageId: string;
  title: string;
  seoDescription: string | null;
  leadMagnetId: string | null;
  initialBlocks: LandingBlock[];
  magnets: { id: string; title: string }[];
  services: { id: string; name: string }[];
}

const ADDABLE: LandingBlock['type'][] = ['hero', 'offer', 'proof', 'faq', 'form', 'bullets', 'cta'];
const iconBtn = 'grid size-9 place-items-center rounded-sm border border-line text-chalk/70 hover:border-clover hover:text-clover disabled:opacity-30';

export function BlockEditor({ pageId, title, seoDescription, leadMagnetId, initialBlocks, magnets, services }: BlockEditorProps) {
  const [blocks, setBlocks] = useState<LandingBlock[]>(initialBlocks);
  const [keys, setKeys] = useState<number[]>(() => initialBlocks.map((_, i) => i));
  const [nextKey, setNextKey] = useState(initialBlocks.length);

  const move = (from: number, to: number) => {
    const reorder = <T,>(list: T[]) => { const copy = [...list]; const [item] = copy.splice(from, 1); copy.splice(to, 0, item!); return copy; };
    setBlocks(reorder(blocks));
    setKeys(reorder(keys));
  };
  const remove = (index: number) => {
    setBlocks(blocks.filter((_, i) => i !== index));
    setKeys(keys.filter((_, i) => i !== index));
  };
  const add = (type: LandingBlock['type']) => {
    setBlocks([...blocks, NEW_BLOCK[type]]);
    setKeys([...keys, nextKey]);
    setNextKey(nextKey + 1);
  };
  const update = (index: number, block: LandingBlock) => setBlocks(blocks.map((b, i) => (i === index ? block : b)));
  const hasForm = blocks.some((b) => b.type === 'form');

  return (
    <ActionForm action={saveLanding} className="grid gap-5" aria-label="Edit landing page">
      <input type="hidden" name="page_id" value={pageId} />
      <input type="hidden" name="blocks" value={JSON.stringify(blocks)} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Page title" htmlFor="lp-title"><input id="lp-title" name="title" defaultValue={title} required maxLength={80} className={fieldClass} /></Field>
        <Field label="Free checklist" htmlFor="lp-magnet">
          <select id="lp-magnet" name="lead_magnet_id" defaultValue={leadMagnetId ?? ''} className={fieldClass}>
            <option value="">None</option>
            {magnets.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
          </select>
        </Field>
        <Field label="Search blurb" htmlFor="lp-seo" className="sm:col-span-2"><input id="lp-seo" name="seo_description" defaultValue={seoDescription ?? ''} maxLength={200} className={fieldClass} /></Field>
      </div>

      <ol className="grid gap-3">
        {blocks.map((block, index) => (
          <li key={keys[index]} className="rounded-md border border-line bg-carbon p-3 sm:p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-sm bg-gunmetal font-mono text-xs">{index + 1}</span>
              <span className="font-semibold">{BLOCK_LABEL[block.type]}</span>
              <span className="ml-auto flex gap-1.5">
                <button type="button" className={iconBtn} onClick={() => move(index, index - 1)} disabled={index === 0} aria-label={`Move ${BLOCK_LABEL[block.type]} up`}><ArrowUp className="size-4" aria-hidden="true" /></button>
                <button type="button" className={iconBtn} onClick={() => move(index, index + 1)} disabled={index === blocks.length - 1} aria-label={`Move ${BLOCK_LABEL[block.type]} down`}><ArrowDown className="size-4" aria-hidden="true" /></button>
                <button type="button" className={iconBtn} onClick={() => remove(index)} disabled={blocks.length === 1} aria-label={`Remove ${BLOCK_LABEL[block.type]}`}><Trash2 className="size-4" aria-hidden="true" /></button>
              </span>
            </div>
            <BlockFields block={block} id={`b${keys[index]}`} services={services} onChange={(b) => update(index, b)} />
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Add a block">
        <span className="text-xs font-semibold uppercase tracking-widest text-steel">Add</span>
        {ADDABLE.filter((t) => t !== 'form' || !hasForm).map((type) => (
          <button key={type} type="button" onClick={() => add(type)} className="inline-flex h-9 items-center gap-1 rounded-sm border border-dashed border-line px-2.5 text-sm font-semibold text-chalk/75 hover:border-clover hover:text-clover">
            <Plus className="size-3.5" aria-hidden="true" />{BLOCK_LABEL[type]}
          </button>
        ))}
      </div>
      <p className="text-xs text-steel">First block must be a Hero. One form per page.</p>
      <div className="sticky bottom-3 z-10 flex">
        <PendingButton className="shadow-lg">Save page</PendingButton>
      </div>
    </ActionForm>
  );
}

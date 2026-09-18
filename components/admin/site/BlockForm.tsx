'use client';

import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import { Badge, Card, labelClass } from '@/components/app/ui';
import type { BlockDef, BlockValues } from '@/lib/site-content/fields';
import { discardBlockAction, publishBlockAction, saveBlockAction } from '@/app/admin/site/actions';
import { CountedField } from './CountedField';
import { MediaField, type MediaChoice } from './MediaField';
import { OrderList } from './OrderList';

export type BlockStatus = 'live' | 'draft' | 'shipped';

const STATUS: Record<BlockStatus, { tone: 'neutral' | 'good' | 'warn'; label: string }> = {
  shipped: { tone: 'neutral', label: 'Built-in copy' },
  live: { tone: 'good', label: 'Live' },
  draft: { tone: 'warn', label: 'Draft — not live yet' },
};

function value(values: BlockValues, name: string): string {
  const raw = values[name];
  return typeof raw === 'string' ? raw : '';
}

function listValue(values: BlockValues, name: string): readonly string[] {
  const raw = values[name];
  return Array.isArray(raw) ? raw : [];
}

export function BlockForm({ def, values, design, status, library }: {
  def: BlockDef;
  values: BlockValues;
  design: string;
  status: BlockStatus;
  library: readonly MediaChoice[];
}) {
  const badge = STATUS[status];
  return (
    <Card
      title={def.title}
      action={<Badge tone={badge.tone}>{badge.label}</Badge>}
      className="scroll-mt-6"
    >
      {def.description && <p className="mb-4 text-sm text-steel">{def.description}</p>}
      <ActionForm action={saveBlockAction} aria-label={`Edit ${def.title}`}>
        <input type="hidden" name="key" value={def.key} />
        <input type="hidden" name="design" value={design} />
        <div className="space-y-5">
          {def.fields.map((field) => (
            <div key={field.name}>
              <label className={labelClass} htmlFor={field.kind === 'boolean' ? `${def.key}-${field.name}` : undefined}>
                {field.label}
              </label>
              {field.help && <p className="-mt-1 mb-1.5 text-xs text-steel">{field.help}</p>}

              {(field.kind === 'text' || field.kind === 'textarea' || field.kind === 'url') && (
                <CountedField
                  name={field.name}
                  initial={value(values, field.name)}
                  max={field.max}
                  maxWords={field.maxWords}
                  multiline={field.kind === 'textarea'}
                />
              )}

              {field.kind === 'boolean' && (
                <label className="flex items-center gap-2 text-sm">
                  <input id={`${def.key}-${field.name}`} type="checkbox" name={field.name} defaultChecked={values[field.name] === true} className="size-4 accent-clover" />
                  <span className="text-steel">Yes</span>
                </label>
              )}

              {field.kind === 'select' && (
                <select name={field.name} defaultValue={value(values, field.name)} className="w-full rounded-md border border-line bg-carbon px-3 py-2 text-sm">
                  <option value="">Default</option>
                  {field.options.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              )}

              {field.kind === 'image' && <MediaField name={field.name} initial={value(values, field.name)} library={library} />}

              {field.kind === 'list' && (
                <OrderList name={field.name} options={field.options} initial={listValue(values, field.name)} max={field.max} />
              )}
            </div>
          ))}
        </div>
        <div className="mt-5"><PendingButton>Save draft</PendingButton></div>
      </ActionForm>

      <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
        <ActionForm action={publishBlockAction} feedback="none" className="contents">
          <input type="hidden" name="key" value={def.key} />
          <input type="hidden" name="design" value={design} />
          <PendingButton variant="secondary">Publish</PendingButton>
        </ActionForm>
        {status === 'draft' && (
          <ActionForm action={discardBlockAction} feedback="none" className="contents" confirm="Throw away the unpublished edits to this section?">
            <input type="hidden" name="key" value={def.key} />
            <input type="hidden" name="design" value={design} />
            <PendingButton variant="ghost">Discard draft</PendingButton>
          </ActionForm>
        )}
      </div>
    </Card>
  );
}

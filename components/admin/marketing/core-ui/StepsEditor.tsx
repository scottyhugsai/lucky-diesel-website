'use client';

import { useState } from 'react';
import { saveStepsAction } from '@/app/admin/marketing/campaigns/actions';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import { labelClass } from '@/components/app/ui';
import { EXIT_OPTIONS, type StepDraft } from './campaign-input';
import { StepsComposer } from './StepsComposer';

const EXIT_LABEL: Record<string, string> = { booked: 'They book', replied: 'They reply', unsubscribed: 'They unsubscribe' };

interface StepsEditorProps {
  id: string;
  channel: 'email' | 'sms';
  kind: 'broadcast' | 'drip' | 'lifecycle';
  initial: StepDraft[];
  exitOn: string[];
  editable: boolean;
}

/** Edits message steps (and drip exit rules) on an existing draft or paused campaign. */
export function StepsEditor({ id, channel, kind, initial, exitOn, editable }: StepsEditorProps) {
  const [steps, setSteps] = useState<StepDraft[]>(initial.length ? initial : [{ order: 1, variant: 'A', delayMinutes: 0, subject: '', body: '' }]);

  return (
    <ActionForm action={saveStepsAction} className="grid gap-4">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="steps" value={JSON.stringify(steps)} />
      <fieldset disabled={!editable} className="grid min-w-0 gap-4 disabled:opacity-70">
        <StepsComposer channel={channel} kind={kind} steps={steps} onChange={setSteps} />
        {kind !== 'broadcast' && (
          <div>
            <p className={labelClass}>Stop the drip when</p>
            <div className="flex flex-wrap gap-2">
              {EXIT_OPTIONS.map((option) => (
                <label key={option} className="inline-flex h-10 items-center gap-2 rounded-sm border border-line px-3 text-sm font-semibold">
                  <input type="checkbox" name="exit_on" value={option} defaultChecked={exitOn.includes(option)} className="size-4" />
                  {EXIT_LABEL[option]}
                </label>
              ))}
            </div>
          </div>
        )}
      </fieldset>
      {editable ? <PendingButton className="justify-self-start">Save messages</PendingButton> : <p className="text-sm text-steel">Pause the campaign to edit messages.</p>}
    </ActionForm>
  );
}

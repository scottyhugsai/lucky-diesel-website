'use client';

import { useActionState, useRef, useState } from 'react';
import { RotateCcw, TriangleAlert } from 'lucide-react';
import { saveAutomation } from '@/app/admin/automations/actions';
import { SubmitButton } from '@/components/app/SubmitButton';
import { buttonClass, fieldClass, labelClass } from '@/components/app/ui';
import { renderTemplate, smsSegments } from '@/lib/messaging/template';
import { SAMPLE_VARS } from './automation-meta';
import { DelayField, splitDelay, UNIT_MINUTES, type DelayUnit } from './DelayField';
import { TEMPLATE_MAX, type ActionState } from './form';
import { FormMessage } from './FormMessage';
import { EmailPreview, SmsPreview } from './MessagePreview';
import { PlaceholderChips } from './PlaceholderChips';

export interface EditableTemplate {
  sms: string;
  subject: string;
  body: string;
  delayMinutes: number;
}

type Field = 'sms' | 'subject' | 'body';

interface TemplateEditorProps {
  automationKey: string;
  channels: ('sms' | 'email')[];
  beforeAppointment: boolean;
  audience: string;
  current: EditableTemplate;
  defaults: EditableTemplate | null;
  placeholders: string[];
}

export function TemplateEditor({ automationKey, channels, beforeAppointment, audience, current, defaults, placeholders }: TemplateEditorProps) {
  const [state, action] = useActionState<ActionState, FormData>(saveAutomation, {});
  const [values, setValues] = useState(current);
  const [delay, setDelay] = useState(() => splitDelay(current.delayMinutes));
  const smsRef = useRef<HTMLTextAreaElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const lastFocused = useRef<Field>(channels.includes('sms') ? 'sms' : 'body');

  const hasSms = channels.includes('sms');
  const hasEmail = channels.includes('email');
  const segments = values.sms ? smsSegments(renderTemplate(values.sms, SAMPLE_VARS)) : 0;
  const unicodeChars = [...new Set(values.sms.match(/[‘’“”–—…]/g) ?? [])];
  const delayMinutes = (Number.isNaN(delay.amount) ? 0 : delay.amount) * UNIT_MINUTES[delay.unit];
  const dirty = values.sms !== current.sms || values.subject !== current.subject || values.body !== current.body || delayMinutes !== current.delayMinutes;

  function update(field: Field, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  function insert(token: string) {
    const field = lastFocused.current;
    const el = field === 'sms' ? smsRef.current : field === 'subject' ? subjectRef.current : bodyRef.current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const next = `${el.value.slice(0, start)}${token}${el.value.slice(end)}`;
    update(field, next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  function resetToDefault() {
    if (!defaults) return;
    setValues(defaults);
    setDelay(splitDelay(defaults.delayMinutes));
  }

  const counter = (length: number) => (
    <span className={`text-xs tabular-nums ${length > TEMPLATE_MAX ? 'text-danger' : 'text-steel'}`}>{length}/{TEMPLATE_MAX}</span>
  );

  return (
    <form action={action} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
      <input type="hidden" name="key" value={automationKey} />
      <div className="grid content-start gap-5 rounded-md border border-line bg-carbon-2 p-4 sm:p-5">
        <PlaceholderChips names={placeholders} onInsert={insert} />

        {hasSms && (
          <div>
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <label htmlFor="sms_template" className={labelClass}>Text message</label>
              {counter(values.sms.length)}
            </div>
            <textarea
              id="sms_template" name="sms_template" ref={smsRef} rows={4} maxLength={TEMPLATE_MAX} value={values.sms}
              onFocus={() => { lastFocused.current = 'sms'; }} onChange={(e) => update('sms', e.target.value)}
              className={`${fieldClass} h-auto py-2.5 font-mono text-sm leading-relaxed`}
            />
            <p className={`mt-1.5 flex items-center gap-1.5 text-xs font-semibold ${segments > 2 ? 'text-amber-300' : 'text-steel'}`} aria-live="polite">
              {segments > 2 && <TriangleAlert className="size-3.5" aria-hidden="true" />}
              {segments} SMS segment{segments === 1 ? '' : 's'} with sample values{segments > 2 ? ' — long texts cost more and read worse. Aim for 1–2.' : ''}
            </p>
            {unicodeChars.length > 0 && (
              <p className="mt-1 text-xs text-steel">
                Smart punctuation ({unicodeChars.join(' ')}) switches the text to Unicode, which fits 70 characters per segment instead of 160. Use plain &apos; and &quot; to send fewer segments.
              </p>
            )}
          </div>
        )}

        {hasEmail && (
          <>
            <div>
              <label htmlFor="email_subject_template" className={labelClass}>Email subject</label>
              <input
                id="email_subject_template" name="email_subject_template" ref={subjectRef} maxLength={200} value={values.subject}
                onFocus={() => { lastFocused.current = 'subject'; }} onChange={(e) => update('subject', e.target.value)}
                className={`${fieldClass} font-mono text-sm`}
              />
            </div>
            <div>
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <label htmlFor="email_body_template" className={labelClass}>Email body</label>
                {counter(values.body.length)}
              </div>
              <textarea
                id="email_body_template" name="email_body_template" ref={bodyRef} rows={9} maxLength={TEMPLATE_MAX} value={values.body}
                onFocus={() => { lastFocused.current = 'body'; }} onChange={(e) => update('body', e.target.value)}
                className={`${fieldClass} h-auto py-2.5 font-mono text-sm leading-relaxed`}
              />
            </div>
          </>
        )}

        <DelayField amount={delay.amount} unit={delay.unit as DelayUnit} beforeAppointment={beforeAppointment} onChange={setDelay} />

        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
          {defaults && (
            <button type="button" onClick={resetToDefault} className={buttonClass('ghost')}>
              <RotateCcw className="size-4" aria-hidden="true" /> Reset to default
            </button>
          )}
          {dirty && <span className="text-xs font-semibold uppercase tracking-widest text-amber-300">Unsaved changes</span>}
          <FormMessage state={state} className="basis-full" />
        </div>
      </div>

      <div className="grid content-start gap-5 xl:sticky xl:top-8 xl:self-start">
        <p className="kicker">Live preview</p>
        {hasSms && <SmsPreview body={renderTemplate(values.sms, SAMPLE_VARS)} />}
        {hasEmail && (
          <EmailPreview
            to={audience === 'customer' ? 'Cody Brooks <cody@example.com>' : 'Owner'}
            subject={renderTemplate(values.subject, SAMPLE_VARS)}
            body={renderTemplate(values.body, SAMPLE_VARS)}
          />
        )}
        <p className="text-xs text-steel">Sample values shown. Real messages fill in the customer, truck and links.</p>
      </div>
    </form>
  );
}

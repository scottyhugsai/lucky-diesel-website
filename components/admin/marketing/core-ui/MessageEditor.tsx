'use client';

import { OctagonAlert, TriangleAlert } from 'lucide-react';
import { useMemo, useRef } from 'react';
import { EmailPreview, SmsPreview } from '@/components/admin/ops/MessagePreview';
import { PlaceholderChips } from '@/components/admin/ops/PlaceholderChips';
import { fieldClass, labelClass } from '@/components/app/ui';
import { checkClaims } from '@/lib/marketing/core/compliance';
import { renderTemplate, smsSegments } from '@/lib/messaging/template';
import { BODY_MAX, SUBJECT_MAX } from './campaign-input';

export const CAMPAIGN_PLACEHOLDERS = ['first_name', 'vehicle', 'platform', 'link', 'offer_code', 'referral_code', 'shop_phone', 'booking_link'];

const PREVIEW_VARS = {
  first_name: 'Cody', customer_name: 'Cody Brooks', vehicle: '2019 Ram 2500 6.7L', platform: 'cummins', shop_phone: '(843) 995-9252',
  booking_link: 'luckydiesel.com/book', link: 'luckydiesel.com/r/ab12cd', offer_code: 'DIESEL25', referral_code: 'CODY-7K2P',
  referral_link: 'luckydiesel.com/r/cody', business_name: 'Lucky Diesel', unsubscribe_link: 'luckydiesel.com/unsubscribe',
};

export function ClaimWarnings({ text }: { text: string }) {
  const { issues } = useMemo(() => checkClaims(text), [text]);
  if (!issues.length) return null;
  return (
    <ul className="grid gap-1.5" aria-live="polite">
      {issues.map((issue) => {
        const block = issue.severity === 'block';
        const Icon = block ? OctagonAlert : TriangleAlert;
        return (
          <li key={`${issue.rule}-${issue.index}`} className={`flex gap-2 rounded-sm border px-3 py-2 text-sm ${block ? 'border-danger/45 bg-danger/10 text-danger' : 'border-amber-400/35 bg-amber-400/10 text-amber-200'}`}>
            <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span><strong>“{issue.match}”</strong> {block ? 'blocks sending.' : 'needs proof.'} {issue.suggestion ?? issue.reason}</span>
          </li>
        );
      })}
    </ul>
  );
}

interface MessageEditorProps {
  id: string;
  channel: 'email' | 'sms';
  subject: string;
  body: string;
  onChange: (next: { subject: string; body: string }) => void;
}

/** Subject/body editor with placeholder chips, live preview, SMS segment counter and claims check. */
export function MessageEditor({ id, channel, subject, body, onChange }: MessageEditorProps) {
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const lastField = useRef<'subject' | 'body'>('body');
  const rendered = renderTemplate(body, PREVIEW_VARS);
  const segments = body ? smsSegments(`Lucky Diesel: ${rendered}\nReply STOP to opt out`) : 0;

  function insert(token: string) {
    const field = channel === 'email' ? lastField.current : 'body';
    const el = field === 'subject' ? subjectRef.current : bodyRef.current;
    const current = field === 'subject' ? subject : body;
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    const next = `${current.slice(0, start)}${token}${current.slice(end)}`;
    onChange(field === 'subject' ? { subject: next, body } : { subject, body: next });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_17rem]">
      <div className="grid min-w-0 content-start gap-3">
        {channel === 'email' && (
          <label htmlFor={`${id}-subject`}>
            <span className={labelClass}>Subject</span>
            <input id={`${id}-subject`} ref={subjectRef} value={subject} maxLength={SUBJECT_MAX} onFocus={() => { lastField.current = 'subject'; }}
              onChange={(e) => onChange({ subject: e.target.value, body })} placeholder="Towing season check for your {{vehicle}}" className={fieldClass} />
          </label>
        )}
        <label htmlFor={`${id}-body`}>
          <span className={`${labelClass} flex items-center justify-between`}>
            {channel === 'sms' ? 'Text' : 'Email body'}
            <span className={`text-xs font-semibold tabular-nums ${channel === 'sms' && segments > 2 ? 'text-amber-300' : 'text-steel'}`}>
              {body.length}/{BODY_MAX}{channel === 'sms' ? ` · ${segments} segment${segments === 1 ? '' : 's'}` : ''}
            </span>
          </span>
          <textarea id={`${id}-body`} ref={bodyRef} value={body} maxLength={BODY_MAX} rows={channel === 'sms' ? 4 : 8}
            onFocus={() => { lastField.current = 'body'; }} onChange={(e) => onChange({ subject, body: e.target.value })}
            placeholder={channel === 'sms' ? 'Hey {{first_name}}, towing season is close…' : 'Hey {{first_name}},'}
            className={`${fieldClass} h-auto py-2.5 leading-relaxed`} />
        </label>
        <PlaceholderChips names={CAMPAIGN_PLACEHOLDERS} onInsert={insert} />
        {channel === 'sms' && <p className="text-xs text-steel">“Lucky Diesel:” and the STOP line are added automatically.</p>}
        <ClaimWarnings text={`${subject}\n${body}`} />
      </div>
      <div className="min-w-0">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-steel">Preview</p>
        {channel === 'sms'
          ? <SmsPreview body={body ? `Lucky Diesel: ${rendered}\nReply STOP to opt out` : ''} />
          : <EmailPreview subject={renderTemplate(subject, PREVIEW_VARS)} body={rendered} to="cody@example.com" />}
      </div>
    </div>
  );
}

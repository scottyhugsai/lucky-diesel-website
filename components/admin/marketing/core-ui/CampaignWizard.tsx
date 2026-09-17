'use client';

import { Check, ChevronLeft, ChevronRight, Mail, MessageSquare, Megaphone, Repeat, Workflow } from 'lucide-react';
import { useState } from 'react';
import { createCampaignAction } from '@/app/admin/marketing/campaigns/actions';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import { buttonClass, fieldClass, labelClass } from '@/components/app/ui';
import { MARKETING_EVENTS } from '@/lib/marketing/core/events';
import { checkClaims } from '@/lib/marketing/core/compliance';
import type { StepDraft } from './campaign-input';
import { EVENT_LABEL } from './labels';
import { ScheduleFields, type ScheduleState } from './ScheduleFields';
import { StepsComposer } from './StepsComposer';

type Kind = 'broadcast' | 'drip' | 'lifecycle';
const STEPS = ['Type', 'Audience', 'Message', 'Schedule'] as const;
const KINDS: { value: Kind; label: string; hint: string; icon: typeof Megaphone }[] = [
  { value: 'broadcast', label: 'Broadcast', hint: 'One send to a segment.', icon: Megaphone },
  { value: 'drip', label: 'Drip', hint: 'Timed steps after people join.', icon: Repeat },
  { value: 'lifecycle', label: 'Lifecycle', hint: 'Starts when something happens.', icon: Workflow },
];

interface WizardProps {
  segments: { id: string; name: string; member_count: number }[];
  quiet: { start: number; end: number };
  defaultSendAt: string;
}

export function CampaignWizard({ segments, quiet, defaultSendAt }: WizardProps) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<Kind>('broadcast');
  const [channel, setChannel] = useState<'email' | 'sms'>('email');
  const [segmentId, setSegmentId] = useState(segments[0]?.id ?? '');
  const [trigger, setTrigger] = useState<string>(MARKETING_EVENTS[0]);
  const [steps, setSteps] = useState<StepDraft[]>([{ order: 1, variant: 'A', delayMinutes: 0, subject: '', body: '' }]);
  const [schedule, setSchedule] = useState<ScheduleState>({ sendAt: defaultSendAt, windowStart: 9, windowEnd: 20, abPercent: 20, abMetric: 'click', abDecideHours: 4, exitOn: ['booked', 'replied', 'unsubscribed'] });

  const hasB = steps.some((s) => s.variant === 'B');
  const blocked = steps.some((s) => checkClaims(`${s.subject}\n${s.body}`).risk === 'fail');
  const problems = [
    name.trim() ? null : 'Name it.',
    kind === 'broadcast' && !segmentId ? 'Pick a segment.' : null,
    steps.some((s) => !s.body.trim() || (channel === 'email' && !s.subject.trim())) ? 'Finish every message.' : null,
    blocked ? 'Remove blocked wording.' : null,
  ];
  const stepProblem = [problems[0], problems[1], problems[2] ?? problems[3], null][step];

  const payload = JSON.stringify({
    name, kind, channel, segmentId: segmentId || null, triggerEvent: kind === 'broadcast' ? null : trigger,
    steps: steps.map((s) => ({ ...s, delayMinutes: kind === 'broadcast' ? 0 : s.delayMinutes })),
    abPercent: hasB ? schedule.abPercent : 0, abMetric: schedule.abMetric, abDecideAfterMinutes: schedule.abDecideHours * 60,
    windowStart: schedule.windowStart, windowEnd: schedule.windowEnd, exitOn: schedule.exitOn, seasonalKey: null,
  });

  return (
    <ActionForm action={createCampaignAction} className="grid gap-6">
      <input type="hidden" name="payload" value={payload} />
      <ol className="grid grid-cols-4 gap-1.5" aria-label="Progress">
        {STEPS.map((label, index) => (
          <li key={label}>
            <button type="button" onClick={() => index < step && setStep(index)} disabled={index > step} aria-current={index === step ? 'step' : undefined}
              className={`flex w-full flex-col items-start gap-1 border-t-2 pt-2 text-left text-xs font-bold uppercase tracking-widest transition-colors ${index === step ? 'border-clover text-chalk' : index < step ? 'border-clover/50 text-clover hover:text-chalk' : 'border-line text-steel'}`}>
              <span className="flex items-center gap-1">{index < step ? <Check className="size-3.5" aria-hidden="true" /> : <span className="tabular-nums">{index + 1}</span>}</span>
              <span className="truncate">{label}</span>
            </button>
          </li>
        ))}
      </ol>

      <section hidden={step !== 0} className="grid gap-5">
        <label><span className={labelClass}>Campaign name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Towing season 2027" className={fieldClass} />
        </label>
        <fieldset>
          <legend className={labelClass}>Type</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {KINDS.map((k) => (
              <button key={k.value} type="button" aria-pressed={kind === k.value} onClick={() => setKind(k.value)}
                className={`flex items-start gap-3 rounded-md border p-4 text-left transition-colors ${kind === k.value ? 'border-clover bg-clover/[0.08]' : 'border-line bg-carbon hover:border-chalk/30'}`}>
                <k.icon className={`mt-0.5 size-5 shrink-0 ${kind === k.value ? 'text-clover' : 'text-steel'}`} aria-hidden="true" />
                <span><span className="block font-bold">{k.label}</span><span className="text-sm text-chalk/60">{k.hint}</span></span>
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className={labelClass}>Channel</legend>
          <div className="flex gap-2">
            {(['email', 'sms'] as const).map((c) => (
              <button key={c} type="button" aria-pressed={channel === c} onClick={() => setChannel(c)}
                className={`inline-flex h-11 items-center gap-2 rounded-sm border px-4 font-semibold ${channel === c ? 'border-clover bg-clover text-carbon' : 'border-line text-chalk/75 hover:border-chalk/30'}`}>
                {c === 'email' ? <Mail className="size-4" aria-hidden="true" /> : <MessageSquare className="size-4" aria-hidden="true" />}{c === 'email' ? 'Email' : 'Text'}
              </button>
            ))}
          </div>
        </fieldset>
      </section>

      <section hidden={step !== 1} className="grid gap-5">
        {kind !== 'broadcast' && (
          <label><span className={labelClass}>Starts when</span>
            <select value={trigger} onChange={(e) => setTrigger(e.target.value)} className={fieldClass}>
              {MARKETING_EVENTS.map((event) => <option key={event} value={event}>{EVENT_LABEL[event] ?? event}</option>)}
            </select>
          </label>
        )}
        <fieldset>
          <legend className={labelClass}>{kind === 'broadcast' ? 'Send to' : 'Also enroll this segment (optional)'}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {kind !== 'broadcast' && (
              <button type="button" aria-pressed={!segmentId} onClick={() => setSegmentId('')}
                className={`rounded-md border p-3 text-left ${!segmentId ? 'border-clover bg-clover/[0.08]' : 'border-line bg-carbon'}`}>
                <span className="font-bold">Trigger only</span>
              </button>
            )}
            {segments.map((s) => (
              <button key={s.id} type="button" aria-pressed={segmentId === s.id} onClick={() => setSegmentId(s.id)}
                className={`flex items-center justify-between gap-3 rounded-md border p-3 text-left transition-colors ${segmentId === s.id ? 'border-clover bg-clover/[0.08]' : 'border-line bg-carbon hover:border-chalk/30'}`}>
                <span className="min-w-0 truncate font-bold">{s.name}</span>
                <span className="display text-2xl not-italic tabular-nums text-clover">{s.member_count}</span>
              </button>
            ))}
          </div>
          <a href="/admin/marketing/contacts/segments/new" target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-semibold text-clover hover:underline">Build a new segment ↗</a>
        </fieldset>
      </section>

      <section hidden={step !== 2}>
        <StepsComposer channel={channel} kind={kind} steps={steps} onChange={setSteps} />
      </section>

      <section hidden={step !== 3}>
        <ScheduleFields kind={kind} hasB={hasB} quiet={quiet} value={schedule} onChange={setSchedule} />
      </section>

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
        {step > 0 && <button type="button" onClick={() => setStep(step - 1)} className={buttonClass('ghost')}><ChevronLeft className="size-4" aria-hidden="true" /> Back</button>}
        {step < 3 ? (
          <button type="button" disabled={Boolean(stepProblem)} onClick={() => setStep(step + 1)} className={buttonClass('primary')}>
            Next <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        ) : (
          <>
            <PendingButton name="intent" value="schedule" disabled={problems.some(Boolean)}>{kind === 'broadcast' ? 'Schedule send' : 'Start campaign'}</PendingButton>
            <PendingButton name="intent" value="draft" variant="secondary" disabled={!name.trim()}>Save draft</PendingButton>
          </>
        )}
        {stepProblem && <p className="text-sm text-amber-300">{stepProblem}</p>}
      </div>
    </ActionForm>
  );
}

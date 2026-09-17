import Link from 'next/link';
import { saveAiCapAction, saveTendlcAction, checkSenderDnsAction, toggleChecklistAction } from '@/app/admin/marketing/settings/ops-actions';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import { CopyButton } from '@/components/admin/marketing/growth-ui/CopyButton';
import { Badge, fieldClass, labelClass } from '@/components/app/ui';
import { dateTime } from '@/lib/format';
import { CHECKLISTS } from '@/lib/marketing/content/checklists';
import { BUSINESS_TYPES, TENDLC_USE_CASES, TENDLC_USE_CASE_LABEL } from '@/lib/marketing/content/tendlc';
import type { OpsData } from './ops-data';

/** Monthly AI budget. At zero every generator falls back to templates. */
export function AiCapCard({ capUsd }: { capUsd: number }) {
  return (
    <ActionForm action={saveAiCapAction} className="grid gap-3" aria-label="AI spend cap">
      <label htmlFor="ai-cap"><span className={labelClass}>Monthly cap ($)</span>
        <input id="ai-cap" name="ai_monthly_cap_usd" inputMode="decimal" defaultValue={capUsd} className={fieldClass} />
      </label>
      <p className="text-xs text-steel">{capUsd === 0 ? 'AI is off: drafts use templates.' : 'When the month’s spend hits the cap, drafts fall back to templates.'}</p>
      <PendingButton variant="secondary" size="sm" className="justify-self-start">Save cap</PendingButton>
    </ActionForm>
  );
}

/** SPF / DKIM / DMARC for the sending domain, plus a re-check. */
export function DeliverabilityCard({ dns }: { dns: OpsData['health']['dns'] }) {
  return (
    <div className="grid gap-3">
      {dns?.domain ? (
        <>
          <p className="text-sm text-chalk/70">Domain <span className="font-mono text-chalk">{dns.domain}</span> · checked {dateTime(dns.checkedAt)}</p>
          <ul className="grid gap-2">
            {dns.checks.map((check) => (
              <li key={check.key} className="flex flex-wrap items-center gap-2 border-b border-line pb-2 text-sm last:border-b-0">
                <Badge tone={check.state === 'pass' ? 'good' : check.state === 'warn' ? 'warn' : 'bad'}>{check.label}</Badge>
                <span className="min-w-0 flex-1 text-chalk/70">{check.detail}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-sm text-steel">Add a sender email in Sending rules, then run the check.</p>
      )}
      <ActionForm action={checkSenderDnsAction} aria-label="Check DNS">
        <PendingButton variant="secondary" size="sm">Check DNS now</PendingButton>
      </ActionForm>
      <p className="text-xs text-steel">Complaint rate needs Resend webhooks; until then it shows as unknown.</p>
    </div>
  );
}

/** 10DLC registration packet: answers the carrier form asks for. */
export function TendlcCard({ tendlc }: { tendlc: OpsData['tendlc'] }) {
  const { profile, issues, packet } = tendlc;
  const field = (name: 'legalName' | 'ein' | 'street' | 'city' | 'state' | 'postalCode' | 'contactName' | 'contactEmail' | 'contactPhone' | 'privacyUrl' | 'termsUrl', label: string) => (
    <label htmlFor={`tendlc-${name}`}><span className={labelClass}>{label}</span>
      <input id={`tendlc-${name}`} name={name} defaultValue={profile[name]} maxLength={200} className={fieldClass} />
    </label>
  );

  return (
    <div className="grid gap-4">
      {issues.length > 0 && (
        <ul className="grid gap-1 rounded-sm border border-amber-400/40 bg-amber-400/[0.07] p-3 text-sm text-amber-200">
          {issues.slice(0, 8).map((issue) => <li key={`${issue.field}-${issue.message}`}>{issue.message}</li>)}
        </ul>
      )}
      <ActionForm action={saveTendlcAction} className="grid gap-3" aria-label="10DLC packet">
        <div className="grid gap-3 sm:grid-cols-2">
          {field('legalName', 'Legal name')}
          <label htmlFor="tendlc-businessType"><span className={labelClass}>Business type</span>
            <select id="tendlc-businessType" name="businessType" defaultValue={profile.businessType} className={fieldClass}>
              {BUSINESS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          {field('ein', 'EIN')}
          <label htmlFor="tendlc-useCase"><span className={labelClass}>Use case</span>
            <select id="tendlc-useCase" name="useCase" defaultValue={profile.useCase} className={fieldClass}>
              {TENDLC_USE_CASES.map((u) => <option key={u} value={u}>{TENDLC_USE_CASE_LABEL[u]}</option>)}
            </select>
          </label>
          {field('street', 'Street')}
          {field('city', 'City')}
          {field('state', 'State')}
          {field('postalCode', 'ZIP')}
          {field('contactName', 'Contact name')}
          {field('contactEmail', 'Contact email')}
          {field('contactPhone', 'Contact phone')}
          {field('privacyUrl', 'Privacy URL')}
          {field('termsUrl', 'SMS terms URL')}
        </div>
        <label htmlFor="tendlc-description"><span className={labelClass}>Campaign description</span>
          <textarea id="tendlc-description" name="description" rows={3} defaultValue={profile.description} className={`${fieldClass} h-auto py-2`} />
        </label>
        <label htmlFor="tendlc-messageFlow"><span className={labelClass}>Opt-in flow</span>
          <textarea id="tendlc-messageFlow" name="messageFlow" rows={3} defaultValue={profile.messageFlow} className={`${fieldClass} h-auto py-2`} />
        </label>
        <label htmlFor="tendlc-helpMessage"><span className={labelClass}>HELP reply</span>
          <input id="tendlc-helpMessage" name="helpMessage" defaultValue={profile.helpMessage} maxLength={320} className={fieldClass} />
        </label>
        <label htmlFor="tendlc-optOutMessage"><span className={labelClass}>STOP reply</span>
          <input id="tendlc-optOutMessage" name="optOutMessage" defaultValue={profile.optOutMessage} maxLength={320} className={fieldClass} />
        </label>
        <label htmlFor="tendlc-samples"><span className={labelClass}>Sample messages (one per line)</span>
          <textarea id="tendlc-samples" name="samples" rows={5} defaultValue={profile.samples.join('\n')} className={`${fieldClass} h-auto py-2`} />
        </label>
        <p className="text-xs text-steel">Samples must match the use case and show “Reply STOP to opt out”.</p>
        <div className="flex flex-wrap items-center gap-2">
          <PendingButton size="sm">Save packet</PendingButton>
          <CopyButton value={packet} label="Copy packet" />
        </div>
      </ActionForm>
      <p className="text-xs text-steel">Needs owner: submit this in the Twilio console with the LLC’s EIN. Carrier fees apply.</p>
    </div>
  );
}

/** Token expiry, cron freshness and DNS problems in one list. */
export function HealthCard({ health }: { health: OpsData['health'] }) {
  return (
    <div className="grid gap-3">
      <p className="text-sm text-chalk/70">{health.lastCronAt ? `Last marketing cron ran ${dateTime(health.lastCronAt)}.` : 'The marketing cron has not run yet.'}</p>
      <ul className="grid gap-2">
        {health.alerts.map((alert) => (
          <li key={alert.key} className="flex flex-wrap items-center gap-2 border-b border-line pb-2 text-sm last:border-b-0">
            <Badge tone={alert.severity === 'bad' ? 'bad' : 'warn'}>{alert.title}</Badge>
            {alert.detail && <span className="min-w-0 flex-1 text-chalk/70">{alert.detail}</span>}
          </li>
        ))}
        {health.alerts.length === 0 && <li className="text-sm text-steel">Everything connected is healthy.</li>}
      </ul>
      <Link href="/admin/marketing/content/connections" className="text-sm font-semibold text-clover hover:underline">Open connections</Link>
    </div>
  );
}

/** Launch, weekly and monthly ops checklists with persisted ticks. */
export function ChecklistsCard({ ticks }: { ticks: OpsData['ticks'] }) {
  return (
    <div className="grid gap-5">
      {CHECKLISTS.map((list) => {
        const done = ticks[list.kind] ?? [];
        return (
          <section key={list.kind} aria-labelledby={`cl-${list.kind}`}>
            <header className="mb-2 flex items-baseline justify-between gap-2">
              <h3 id={`cl-${list.kind}`} className="text-xs font-bold uppercase tracking-widest text-steel">{list.title}</h3>
              <p className="text-xs text-steel">{done.length}/{list.items.length} · {list.cadence}</p>
            </header>
            <ul className="grid gap-1.5">
              {list.items.map((item) => {
                const isDone = done.includes(item.id);
                return (
                  <li key={item.id} className="flex items-center gap-2 text-sm">
                    <ActionForm action={toggleChecklistAction} feedback="none" aria-label={item.label}>
                      <input type="hidden" name="checklist" value={list.kind} />
                      <input type="hidden" name="item" value={item.id} />
                      <input type="hidden" name="done" value={isDone ? 'true' : 'false'} />
                      <PendingButton variant="ghost" size="sm">{isDone ? '✓' : '○'}</PendingButton>
                    </ActionForm>
                    <span className={isDone ? 'text-steel line-through' : 'text-chalk/85'}>
                      {item.href ? <Link href={item.href} className="hover:text-clover">{item.label}</Link> : item.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** Saved wording that trips the claims, review-policy or Reg Z rules. */
export function PolicyScanCard({ items }: { items: OpsData['policy'] }) {
  if (items.length === 0) return <p className="text-sm text-steel">Every saved template, automation and campaign step passes.</p>;
  return (
    <ul className="grid gap-2">
      {items.map((item) => (
        <li key={item.id} className="border-b border-line pb-2 text-sm last:border-b-0">
          <p className="flex flex-wrap items-center gap-2">
            <Badge tone={item.report.status === 'block' ? 'bad' : 'warn'}>{item.report.status === 'block' ? 'Fix' : 'Check'}</Badge>
            <Link href={item.href} className="font-semibold hover:text-clover">{item.label}</Link>
            <span className="text-xs text-steel">{item.kind}</span>
          </p>
          <ul className="mt-1 grid gap-0.5 text-xs text-chalk/65">
            {item.report.issues.slice(0, 3).map((issue, index) => <li key={`${item.id}-${index}`}>{issue.reason}</li>)}
          </ul>
        </li>
      ))}
    </ul>
  );
}

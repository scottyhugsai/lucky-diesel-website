import Link from 'next/link';
import { acknowledgeAnomaly, createReportFeed, revokeReportFeed, runDigestNow, saveBudget, saveGoal, saveTrackingNumber } from './actions';
import { CohortCard, LtvCard, ProfitTable, RetentionCard, SpeedCard } from '@/components/admin/marketing/core-ui/ReportPanels';
import { currentMonth, loadReports } from '@/components/admin/marketing/core-ui/reports-data';
import { MarketingSectionTabs } from '@/components/admin/marketing/core-ui/MarketingNav';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import { Badge, Card, EmptyState, PageHeader, fieldClass, labelClass } from '@/components/app/ui';
import { requireRole } from '@/lib/auth';
import { dateTime, money } from '@/lib/format';
import { ATTRIBUTION_MODELS, type AttributionModel } from '@/lib/marketing/core/analytics-math';
import { BUDGET_CHANNELS, GOAL_METRICS } from '@/lib/marketing/core/analytics-reports';

export const metadata = { title: 'Reports | Marketing' };

const CALL_SOURCES = ['google', 'facebook', 'instagram', 'tiktok', 'bing', 'youtube', 'referral', 'email', 'sms', 'direct', 'other'] as const;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Channel keys are lower-case; show them capitalised. */
function channelLabel(channel: string): string {
  return channel.charAt(0).toUpperCase() + channel.slice(1);
}

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function modelFrom(raw: string | undefined): AttributionModel {
  return ATTRIBUTION_MODELS.some((m) => m.value === raw) ? (raw as AttributionModel) : 'last';
}

/** Attribution model picker. Keeps the month, changes the credit split. */
function ModelPicker({ model, month }: { model: AttributionModel; month: string }) {
  return (
    <div role="group" aria-label="Attribution model" className="inline-flex flex-wrap gap-0.5 rounded-sm border border-line bg-carbon p-0.5">
      {ATTRIBUTION_MODELS.map((m) => (
        <Link
          key={m.value}
          href={`/admin/marketing/reports?model=${m.value}&month=${month}`}
          scroll={false}
          title={m.hint}
          aria-current={model === m.value ? 'true' : undefined}
          className={`inline-flex h-8 items-center rounded-sm px-2.5 text-xs font-bold uppercase tracking-widest transition-colors ${
            model === m.value ? 'bg-clover text-carbon' : 'text-steel hover:text-chalk'
          }`}
        >
          {m.label}
        </Link>
      ))}
    </div>
  );
}

export default async function MarketingReportsPage({ searchParams }: { searchParams: Promise<{ model?: string | string[]; month?: string | string[] }> }) {
  await requireRole('admin');
  const params = await searchParams;
  const model = modelFrom(one(params.model));
  const rawMonth = one(params.month);
  const month = rawMonth && MONTH_RE.test(rawMonth) ? rawMonth : currentMonth();
  const data = await loadReports(model, month);
  const exports: { kind: string; label: string }[] = [
    { kind: 'funnel', label: 'Funnel by source' },
    { kind: 'daily', label: 'Daily series' },
    { kind: 'campaigns', label: 'Campaign results' },
  ];

  return (
    <>
      <MarketingSectionTabs active="/admin/marketing/reports" />
      <PageHeader
        kicker="Marketing"
        title="Reports"
        description="Last 90 days by source, plus this month against plan."
        actions={<ModelPicker model={model} month={month} />}
      />

      {data.funnelError && <p role="alert" className="mb-4 text-sm text-danger">Funnel unavailable: {data.funnelError}</p>}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
        <Card title="Profit by source" padded={false} className="min-w-0">
          {data.funnel && data.funnel.rows.length ? <ProfitTable rows={data.funnel.rows} /> : <EmptyState title="Nothing attributed yet">Leads with a source will show up here.</EmptyState>}
        </Card>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
          <LtvCard rows={data.ltv} />
          <SpeedCard report={data.speed} />
          <RetentionCard report={data.retention} reminders={data.reminders} />
          <CohortCard rows={data.cohorts} />
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
          <Card title={`Goals · ${month}`}>
            {data.goalProgress.length > 0 && (
              <ul className="mb-4 grid gap-2">
                {data.goalProgress.map((g) => (
                  <li key={g.metric} className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold">{g.label}</span>
                    <span className="flex items-center gap-2 text-chalk/70">
                      <span className="font-mono tabular-nums">{Math.round(g.ratio * 100)}%</span>
                      <Badge tone={g.onPace ? 'good' : 'warn'}>{g.onPace ? 'On pace' : 'Behind'}</Badge>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <ActionForm action={saveGoal} className="grid gap-3" aria-label="Save goal">
              <input type="hidden" name="month" value={month} />
              <label><span className={labelClass}>Metric</span>
                <select name="metric" className={fieldClass} defaultValue={GOAL_METRICS[0].value}>
                  {GOAL_METRICS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
              </label>
              <label><span className={labelClass}>Target</span>
                <input name="target" inputMode="decimal" className={fieldClass} placeholder="40" />
              </label>
              <p className="text-xs text-steel">Dollars for revenue and cost per lead. Zero clears it.</p>
              <PendingButton size="sm" className="justify-self-start">Save target</PendingButton>
            </ActionForm>
          </Card>

          <Card title={`Budget plan · ${month}`}>
            <ul className="mb-4 grid gap-2 text-sm">
              {data.budget.rows.map((row) => (
                <li key={row.channel} className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{channelLabel(row.channel)}</span>
                  <span className="text-chalk/70">
                    <span className="font-mono tabular-nums">{money(row.actualCents, { whole: true })}</span>
                    <span className="text-steel"> of {money(row.budgetCents, { whole: true })}</span>
                    {row.pace !== null && <Badge tone={row.pace > 1.1 ? 'warn' : 'neutral'}>{Math.round(row.pace * 100)}% pace</Badge>}
                  </span>
                </li>
              ))}
              {data.budget.rows.length === 0 && <li className="text-steel">No budgets set.</li>}
            </ul>
            <ActionForm action={saveBudget} className="grid gap-3" aria-label="Save budget">
              <input type="hidden" name="month" value={month} />
              <label><span className={labelClass}>Channel</span>
                <select name="channel" className={fieldClass} defaultValue={BUDGET_CHANNELS[0]}>
                  {BUDGET_CHANNELS.map((c) => <option key={c} value={c}>{channelLabel(c)}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label><span className={labelClass}>Budget $</span><input name="budget" inputMode="decimal" className={fieldClass} placeholder="600" /></label>
                <label><span className={labelClass}>Logged spend $</span><input name="manual" inputMode="decimal" className={fieldClass} placeholder="0" /></label>
              </div>
              <PendingButton size="sm" className="justify-self-start">Save budget</PendingButton>
            </ActionForm>
          </Card>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
          <Card title="Weekly digest">
            <ActionForm action={runDigestNow} className="mb-3" aria-label="Run digest">
              <PendingButton variant="secondary" size="sm">Build this week’s digest</PendingButton>
            </ActionForm>
            <ol id="digest" className="grid gap-3">
              {data.digests.map((d) => (
                <li key={d.id} className="border-b border-line pb-3 last:border-b-0">
                  <p className="text-xs font-semibold uppercase tracking-widest text-steel">Week of {d.week_start}</p>
                  <p className="mt-1 whitespace-pre-line text-sm text-chalk/85">{d.body}</p>
                  <p className="mt-1 text-xs text-steel">{d.sent_count ? `Emailed (${d.sent_count})` : d.send_detail ?? 'Not emailed yet'}</p>
                </li>
              ))}
              {data.digests.length === 0 && <li className="text-sm text-steel">No digests yet. Mondays build one automatically.</li>}
            </ol>
          </Card>

          <Card title="Anomalies">
            <ul className="grid gap-2">
              {data.anomalies.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-2 border-b border-line pb-2 text-sm last:border-b-0">
                  <Badge tone={a.direction === 'down' ? 'bad' : 'info'}>{a.metric}</Badge>
                  <span className="min-w-0 flex-1 text-chalk/80">{a.message}</span>
                  <time className="text-xs text-steel" dateTime={a.created_at}>{dateTime(a.created_at)}</time>
                  {a.acknowledged_at ? <span className="text-xs text-steel">Seen</span> : (
                    <ActionForm action={acknowledgeAnomaly} feedback="none" aria-label="Acknowledge">
                      <input type="hidden" name="id" value={a.id} />
                      <PendingButton variant="ghost" size="sm">Got it</PendingButton>
                    </ActionForm>
                  )}
                </li>
              ))}
              {data.anomalies.length === 0 && <li className="text-sm text-steel">Nothing unusual.</li>}
            </ul>
          </Card>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
          <Card title="Calls by source">
            <ul className="mb-4 grid gap-2 text-sm">
              {data.calls.map((row) => (
                <li key={row.source} className="flex justify-between gap-3">
                  <span className="font-semibold">{row.label || row.source}</span>
                  <span className="font-mono tabular-nums text-chalk/75">{row.calls} calls · {row.missed} missed · {row.textedBack} texted back</span>
                </li>
              ))}
              {data.calls.length === 0 && <li className="text-steel">No tracked calls yet.</li>}
            </ul>
            <ul className="mb-3 grid gap-1 text-xs text-steel">
              {data.numbers.map((n) => <li key={n.id}>{n.phone} → {n.source}{n.label ? ` · ${n.label}` : ''}</li>)}
            </ul>
            <ActionForm action={saveTrackingNumber} resetOnSuccess className="grid gap-3" aria-label="Add tracking number">
              <div className="grid grid-cols-2 gap-2">
                <label><span className={labelClass}>Number</span><input name="phone" inputMode="tel" className={fieldClass} placeholder="(843) 555-0100" /></label>
                <label><span className={labelClass}>Source</span>
                  <select name="source" className={fieldClass} defaultValue="google">
                    {CALL_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
              </div>
              <label><span className={labelClass}>Label</span><input name="label" maxLength={60} className={fieldClass} placeholder="Google Business Profile" /></label>
              <p className="text-xs text-steel">Twilio numbers route calls; until then this records what you use elsewhere.</p>
              <PendingButton size="sm" className="justify-self-start">Add number</PendingButton>
            </ActionForm>
          </Card>

          <Card title="Exports">
            <ul className="mb-4 grid gap-2 text-sm">
              {exports.map((e) => (
                <li key={e.kind}>
                  <a href={`/admin/marketing/reports/export?kind=${e.kind}&model=${model}&days=90`} className="font-semibold text-clover hover:underline">{e.label} (CSV)</a>
                </li>
              ))}
            </ul>
            <ActionForm action={createReportFeed} className="grid gap-3" aria-label="Create feed link">
              <label><span className={labelClass}>Feed label</span><input name="label" maxLength={60} className={fieldClass} placeholder="Looker Studio" /></label>
              <p className="text-xs text-steel">Creates a read-only CSV URL. The token shows once.</p>
              <PendingButton variant="secondary" size="sm" className="justify-self-start">Create feed link</PendingButton>
            </ActionForm>
            <ul className="mt-3 grid gap-2 text-sm">
              {data.feeds.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate">{f.label}{f.revoked_at ? ' · revoked' : ''}</span>
                  {!f.revoked_at && (
                    <ActionForm action={revokeReportFeed} feedback="none" aria-label="Revoke feed">
                      <input type="hidden" name="id" value={f.id} />
                      <PendingButton variant="ghost" size="sm">Revoke</PendingButton>
                    </ActionForm>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}

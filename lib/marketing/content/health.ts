/**
 * Integration health rules: turns connection rows, sender DNS records and the
 * last cron run into owner-facing alerts. Pure; the service stores and sends.
 */

export type AlertSeverity = 'warn' | 'bad';

export interface HealthAlert {
  key: string;
  severity: AlertSeverity;
  title: string;
  detail: string | null;
}

export interface ConnectionRow {
  platform: string;
  status: string;
  account_name: string | null;
  token_expires_at: string | null;
  last_error: string | null;
}

export const RULES = {
  /** Tokens inside this window need a reconnect soon. */
  tokenWarnDays: 7,
  /** A cron gap this long means scheduled sends are not running. */
  cronStaleHours: 36,
  /** Re-run DNS lookups when the cache is older than this. */
  dnsMaxAgeHours: 24,
  /** Gmail/Yahoo bulk-sender threshold. */
  complaintRateWarn: 0.001,
  complaintRateBad: 0.003,
} as const;

const HOUR = 3_600_000;

function label(platform: string): string {
  return platform.replace(/_/g, ' ');
}

function daysUntil(iso: string, now: Date): number {
  return Math.floor((new Date(iso).getTime() - now.getTime()) / 86_400_000);
}

/** Expired, erroring or soon-to-expire channel connections. */
export function connectionAlerts(rows: readonly ConnectionRow[], now = new Date()): HealthAlert[] {
  const alerts: HealthAlert[] = [];
  for (const row of rows) {
    const name = row.account_name ? `${label(row.platform)} · ${row.account_name}` : label(row.platform);
    if (row.status === 'expired' || row.status === 'revoked') {
      alerts.push({ key: `conn:${row.platform}`, severity: 'bad', title: `${name} needs reconnecting`, detail: `Status: ${row.status}.` });
      continue;
    }
    if (row.status === 'error') {
      alerts.push({ key: `conn:${row.platform}`, severity: 'bad', title: `${name} is erroring`, detail: row.last_error?.slice(0, 200) ?? null });
      continue;
    }
    if (row.status !== 'connected') continue;
    if (row.last_error) alerts.push({ key: `conn:${row.platform}`, severity: 'warn', title: `${name} last call failed`, detail: row.last_error.slice(0, 200) });
    if (!row.token_expires_at) continue;
    const days = daysUntil(row.token_expires_at, now);
    if (days < 0) alerts.push({ key: `token:${row.platform}`, severity: 'bad', title: `${name} token expired`, detail: 'Reconnect the account.' });
    else if (days <= RULES.tokenWarnDays) alerts.push({ key: `token:${row.platform}`, severity: 'warn', title: `${name} token expires in ${days}d`, detail: 'Reconnect before it lapses.' });
  }
  return alerts;
}

export interface DnsCheck {
  key: string;
  label: string;
  state: 'pass' | 'warn' | 'missing';
  detail: string;
}

/** SPF / DKIM / DMARC gaps on the sending domain (bulk-sender rules). */
export function dnsAlerts(domain: string | null, checks: readonly DnsCheck[]): HealthAlert[] {
  if (!domain) return [{ key: 'dns:sender', severity: 'warn', title: 'No sending domain set', detail: 'Add a sender email in Sending rules.' }];
  return checks
    .filter((c) => c.state !== 'pass')
    .map((c) => ({
      key: `dns:${c.key}`,
      severity: (c.state === 'missing' && c.key !== 'dmarc' ? 'bad' : 'warn') as AlertSeverity,
      title: `${c.label} ${c.state === 'missing' ? 'missing' : 'needs work'} on ${domain}`,
      detail: c.detail,
    }));
}

/** Nothing scheduled has run for too long. */
export function cronAlerts(lastRunAt: string | null, now = new Date()): HealthAlert[] {
  if (!lastRunAt) return [{ key: 'cron:marketing', severity: 'warn', title: 'Marketing cron has never run', detail: 'Deploy with the cron enabled, or run it once by hand.' }];
  const hours = Math.floor((now.getTime() - new Date(lastRunAt).getTime()) / HOUR);
  if (hours < RULES.cronStaleHours) return [];
  return [{ key: 'cron:marketing', severity: 'bad', title: `Marketing cron last ran ${hours}h ago`, detail: 'Scheduled sends and refreshes are stalled.' }];
}

/** Gmail/Yahoo want complaints under 0.1%. Needs Resend webhooks for real numbers. */
export function complaintAlerts(complaints: number, delivered: number): HealthAlert[] {
  if (delivered < 500) return [];
  const rate = complaints / delivered;
  if (rate < RULES.complaintRateWarn) return [];
  const pct = `${(rate * 100).toFixed(2)}%`;
  return [{
    key: 'email:complaints',
    severity: rate >= RULES.complaintRateBad ? 'bad' : 'warn',
    title: `Spam complaints at ${pct}`,
    detail: 'Keep it under 0.10%: send less often, and only to people who opted in.',
  }];
}

export function worstSeverity(alerts: readonly HealthAlert[]): AlertSeverity | null {
  if (alerts.some((a) => a.severity === 'bad')) return 'bad';
  return alerts.length ? 'warn' : null;
}

/** Stale enough to look up DNS again? */
export function dnsCacheStale(checkedAt: string | null | undefined, now = new Date()): boolean {
  if (!checkedAt) return true;
  return now.getTime() - new Date(checkedAt).getTime() > RULES.dnsMaxAgeHours * HOUR;
}

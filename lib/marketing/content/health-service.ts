import 'server-only';
import { checkSenderAuth } from '@/lib/marketing/core/email-auth';
import { ownerContact, sendContentMessage } from './alerts';
import { adminDb, toJson, type Db } from './db';
import { complaintAlerts, connectionAlerts, cronAlerts, dnsAlerts, dnsCacheStale, worstSeverity, type DnsCheck, type HealthAlert } from './health';

/**
 * Integration health: reads connections, the sender's DNS records and the last
 * cron run, stores open alerts in `ops_alerts` and emails the owner once a day
 * while anything is broken.
 */

const ALERT_COOLDOWN_MS = 24 * 3_600_000;

export interface SenderDnsCache {
  domain: string | null;
  checks: DnsCheck[];
  checkedAt: string;
}

function readDnsCache(stored: unknown): SenderDnsCache | null {
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return null;
  const raw = stored as Record<string, unknown>;
  if (typeof raw.checkedAt !== 'string' || !Array.isArray(raw.checks)) return null;
  return { domain: typeof raw.domain === 'string' ? raw.domain : null, checks: raw.checks as DnsCheck[], checkedAt: raw.checkedAt };
}

/** Live DNS lookup for the configured sender email, cached on marketing_settings. */
export async function refreshSenderDns(db: Db = adminDb()): Promise<SenderDnsCache> {
  const { data } = await db.from('marketing_settings').select('sender_email').eq('id', 1).maybeSingle();
  const report = await checkSenderAuth(data?.sender_email);
  const cache: SenderDnsCache = { domain: report.domain, checks: report.checks as DnsCheck[], checkedAt: report.checkedAt };
  await db.from('marketing_settings').update({ sender_dns_check: toJson(cache) }).eq('id', 1);
  return cache;
}

async function senderDns(db: Db, now: Date, force: boolean): Promise<SenderDnsCache | null> {
  const { data } = await db.from('marketing_settings').select('sender_dns_check').eq('id', 1).maybeSingle();
  const cache = readDnsCache(data?.sender_dns_check);
  if (!force && cache && !dnsCacheStale(cache.checkedAt, now)) return cache;
  try {
    return await refreshSenderDns(db);
  } catch (caught) {
    console.error(`[marketing/health] DNS check failed: ${caught instanceof Error ? caught.message : String(caught)}`);
    return cache;
  }
}

export interface HealthSnapshot {
  alerts: HealthAlert[];
  dns: SenderDnsCache | null;
  lastCronAt: string | null;
  complaints: { delivered: number; complaints: number } | null;
}

/** Everything the connections page shows. Read-only. */
export async function loadHealth(db: Db = adminDb(), now = new Date()): Promise<HealthSnapshot> {
  const [{ data: connections }, { data: run }, { data: settings }] = await Promise.all([
    db.from('channel_connections').select('platform, status, account_name, token_expires_at, last_error').order('platform'),
    db.from('ops_cron_runs').select('started_at').eq('job', 'marketing').order('started_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('marketing_settings').select('sender_dns_check').eq('id', 1).maybeSingle(),
  ]);
  const dns = readDnsCache(settings?.sender_dns_check);
  const lastCronAt = run?.started_at ?? null;
  return {
    alerts: [...connectionAlerts(connections ?? [], now), ...dnsAlerts(dns?.domain ?? null, dns?.checks ?? []), ...cronAlerts(lastCronAt, now)],
    dns,
    lastCronAt,
    complaints: null,
  };
}

export interface HealthRunReport {
  open: number;
  resolved: number;
  notified: boolean;
}

/** The cron step: re-check everything, store alerts, tell the owner once a day. */
export async function runIntegrationHealth(db: Db = adminDb(), now = new Date()): Promise<HealthRunReport> {
  const [{ data: connections }, { data: run }, dns] = await Promise.all([
    db.from('channel_connections').select('platform, status, account_name, token_expires_at, last_error').order('platform'),
    db.from('ops_cron_runs').select('started_at').eq('job', 'marketing').lt('started_at', now.toISOString()).order('started_at', { ascending: false }).limit(1).maybeSingle(),
    senderDns(db, now, false),
  ]);
  const alerts = [
    ...connectionAlerts(connections ?? [], now),
    ...dnsAlerts(dns?.domain ?? null, dns?.checks ?? []),
    ...cronAlerts(run?.started_at ?? null, now),
    // Complaint rate needs Resend webhook data; the rule is ready for it.
    ...complaintAlerts(0, 0),
  ];
  const iso = now.toISOString();
  for (const alert of alerts) {
    await db.from('ops_alerts').upsert(
      { key: alert.key, severity: alert.severity, title: alert.title, detail: alert.detail, last_seen_at: iso, resolved_at: null },
      { onConflict: 'key' },
    );
  }

  const keys = alerts.map((a) => a.key);
  const { data: stale } = await db.from('ops_alerts').select('key').is('resolved_at', null);
  const gone = (stale ?? []).map((r) => r.key).filter((key) => !keys.includes(key));
  if (gone.length) await db.from('ops_alerts').update({ resolved_at: iso }).in('key', gone);

  const notified = await notifyOwner(db, alerts, now);
  return { open: alerts.length, resolved: gone.length, notified };
}

async function notifyOwner(db: Db, alerts: readonly HealthAlert[], now: Date): Promise<boolean> {
  if (worstSeverity(alerts) !== 'bad') return false;
  const bad = alerts.filter((a) => a.severity === 'bad');
  const { data: recent } = await db.from('ops_alerts').select('last_alerted_at').in('key', bad.map((a) => a.key)).not('last_alerted_at', 'is', null).order('last_alerted_at', { ascending: false }).limit(1).maybeSingle();
  if (recent?.last_alerted_at && now.getTime() - new Date(recent.last_alerted_at).getTime() < ALERT_COOLDOWN_MS) return false;
  const headline = bad.length === 1 ? bad[0].title : `${bad.length} marketing integrations need attention`;
  await sendContentMessage(db, 'content_anomaly_alert', await ownerContact(db), { alert: `${headline}. ${bad.map((a) => `• ${a.title}`).join(' ')}`.slice(0, 600) });
  await db.from('ops_alerts').update({ last_alerted_at: now.toISOString() }).in('key', bad.map((a) => a.key));
  return true;
}

/** Wraps a cron job so the last run (and its errors) is visible in the app. */
export async function recordCronRun(job: 'marketing' | 'automations' | 'content', started: Date, ok: boolean, errors: readonly string[], db: Db = adminDb()): Promise<void> {
  const { error } = await db.from('ops_cron_runs').insert({ job, started_at: started.toISOString(), finished_at: new Date().toISOString(), ok, errors: toJson(errors.slice(0, 20)) });
  if (error) console.error(`[marketing/health] could not log the cron run: ${error.message}`);
}

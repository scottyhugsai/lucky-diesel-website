import { describe, expect, it } from 'vitest';
import { complaintAlerts, connectionAlerts, cronAlerts, dnsAlerts, dnsCacheStale, worstSeverity } from './health';

const NOW = new Date('2026-03-10T12:00:00Z');
const base = { platform: 'meta_ads', status: 'connected', account_name: 'Lucky Diesel', token_expires_at: null, last_error: null };

describe('connectionAlerts', () => {
  it('stays quiet for a healthy connection', () => {
    expect(connectionAlerts([base], NOW)).toEqual([]);
  });

  it('flags expired and erroring accounts as bad', () => {
    const alerts = connectionAlerts([{ ...base, status: 'expired' }, { ...base, platform: 'gbp', status: 'error', last_error: 'invalid grant' }], NOW);
    expect(alerts.map((a) => a.severity)).toEqual(['bad', 'bad']);
    expect(alerts[1].detail).toBe('invalid grant');
  });

  it('warns a week before a token expires and fails after', () => {
    const soon = connectionAlerts([{ ...base, token_expires_at: '2026-03-14T12:00:00Z' }], NOW);
    expect(soon[0]).toMatchObject({ key: 'token:meta_ads', severity: 'warn' });
    const gone = connectionAlerts([{ ...base, token_expires_at: '2026-03-01T12:00:00Z' }], NOW);
    expect(gone[0].severity).toBe('bad');
  });
});

describe('dnsAlerts', () => {
  it('asks for a sender when there is no domain', () => {
    expect(dnsAlerts(null, [])[0].key).toBe('dns:sender');
  });

  it('treats a missing SPF as bad and a p=none DMARC as a warning', () => {
    const alerts = dnsAlerts('luckydiesel.com', [
      { key: 'spf', label: 'SPF', state: 'missing', detail: 'Add it.' },
      { key: 'dkim', label: 'DKIM', state: 'pass', detail: 'Found.' },
      { key: 'dmarc', label: 'DMARC', state: 'warn', detail: 'Monitoring only.' },
    ]);
    expect(alerts.map((a) => [a.key, a.severity])).toEqual([['dns:spf', 'bad'], ['dns:dmarc', 'warn']]);
  });
});

describe('cronAlerts', () => {
  it('warns when it has never run and fails when stale', () => {
    expect(cronAlerts(null, NOW)[0].severity).toBe('warn');
    expect(cronAlerts('2026-03-10T09:00:00Z', NOW)).toEqual([]);
    expect(cronAlerts('2026-03-07T09:00:00Z', NOW)[0].severity).toBe('bad');
  });
});

describe('complaintAlerts', () => {
  it('ignores small volumes and grades the rate', () => {
    expect(complaintAlerts(5, 100)).toEqual([]);
    expect(complaintAlerts(1, 2000)).toEqual([]);
    expect(complaintAlerts(4, 2000)[0].severity).toBe('warn');
    expect(complaintAlerts(10, 2000)[0].severity).toBe('bad');
  });
});

describe('helpers', () => {
  it('picks the worst severity', () => {
    expect(worstSeverity([])).toBeNull();
    expect(worstSeverity([{ key: 'a', severity: 'warn', title: 'a', detail: null }])).toBe('warn');
    expect(worstSeverity([{ key: 'a', severity: 'warn', title: 'a', detail: null }, { key: 'b', severity: 'bad', title: 'b', detail: null }])).toBe('bad');
  });

  it('expires the DNS cache after a day', () => {
    expect(dnsCacheStale(null, NOW)).toBe(true);
    expect(dnsCacheStale('2026-03-10T06:00:00Z', NOW)).toBe(false);
    expect(dnsCacheStale('2026-03-08T06:00:00Z', NOW)).toBe(true);
  });
});

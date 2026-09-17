import { describe, expect, test } from 'vitest';
import { engagementPoints, withEngagement } from './engagement';
import { bookingLinkFor, classifyReplyIntent, describeHours, groupThreads, hasPrice, parseThreadKey, templateReply, threadKey, type InboxMessage } from './inbox';
import { isPipelineId, missingStageRows, parseDealValue } from './pipelines';
import { DEFAULT_CRM_RULES } from './speed';
import { buildTaskQueue, callScript, type TaskLead } from './tasks';
import { MIN_OUTCOMES, predictWin, trainWinModel, winLossReport, type OutcomeLead } from './win-model';

const now = new Date('2026-09-17T15:00:00Z');
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);

describe('pipelines', () => {
  test('creates only missing default stages', () => {
    expect(missingStageRows('builds', [])).toHaveLength(7);
    const rows = missingStageRows('leads', ['new', 'contacted', 'booked', 'won', 'lost']);
    expect(rows.map((r) => r.key)).toEqual(['quoted', 'in_shop']);
    expect(missingStageRows('fleet', []).find((r) => r.key === 'won')?.is_won).toBe(true);
    expect(isPipelineId('fleet')).toBe(true);
    expect(isPipelineId('drop table')).toBe(false);
  });

  test('parses deal values in dollars', () => {
    expect(parseDealValue('$2,500')).toBe(250_000);
    expect(parseDealValue('99.95')).toBe(9_995);
    expect(parseDealValue('')).toBe(0);
    expect(parseDealValue('-5')).toBeNull();
    expect(parseDealValue('12345678')).toBeNull();
  });
});

describe('inbox threads', () => {
  const m = (id: string, over: Partial<InboxMessage>): InboxMessage => ({
    id, channel: 'sms', direction: 'outbound', address: '(843) 555-0142', body: 'hi', subject: null, status: 'simulated', automationKey: null, customerId: null, createdAt: hoursAgo(1).toISOString(), ...over,
  });

  test('groups loosely formatted numbers and drops staff alerts', () => {
    const threads = groupThreads([
      m('1', { direction: 'inbound', address: '+18435550142', createdAt: hoursAgo(3).toISOString(), body: 'Is my truck ready?' }),
      m('2', { address: '843-555-0142', automationKey: 'inbox_reply', createdAt: hoursAgo(2).toISOString() }),
      m('3', { address: '(843) 555-0100', automationKey: 'lead_owner_alert' }),
    ], new Set(['+18435550100']));
    expect(threads).toHaveLength(1);
    expect(threads[0]!.key).toBe('sms:+18435550142');
    expect(threads[0]!.count).toBe(2);
    expect(threads[0]!.awaitingReply).toBe(false);
  });

  test('flags threads awaiting a reply', () => {
    const [thread] = groupThreads([m('1', { direction: 'inbound', address: '+18435550142' })], new Set());
    expect(thread!.awaitingReply).toBe(true);
  });

  test('skips automated-only threads with no customer', () => {
    expect(groupThreads([m('1', { automationKey: 'mkt_birthday' })], new Set())).toHaveLength(0);
  });

  test('thread keys round-trip and reject junk', () => {
    expect(parseThreadKey(threadKey('sms', '(843) 555-0142'))).toEqual({ channel: 'sms', address: '+18435550142' });
    expect(parseThreadKey('email:Cody@Example.com')).toEqual({ channel: 'email', address: 'cody@example.com' });
    expect(parseThreadKey('sms:abc')).toBeNull();
    expect(parseThreadKey('fax:123456789')).toBeNull();
  });
});

describe('reply assistant templates', () => {
  const facts = { firstName: 'Cody', bookingLink: 'https://x.test/book', shopPhone: '(843) 555-0100', jobStatus: 'In progress', hours: 'Mon–Fri 8am–5pm' };

  test('classifies common customer questions', () => {
    expect(classifyReplyIntent('How much for a tune on my L5P?')).toBe('price');
    expect(classifyReplyIntent('Is my truck ready yet?')).toBe('status');
    expect(classifyReplyIntent('Can I book for Tuesday')).toBe('booking');
    expect(classifyReplyIntent('thanks!')).toBe('thanks');
    expect(classifyReplyIntent('my truck smokes')).toBe('other');
  });

  test('never quotes a price', () => {
    for (const intent of ['price', 'booking', 'status', 'hours', 'thanks', 'other'] as const) {
      expect(hasPrice(templateReply(intent, facts))).toBe(false);
    }
    expect(templateReply('status', facts)).toContain('in progress');
    expect(hasPrice('A tune is $650')).toBe(true);
  });

  test('booking links carry truck and service only when valid', () => {
    expect(bookingLinkFor('https://x.test', { platform: 'duramax', service: 'tuning' })).toBe('https://x.test/book?platform=duramax&service=tuning');
    expect(bookingLinkFor('https://x.test', { platform: '"><script>', service: null })).toBe('https://x.test/book');
  });

  test('describes shop hours', () => {
    expect(describeHours([1, 2, 3, 4, 5], 8, 17)).toBe('Mon–Fri 8am–5pm');
    expect(describeHours([1, 3], 9, 12)).toBe('Mon, Wed 9am–12pm');
  });
});

describe('engagement signals', () => {
  test('adds capped points to open leads only', () => {
    expect(engagementPoints({ touches: 10, checkoutClicks: 5, inboundMessages: 5, campaignClicks: 5 })).toBe(20);
    expect(withEngagement(60, 'new', { touches: 2, checkoutClicks: 0, inboundMessages: 1, campaignClicks: 0 })).toBe(67);
    expect(withEngagement(95, 'contacted', { touches: 5, checkoutClicks: 0, inboundMessages: 0, campaignClicks: 0 })).toBe(100);
    expect(withEngagement(100, 'booked', { touches: 5, checkoutClicks: 0, inboundMessages: 0, campaignClicks: 0 })).toBe(100);
    expect(withEngagement(0, 'lost', { touches: 5, checkoutClicks: 0, inboundMessages: 0, campaignClicks: 0 })).toBe(0);
  });
});

describe('task queue', () => {
  const lead = (over: Partial<TaskLead>): TaskLead => ({
    id: 'l1', name: 'Cody Hart', phone: '8435550142', serviceId: 'tuning', serviceLabel: 'Performance tuning', platformLabel: 'Duramax', status: 'contacted', score: 30,
    createdAt: hoursAgo(100), contactedAt: hoursAgo(99), lastActivityAt: hoursAgo(1), snoozedUntil: null, assignedTo: null, dealValueCents: 0, ...over,
  });

  test('orders new leads first and skips snoozed or closed deals', () => {
    const tasks = buildTaskQueue({
      now, rules: DEFAULT_CRM_RULES, threads: [], quotes: [{ workOrderId: 'w1', number: 1042, name: 'Ray', expiresAt: hoursAgo(-24) }],
      leads: [
        lead({ id: 'stale', lastActivityAt: hoursAgo(72) }),
        lead({ id: 'fresh', status: 'new', contactedAt: null, createdAt: hoursAgo(0.5) }),
        lead({ id: 'snoozed', status: 'new', contactedAt: null, snoozedUntil: hoursAgo(-3) }),
        lead({ id: 'won', status: 'won' }),
        lead({ id: 'quiet', lastActivityAt: hoursAgo(2) }),
      ],
    });
    expect(tasks.map((t) => t.kind)).toEqual(['new_lead', 'quote_expiring', 'stale']);
    expect(tasks[0]!.detail).toBe('Waiting 30 min');
  });

  test('filters to the viewer and unassigned', () => {
    const tasks = buildTaskQueue({ now, rules: DEFAULT_CRM_RULES, threads: [], quotes: [], viewerId: 'me', leads: [lead({ id: 'a', status: 'new', contactedAt: null, assignedTo: 'other' }), lead({ id: 'b', status: 'new', contactedAt: null })] });
    expect(tasks.map((t) => t.leadId)).toEqual(['b']);
  });

  test('scripts never mention prices', () => {
    expect(callScript('new_lead', { name: 'Cody Hart', serviceId: 'turbo', serviceLabel: 'Turbocharger', platformLabel: 'Duramax' })).toMatch(/^Hey Cody/);
    expect(hasPrice(callScript('hot', { name: 'X', serviceId: null, serviceLabel: null, platformLabel: null }))).toBe(false);
  });
});

describe('win/loss', () => {
  const outcome = (status: string, source: string, over: Partial<OutcomeLead> = {}): OutcomeLead => ({
    status, source, serviceId: 'tuning', platform: 'duramax', lostReason: status === 'lost' ? 'Price' : null, stageName: null, dealValueCents: status === 'won' ? 100_000 : 0,
    createdAt: hoursAgo(10), contactedAt: hoursAgo(9.5), ...over,
  });

  test('reports win rate, value, response time and reasons', () => {
    const report = winLossReport([outcome('won', 'google'), outcome('lost', 'google'), outcome('won', 'referral'), outcome('new', 'google', { dealValueCents: 5000, contactedAt: null })], { service: (s) => s ?? '—', source: (s) => s });
    expect(report.winRate).toBeCloseTo(2 / 3);
    expect(report.wonValueCents).toBe(200_000);
    expect(report.openValueCents).toBe(5000);
    expect(report.medianFirstResponseMinutes).toBe(30);
    expect(report.lostReasons).toEqual([{ label: 'Price', count: 1 }]);
    expect(report.bySource[0]).toMatchObject({ label: 'google', won: 1, lost: 1, open: 1, winRate: 0.5 });
  });

  test('predictive score waits for enough outcomes, then favours winning sources', () => {
    expect(trainWinModel([outcome('won', 'referral')])).toBeNull();
    const history = [
      ...Array.from({ length: MIN_OUTCOMES / 2 }, () => outcome('won', 'referral')),
      ...Array.from({ length: MIN_OUTCOMES / 2 }, () => outcome('lost', 'facebook')),
    ];
    const model = trainWinModel(history);
    expect(model?.outcomes).toBe(MIN_OUTCOMES);
    expect(predictWin(model, { source: 'referral', serviceId: 'tuning', platform: 'duramax' })!).toBeGreaterThan(80);
    expect(predictWin(model, { source: 'facebook', serviceId: 'tuning', platform: 'duramax' })!).toBeLessThan(20);
    expect(predictWin(null, { source: 'x', serviceId: null, platform: null })).toBeNull();
  });
});

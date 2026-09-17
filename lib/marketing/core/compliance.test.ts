import { describe, expect, test } from 'vitest';
import { checkClaims, classifyInboundSms, ensureMarketingSms, marketingEmailFooter } from './compliance';

const rules = (text: string) => checkClaims(text).issues.map((i) => i.rule);

describe('checkClaims', () => {
  test.each([
    ['Full DPF delete kits in stock', 'emissions_delete'],
    ['EGR-delete + tune special', 'emissions_delete'],
    ['DEF delete available', 'emissions_delete'],
    ['We sell delete pipes', 'delete_kit'],
    ['4" race pipe for the 6.7', 'race_pipe'],
    ['straight piped and loud', 'race_pipe'],
    ['emissions off tune', 'emissions_off'],
    ['Turn off the regen for good', 'regen_off'],
    ['Why pay? SC has no emissions inspection', 'no_inspection'],
    ['Rolling coal package', 'rolling_coal'],
    ['defeat device install', 'defeat_device'],
    ['cat-less exhaust', 'cat_less'],
  ])('blocks tampering language: %s', (text, rule) => {
    const result = checkClaims(text);
    expect(result.risk).toBe('fail');
    expect(rules(text)).toContain(rule);
  });

  test('catches simple evasion spellings', () => {
    expect(checkClaims('dpf d3l3te special').risk).toBe('fail');
    expect(checkClaims('D.P.F. delete').risk).toBe('fail');
  });

  test('blocks "off-road only" when paired with tuning, warns when alone', () => {
    expect(rules('Off-road only tune file for the L5P')).toContain('race_only');
    const alone = checkClaims('Off-road use only.');
    expect(alone.risk).toBe('warn');
    expect(alone.issues.map((i) => i.rule)).toEqual(['off_road_only']);
  });

  test('does not double-report the generic "delete" inside a specific match', () => {
    expect(rules('DPF delete')).toEqual(['emissions_delete']);
  });

  test('warns on tuning, power and compliance claims with reasons', () => {
    const result = checkClaims('EZ-Lynk tune: +120 hp and EPA compliant');
    expect(result.risk).toBe('warn');
    expect(rules('EZ-Lynk tune: +120 hp and EPA compliant')).toEqual(['tuning_claim', 'power_gain', 'legal_claim']);
    expect(result.issues.every((i) => i.reason.length > 10)).toBe(true);
    expect(result.score).toBe(30);
  });

  test('passes ordinary service copy', () => {
    expect(checkClaims('Fuel filter service and a free brake check before towing season.')).toEqual({ risk: 'pass', score: 0, issues: [] });
  });

  test('scores cap at 100', () => {
    expect(checkClaims('dpf delete, egr delete, def delete, race pipe').score).toBe(100);
  });
});

describe('classifyInboundSms', () => {
  test.each([['STOP', 'stop'], [' stop ', 'stop'], ['Unsubscribe', 'stop'], ['stop all', 'stop'], ['START', 'start'], ['unstop', 'start'], ['HELP', 'help'], ['info', 'help']])('keyword %s', (body, intent) => {
    expect(classifyInboundSms(body)).toBe(intent);
  });

  test('treats plain-language opt-outs as STOP', () => {
    expect(classifyInboundSms('please stop texting me')).toBe('stop');
    expect(classifyInboundSms('Take me off your list')).toBe('stop');
    expect(classifyInboundSms('wrong number')).toBe('stop');
    expect(classifyInboundSms("don't message me again")).toBe('stop');
  });

  test('leaves normal replies alone', () => {
    expect(classifyInboundSms('C')).toBe('other');
    expect(classifyInboundSms('Can I come in Tuesday?')).toBe('other');
    expect(classifyInboundSms("Don't stop the turbo job, go ahead")).toBe('other');
  });
});

describe('marketing message requirements', () => {
  test('adds the business name and opt-out language only when missing', () => {
    expect(ensureMarketingSms('Towing check $99 this week', 'Lucky Diesel')).toBe('Lucky Diesel: Towing check $99 this week Reply STOP to opt out.');
    const ready = 'Lucky Diesel: towing check. Reply STOP to opt out.';
    expect(ensureMarketingSms(ready, 'Lucky Diesel')).toBe(ready);
  });

  test('email footer carries identity, address and unsubscribe link', () => {
    const footer = marketingEmailFooter({ senderName: 'Lucky Diesel', postalAddress: '1 Shop Rd, Charleston SC', unsubscribeUrl: 'https://x/u' });
    expect(footer).toContain('Lucky Diesel');
    expect(footer).toContain('1 Shop Rd');
    expect(footer).toContain('Unsubscribe: https://x/u');
  });
});

describe('shipped automation copy', () => {
  test('no default template fails the claims check', async () => {
    const { AUTOMATIONS } = await import('@/lib/automations/catalog');
    for (const a of AUTOMATIONS) {
      const text = [a.sms, a.emailSubject, a.emailBody].filter(Boolean).join('\n');
      expect(checkClaims(text).risk, a.key).not.toBe('fail');
    }
  });
});

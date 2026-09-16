import { describe, expect, test } from 'vitest';
import { renderTemplate, smsSegments, templatePlaceholders } from './template';

describe('renderTemplate', () => {
  test('fills placeholders, tolerating spaces and case', () => {
    expect(renderTemplate('Hi {{ first_name }}, WO #{{WORK_ORDER}} is {{status}}.', {
      first_name: 'Cody',
      work_order: 1042,
      status: 'ready',
    })).toBe('Hi Cody, WO #1042 is ready.');
  });

  test('renders missing values as empty and collapses the gap', () => {
    expect(renderTemplate('Hi {{first_name}} — your truck is ready.', {})).toBe('Hi — your truck is ready.');
  });

  test('leaves text without placeholders untouched', () => {
    expect(renderTemplate('Reply STOP to opt out.', { x: 1 })).toBe('Reply STOP to opt out.');
  });
});

describe('templatePlaceholders', () => {
  test('lists each placeholder once', () => {
    expect(templatePlaceholders('{{a}} {{b}} {{ a }}')).toEqual(['a', 'b']);
  });
});

describe('smsSegments', () => {
  test('counts GSM segments', () => {
    expect(smsSegments('x'.repeat(160))).toBe(1);
    expect(smsSegments('x'.repeat(161))).toBe(2);
  });

  test('counts unicode segments at the lower limit', () => {
    expect(smsSegments('🔧'.padEnd(71, 'x'))).toBe(2);
  });
});

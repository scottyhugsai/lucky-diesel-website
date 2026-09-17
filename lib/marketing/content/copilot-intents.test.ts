import { describe, expect, it } from 'vitest';
import { dollars, parseQuestion } from './copilot-intents';

describe('parseQuestion', () => {
  it('routes leads questions with a period', () => {
    expect(parseQuestion('How many leads this week?')).toMatchObject({ tools: ['leads'], days: 7, fallback: false });
  });

  it('routes ad cost questions to the ads tool', () => {
    expect(parseQuestion('What did ads cost per lead last month?')).toMatchObject({ tools: expect.arrayContaining(['ads']), days: 30 });
  });

  it('keeps social posts out of the ads tool', () => {
    expect(parseQuestion('How many facebook posts went out?').tools).toEqual(['social']);
  });

  it('does not treat AI spend as ad spend', () => {
    expect(parseQuestion('What is our AI spend?').tools).toEqual(['ai_spend']);
  });

  it('falls back to an overview for unknown questions', () => {
    expect(parseQuestion('How are we doing?')).toMatchObject({ fallback: true, days: 30 });
  });
});

describe('dollars', () => {
  it('formats cents', () => {
    expect(dollars(125_000)).toBe('$1,250');
    expect(dollars(2976)).toBe('$29.76');
  });
});

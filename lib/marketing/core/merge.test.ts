import { describe, expect, test } from 'vitest';
import { conditionFacts, evaluateCondition, renderConditionals } from './merge';

const cummins = conditionFacts({ platform: 'cummins', stage: 'vip', tier: 'stage_1' });
const duramax = conditionFacts({ platform: 'duramax', stage: 'customer' });

describe('evaluateCondition', () => {
  test('handles truthy, equality, lists and negation', () => {
    expect(evaluateCondition('vip', cummins)).toBe(true);
    expect(evaluateCondition('vip', duramax)).toBe(false);
    expect(evaluateCondition('platform=Cummins', cummins)).toBe(true);
    expect(evaluateCondition('platform=duramax|powerstroke', duramax)).toBe(true);
    expect(evaluateCondition('platform!=cummins', duramax)).toBe(true);
    expect(evaluateCondition('!vip', duramax)).toBe(true);
    expect(evaluateCondition('platform==x; drop', cummins)).toBe(false);
  });
});

describe('renderConditionals', () => {
  const template = 'Hi.\n{{#if platform=cummins}}6.7 owners: new injectors.{{else}}Fresh parts in.{{/if}}\n{{#if vip}}VIP early access.{{/if}}{{#unless vip}}Join the club.{{/unless}}';

  test('picks sections per recipient', () => {
    expect(renderConditionals(template, cummins)).toBe('Hi.\n6.7 owners: new injectors.\nVIP early access.');
    expect(renderConditionals(template, duramax)).toBe('Hi.\nFresh parts in.\nJoin the club.');
  });

  test('supports nesting and leaves plain text alone', () => {
    expect(renderConditionals('{{#if vip}}A{{#if platform=cummins}}B{{/if}}{{/if}}', cummins)).toBe('AB');
    expect(renderConditionals('No sections {{first_name}}', cummins)).toBe('No sections {{first_name}}');
  });
});

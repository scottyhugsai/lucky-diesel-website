import { describe, expect, test } from 'vitest';
import { blockRefs, parseBlocks, renderEmail, withHtmlFooter, type RenderContext } from './email-blocks';
import { conditionFacts } from './merge';

const ctx = (over: Partial<RenderContext> = {}): RenderContext => ({
  fill: (v) => v.replace('{{first_name}}', 'Cody'),
  facts: conditionFacts({ platform: 'cummins', stage: 'customer' }),
  siteUrl: 'https://luckydiesel.test',
  products: new Map([['fass-titanium', { title: 'FASS Titanium', priceCents: 89900, image: 'https://cdn.test/fass.jpg', url: 'https://luckydiesel.com/products/fass-titanium' }]]),
  builds: new Map([['l5p-stage-2', { title: 'L5P Stage 2', vehicle: '2021 Silverado 2500', image: null, url: 'https://luckydiesel.test/builds/l5p-stage-2', beforeHp: 445, afterHp: 560, beforeTq: 910, afterTq: 1100 }]]),
  dyno: null,
  offerCode: 'DIESEL25',
  ...over,
});

describe('parseBlocks', () => {
  test('accepts valid blocks and drops unknown keys', () => {
    const parsed = parseBlocks([{ type: 'text', text: ' Hi ', evil: '<script>' }, { type: 'button', label: 'Book', url: '{{link}}' }, { type: 'product', handle: 'FASS-Titanium' }]);
    expect(parsed).toEqual({ ok: true, value: [{ type: 'text', text: 'Hi' }, { type: 'button', label: 'Book', url: '{{link}}' }, { type: 'product', handle: 'fass-titanium' }] });
  });

  test('rejects unsafe links and unknown types', () => {
    expect(parseBlocks([{ type: 'button', label: 'x', url: 'javascript:alert(1)' }]).ok).toBe(false);
    expect(parseBlocks([{ type: 'image', url: '/local.png' }]).ok).toBe(false);
    expect(parseBlocks([{ type: 'script' }]).ok).toBe(false);
    expect(parseBlocks('nope').ok).toBe(false);
  });

  test('lists what needs resolving', () => {
    expect(blockRefs([{ type: 'product', handle: 'a' }, { type: 'build', slug: 'b' }, { type: 'my_dyno' }])).toEqual({ handles: ['a'], slugs: ['b'], needsDyno: true });
  });
});

describe('renderEmail', () => {
  test('renders html and a plain-text part, escaping copy', () => {
    const { html, text } = renderEmail('Hey Cody', [
      { type: 'heading', text: 'New <parts>' },
      { type: 'product', handle: 'fass-titanium' },
      { type: 'build', slug: 'l5p-stage-2' },
      { type: 'offer' },
      { type: 'text', text: 'Duramax only', when: 'platform=duramax' },
      { type: 'my_dyno' },
    ], ctx());
    expect(html).toContain('New &lt;parts&gt;');
    expect(html).not.toContain('<parts>');
    expect(html).toContain('FASS Titanium');
    expect(html).toContain('445 → 560 hp (+115)');
    expect(html).not.toContain('Duramax only');
    expect(text).toContain('FASS Titanium — from $899: https://luckydiesel.com/products/fass-titanium');
    expect(text).toContain('Use code DIESEL25');
    expect(text).not.toContain('DYNO');
  });

  test('personal dyno block shows when data exists; footer goes inside the card', () => {
    const { html } = renderEmail('', [{ type: 'my_dyno' }], ctx({ dyno: { label: '2019 Ram 2500', beforeHp: 370, afterHp: 450, beforeTq: null, afterTq: null } }));
    expect(html).toContain('370 → 450 hp (+80)');
    expect(withHtmlFooter(html, 'Unsubscribe: https://x.test/u?t=1')).toContain('<a href="https://x.test/u?t=1"');
  });
});

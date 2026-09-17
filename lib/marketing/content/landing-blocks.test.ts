import { describe, expect, test } from 'vitest';
import { blocksText, isSafeHref, validateBlocks } from './landing-blocks';

const valid = [
  { type: 'hero', kicker: 'Tow season', headline: 'Tow-ready before the trip', subhead: 'Cooling, brakes and fuel checked.', image: '/images/shop-card.jpg' },
  { type: 'offer', headline: 'Tow-ready inspection', valueLabel: '$49 flat', terms: 'One per truck.', code: 'TOW49', endsAt: '2026-10-31' },
  { type: 'bullets', heading: 'What we check', items: ['Cooling system', 'Brakes', 'Fuel filters'] },
  { type: 'form', heading: 'Claim your spot', service: 'maintenance', offerTag: 'tow-season-tune' },
];

describe('validateBlocks', () => {
  test('accepts a well-formed page and normalises defaults', () => {
    const result = validateBlocks(valid);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.blocks).toHaveLength(4);
      expect(result.blocks[3]).toMatchObject({ type: 'form', submitLabel: 'Claim it' });
      expect(blocksText(result.blocks)).toContain('Tow-ready inspection');
    }
  });

  test('rejects structural problems', () => {
    expect(validateBlocks('nope').ok).toBe(false);
    expect(validateBlocks([]).ok).toBe(false);
    expect(validateBlocks([valid[1], valid[0], valid[3]]).ok).toBe(false);
    expect(validateBlocks([valid[0], valid[1]]).ok).toBe(false);
    expect(validateBlocks([...valid, valid[3]]).ok).toBe(false);
    expect(validateBlocks([valid[0], { type: 'script', src: 'x' }, valid[3]]).ok).toBe(false);
  });

  test('rejects unsafe links, images, unknown services and bad codes', () => {
    const errors = (blocks: unknown[]) => {
      const r = validateBlocks(blocks);
      return r.ok ? [] : r.errors;
    };
    expect(errors([valid[0], { type: 'cta', headline: 'Go', label: 'Go', href: 'javascript:alert(1)' }]).join()).toMatch(/link/);
    expect(errors([{ ...valid[0], image: 'javascript:x' }, valid[3]]).join()).toMatch(/image/);
    expect(errors([valid[0], { ...valid[3], service: 'delete' }]).join()).toMatch(/unknown service/);
    expect(errors([valid[0], { ...valid[1], code: 'bad code' }, valid[3]]).join()).toMatch(/code/);
    expect(errors([{ ...valid[0], headline: 'x'.repeat(200) }, valid[3]]).join()).toMatch(/longer/);
  });

  test('strips angle brackets from text', () => {
    const r = validateBlocks([{ ...valid[0], headline: '<b>Tow</b> ready' }, valid[3]]);
    expect(r.ok && r.blocks[0]!.type === 'hero' && r.blocks[0]!.headline).toBe('bTow/b ready');
  });

  test('isSafeHref', () => {
    for (const ok of ['/book', '#claim', 'tel:+18439959252', 'sms:+18439959252', 'https://luckydiesel.com']) expect(isSafeHref(ok)).toBe(true);
    for (const bad of ['//evil.com', 'javascript:x', 'http://x.com', 'data:text/html,x']) expect(isSafeHref(bad)).toBe(false);
  });
});

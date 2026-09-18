import { describe, expect, it } from 'vitest';
import type { BlockDef } from './fields';
import { ContentError, validateBlock } from './validate';

const def: BlockDef = {
  key: 'test.block',
  group: 'home',
  title: 'Test',
  fields: [
    { kind: 'text', name: 'headline', label: 'Headline', max: 80, maxWords: 6 },
    { kind: 'textarea', name: 'body', label: 'Body', max: 400, maxWords: 40 },
    { kind: 'url', name: 'href', label: 'Link', max: 200 },
    { kind: 'boolean', name: 'enabled', label: 'On' },
    { kind: 'select', name: 'tone', label: 'Tone', options: [{ value: 'calm', label: 'Calm' }, { value: 'loud', label: 'Loud' }] },
    { kind: 'image', name: 'photo', label: 'Photo' },
    { kind: 'list', name: 'order', label: 'Order', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }, { value: 'c', label: 'C' }] },
  ],
  defaults: { headline: 'Built for boost', body: 'Some body copy.', href: '/book', enabled: true, tone: 'calm', photo: '', order: ['a', 'b', 'c'] },
};

describe('validateBlock', () => {
  it('keeps clean values and trims whitespace', () => {
    const values = validateBlock(def, { headline: '  Six words is the limit  ', body: 'Short.', href: '/book', enabled: 'on', tone: 'loud', photo: '', order: ['b', 'a'] });
    expect(values).toEqual({ headline: 'Six words is the limit', body: 'Short.', href: '/book', enabled: true, tone: 'loud', photo: '', order: ['b', 'a'] });
  });

  it('treats an empty field as "use the built-in default"', () => {
    const values = validateBlock(def, { headline: '   ', body: '', href: '', enabled: 'on', tone: 'calm', photo: '', order: ['a'] });
    expect(values.headline).toBe('');
    expect(values.body).toBe('');
  });

  it('rejects copy over the word limit', () => {
    expect(() => validateBlock(def, { headline: 'One two three four five six seven' })).toThrow(ContentError);
    expect(() => validateBlock(def, { headline: 'One two three four five six seven' })).toThrow(/6 words/);
  });

  it('rejects copy over the character limit', () => {
    expect(() => validateBlock(def, { body: 'x'.repeat(401) })).toThrow(/400 characters/);
  });

  it('rejects an unknown select option', () => {
    expect(() => validateBlock(def, { tone: 'shouty' })).toThrow(ContentError);
  });

  it('rejects list values that are not options, and de-duplicates', () => {
    expect(() => validateBlock(def, { order: ['a', 'zz'] })).toThrow(ContentError);
    expect(validateBlock(def, { order: ['a', 'a', 'b'] }).order).toEqual(['a', 'b']);
  });

  it('rejects a list that is not an array', () => {
    expect(() => validateBlock(def, { order: 'a,b' })).toThrow(ContentError);
  });

  it('accepts only same-origin links and absolute https links', () => {
    expect(validateBlock(def, { href: '/store' }).href).toBe('/store');
    expect(validateBlock(def, { href: 'https://luckydiesel.com/collections/all' }).href).toBe('https://luckydiesel.com/collections/all');
    expect(validateBlock(def, { href: 'tel:+18439959252' }).href).toBe('tel:+18439959252');
    expect(() => validateBlock(def, { href: 'javascript:alert(1)' })).toThrow(ContentError);
    expect(() => validateBlock(def, { href: 'http://insecure.example.com' })).toThrow(ContentError);
  });

  it('accepts only local or storage images', () => {
    expect(validateBlock(def, { photo: '/images/shop-card.jpg' }).photo).toBe('/images/shop-card.jpg');
    expect(validateBlock(def, { photo: 'https://abc.supabase.co/storage/v1/object/public/gallery/site/x.jpg' }).photo)
      .toBe('https://abc.supabase.co/storage/v1/object/public/gallery/site/x.jpg');
    expect(() => validateBlock(def, { photo: 'https://tracker.example.com/pixel.gif' })).toThrow(ContentError);
  });

  it('ignores keys the block does not define', () => {
    const values = validateBlock(def, { headline: 'Hi', sneaky: 'value' });
    expect(values).not.toHaveProperty('sneaky');
  });

  it('reads a missing boolean as false', () => {
    expect(validateBlock(def, {}).enabled).toBe(false);
  });
});

describe('mergeValues', () => {
  it('falls back to the default for empty or missing fields', async () => {
    const { mergeValues } = await import('./validate');
    expect(mergeValues(def, { headline: '', body: 'Mine.' })).toMatchObject({ headline: 'Built for boost', body: 'Mine.' });
    expect(mergeValues(def, null)).toMatchObject(def.defaults);
  });

  it('keeps a deliberately false boolean instead of the default', async () => {
    const { mergeValues } = await import('./validate');
    expect(mergeValues(def, { enabled: false }).enabled).toBe(false);
  });
});

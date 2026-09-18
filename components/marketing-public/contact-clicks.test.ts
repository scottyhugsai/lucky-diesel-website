import { describe, expect, test } from 'vitest';
import { contactClick, pickRegion } from './contact-clicks';

describe('contactClick', () => {
  test('reads a call from a tel: link', () => {
    expect(contactClick('tel:+18439959252', 'parts', '/')).toEqual({ event: 'call_click', source: 'parts' });
  });

  test('reads a text from an sms: link', () => {
    expect(contactClick('sms:+18439959252', 'quote', '/')).toEqual({ event: 'text_click', source: 'quote' });
  });

  test('ignores every other link', () => {
    expect(contactClick('/store', 'parts', '/')).toBeNull();
    expect(contactClick('mailto:a@b.com', null, '/')).toBeNull();
    expect(contactClick('https://luckydiesel.com', null, '/')).toBeNull();
    expect(contactClick(null, null, '/')).toBeNull();
  });

  // Where it was clicked is the whole point: a call from a product page and a
  // call from the footer are different signals about what is working.
  test('falls back to the page when nothing nearer identifies the place', () => {
    expect(contactClick('tel:+1', null, '/store/products/ddp-cp3')?.source).toBe('/store/products/ddp-cp3');
  });

  test('tolerates case and whitespace in the scheme', () => {
    expect(contactClick('  TEL:+1843  ', null, '/')?.event).toBe('call_click');
    expect(contactClick('SMS:+1843', null, '/')?.event).toBe('text_click');
  });
});

describe('pickRegion', () => {
  test('takes the nearest meaningful region', () => {
    expect(pickRegion(['quote', 'main'])).toBe('quote');
  });

  // "main" wraps the entire page, so reporting it is the same as reporting
  // nothing while looking like real data.
  test('skips generic page containers', () => {
    expect(pickRegion(['main'])).toBeNull();
    expect(pickRegion(['__next', 'root', 'main'])).toBeNull();
    expect(pickRegion(['main', 'parts'])).toBe('parts');
  });

  test('has nothing to say when there are no ids', () => {
    expect(pickRegion([])).toBeNull();
  });
});

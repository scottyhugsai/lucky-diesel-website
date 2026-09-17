import { describe, expect, it } from 'vitest';
import { parseTemplateInput, scanTemplates, templateKey } from './templates';

describe('templateKey', () => {
  it('slugs names', () => {
    expect(templateKey('  Tow Season — Text #2 ')).toBe('tow-season-text-2');
  });
});

describe('parseTemplateInput', () => {
  const base = { name: 'Review ask', channel: 'sms', subject: '', body: 'Thanks {{first_name}}! An honest review helps: {{review_link}}', tags: 'Reviews, after job' };

  it('accepts a clean template and normalizes tags', () => {
    const result = parseTemplateInput(base);
    expect(result.ok && result.value).toMatchObject({ key: 'review-ask', channel: 'sms', subject: null, tags: ['reviews', 'after-job'] });
  });

  it('blocks review gating on save', () => {
    const result = parseTemplateInput({ ...base, body: 'If you loved the work, leave a 5-star review!' });
    expect(result.ok).toBe(false);
  });

  it('requires an email subject', () => {
    expect(parseTemplateInput({ ...base, channel: 'email' }).ok).toBe(false);
  });
});

describe('scanTemplates', () => {
  it('returns only flagged items, blocks first', () => {
    const results = scanTemplates([
      { id: 'a', label: 'A', kind: 'automation', href: '/a', fields: ['All good here'] },
      { id: 'b', label: 'B', kind: 'automation', href: '/b', fields: ['Our tuning is legit'] },
      { id: 'c', label: 'C', kind: 'campaign', href: '/c', fields: ['Get $10 off when you leave a review'] },
    ]);
    expect(results.map((r) => [r.id, r.report.status])).toEqual([['c', 'block'], ['b', 'warn']]);
  });
});

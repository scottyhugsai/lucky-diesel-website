import { describe, expect, test } from 'vitest';
import { buildReviewWidget, checkReplyText, draftReviewReply, firstName, npsCategory, npsFollowUp, npsScore } from './reputation';

describe('review replies', () => {
  test('tone follows the rating and uses first names only', () => {
    expect(draftReviewReply({ id: 'a', rating: 5, authorName: 'Travis Miller' })).toMatchObject({ tone: 'positive' });
    const negative = draftReviewReply({ id: 'b', rating: 1, authorName: 'Sample — Kelly Parks' });
    expect(negative.tone).toBe('negative');
    expect(negative.text).toContain('Kelly');
    expect(negative.text).not.toContain('Parks');
    expect(negative.text).toContain('(843) 995-9252');
    expect(negative.compliance.status).toBe('pass');
    expect(firstName('Sample — Dana R.')).toBe('Dana');
  });

  test('blocks incentives and job details in replies', () => {
    expect(checkReplyText('Sorry! Here is 20% off, a free oil change if you update your review.').status).toBe('block');
    expect(checkReplyText('Thanks for the $1,200 turbo job on invoice 2203.').status).toBe('block');
    expect(checkReplyText('Thanks, Dana. See you next time.').status).toBe('pass');
  });
});

describe('NPS', () => {
  test('categories and score', () => {
    expect([10, 9, 8, 7, 6, 0].map(npsCategory)).toEqual(['promoter', 'promoter', 'passive', 'passive', 'detractor', 'detractor']);
    expect(npsScore([10, 9, 8, 3])).toBe(25);
    expect(npsScore([])).toBeNull();
  });

  test('every score still gets the review link; low scores also alert the owner (no gating)', () => {
    for (let s = 0; s <= 10; s += 1) expect(npsFollowUp(s).showReviewLink).toBe(true);
    expect(npsFollowUp(6).alertOwner).toBe(true);
    expect(npsFollowUp(7).alertOwner).toBe(false);
  });
});

describe('review widget', () => {
  const row = (id: string, source: string, rating: number, days: number) => ({ id, source, rating, body: `Review ${id}`, author_name: 'Jamie Lee Smith', reviewed_at: new Date(Date.UTC(2026, 8, days)).toISOString() });
  test('shows only real reviews, never sample or internal', () => {
    const widget = buildReviewWidget([row('1', 'google', 5, 10), row('2', 'sample', 5, 12), row('3', 'internal', 1, 11), row('4', 'manual', 4, 9), row('5', 'facebook', 3, 13)]);
    expect(widget.reviews.map((r) => r.id)).toEqual(['5', '1', '4']);
    expect(widget.count).toBe(3);
    expect(widget.average).toBe(4);
    expect(widget.reviews[0]!.author).toBe('Jamie L.');
  });
  test('empty when there are no real reviews', () => {
    expect(buildReviewWidget([row('2', 'sample', 5, 1)])).toEqual({ average: null, count: 0, reviews: [] });
  });
});

import { describe, expect, it } from 'vitest';
import { adPolicyChecklist, checkContent, checkFinancing, checkReviewPolicy, lintTemplate } from './compliance';

describe('checkFinancing (Reg Z trigger terms)', () => {
  it('passes plain "financing available"', () => {
    expect(checkFinancing('Financing available on builds.').issue).toBeNull();
  });

  it('blocks a payment amount without APR, down payment and term', () => {
    const result = checkFinancing('Full build for just $199/mo!');
    expect(result.triggers).toEqual(['payment amount']);
    expect(result.issue?.severity).toBe('block');
    expect(result.missing).toContain('APR (“annual percentage rate”)');
  });

  it('passes when every disclosure is present', () => {
    const result = checkFinancing('$199/mo for 36 months, $500 down payment, 9.99% APR. Subject to credit approval.');
    expect(result.issue).toBeNull();
  });

  it('flows into checkContent', () => {
    expect(checkContent(['No money down on injectors']).issues.some((i) => i.term === 'Reg Z disclosure')).toBe(true);
  });
});

describe('checkReviewPolicy', () => {
  it('blocks review gating', () => {
    expect(checkReviewPolicy('If you were happy with the work, please leave us a review!').map((i) => i.term)).toContain('review gating');
  });

  it('blocks star asks and warns on staff naming', () => {
    const terms = checkReviewPolicy('Leave a 5-star review and mention your technician by name.').map((i) => i.term);
    expect(terms).toEqual(expect.arrayContaining(['star ask', 'staff naming']));
  });

  it('allows an honest ask', () => {
    expect(checkReviewPolicy('How did we do? An honest Google review helps: {{review_link}}')).toEqual([]);
  });
});

describe('lintTemplate', () => {
  it('ignores template tokens', () => {
    expect(lintTemplate(['Hey {{first_name}}, your {{vehicle}} is due.']).status).toBe('pass');
  });
});

describe('adPolicyChecklist', () => {
  it('flags Google editorial problems and phone numbers', () => {
    const checks = adPolicyChecklist('google', 'BEST diesel shop!! Call 843-555-0142');
    expect(checks.find((c) => c.id === 'editorial')?.passed).toBe(false);
    expect(checks.find((c) => c.id === 'phone')?.passed).toBe(false);
  });

  it('flags Meta personal attributes and credit offers', () => {
    const checks = adPolicyChecklist('meta', 'Are you struggling with bad credit? $99/mo builds.');
    expect(checks.find((c) => c.id === 'attributes')?.passed).toBe(false);
    expect(checks.find((c) => c.id === 'credit')?.passed).toBe(false);
  });

  it('passes clean copy on auto checks', () => {
    const checks = adPolicyChecklist('tiktok', 'Diesel-only techs in Charleston. Book a bay.');
    expect(checks.filter((c) => c.auto).every((c) => c.passed)).toBe(true);
  });
});

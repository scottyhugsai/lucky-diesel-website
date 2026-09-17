import { checkClaims as coreCheckClaims } from '@/lib/marketing/core/compliance';
import type { ClaimIssue, ClaimsResult, ComplianceStatus } from './types';

/**
 * Compliance gate for everything this engine writes: ads, posts, replies, SEO.
 * Emissions/claims rules come from part A's shared `checkClaims`
 * (lib/marketing/core/compliance.ts); content-specific rules (review
 * incentives, Yelp asks) are layered on top here.
 */

interface Rule {
  pattern: RegExp;
  term: string;
  reason: string;
  severity: 'block' | 'warn';
}

const CONTENT_RULES: readonly Rule[] = [
  { pattern: /\byelp\b/i, term: 'Yelp ask', reason: 'Yelp prohibits asking for reviews.', severity: 'block' },
  { pattern: /\b(discount|coupon|free|gift|\$\d+|entry|raffle)\b[^.]{0,40}\b(for|in exchange for|when you leave)\b[^.]{0,20}\breview/i, term: 'review incentive', reason: 'FTC and Google ban incentives for reviews.', severity: 'block' },
  { pattern: /\breview\b[^.]{0,30}\b(get|earn|receive)\b[^.]{0,20}\b(discount|coupon|free|gift|\$\d+)/i, term: 'review incentive', reason: 'FTC and Google ban incentives for reviews.', severity: 'block' },
  { pattern: /\b(0%|zero percent)\s*(apr|financing|interest)\b/i, term: 'financing', reason: 'Credit offers can trigger special ad categories; needs a financing provider.', severity: 'warn' },
];

function runRules(text: string, rules: readonly Rule[]): ClaimIssue[] {
  const issues: ClaimIssue[] = [];
  for (const rule of rules) {
    if (rule.pattern.test(text) && !issues.some((i) => i.term === rule.term)) {
      issues.push({ term: rule.term, reason: rule.reason, severity: rule.severity });
    }
  }
  return issues;
}

/** Part A's checker, mapped to this module's issue shape (`term` = rule id). */
export function checkClaims(text: string): ClaimsResult {
  const result = coreCheckClaims(text);
  const issues = result.issues.map((i) => ({ term: i.rule, reason: i.suggestion ? `${i.reason} ${i.suggestion}` : i.reason, severity: i.severity }));
  return { ok: result.risk !== 'fail', issues };
}

export interface ComplianceReport {
  status: ComplianceStatus;
  issues: ClaimIssue[];
}

/** Checks every field of one piece of content together and collapses to pass / warn / block. */
export function checkContent(fields: readonly (string | null | undefined)[]): ComplianceReport {
  const text = fields.filter(Boolean).join('\n');
  const merged = [...checkClaims(text).issues, ...runRules(text, CONTENT_RULES)];
  const issues = merged.filter((issue, index) => merged.findIndex((i) => i.term === issue.term) === index);
  const status: ComplianceStatus = issues.some((i) => i.severity === 'block') ? 'block' : issues.length ? 'warn' : 'pass';
  return { status, issues };
}

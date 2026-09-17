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

/** Review policy (FTC 16 CFR 465, Google, Yelp): no gating, no star asks, no staff naming, no quotas. */
export const REVIEW_POLICY_RULES: readonly Rule[] = [
  { pattern: /\b(if|only if|when)\b[^.!?]{0,40}\b(happy|satisfied|loved?|enjoyed|pleased|great experience)\b[^.!?]{0,60}\breview/i, term: 'review gating', reason: 'Asking only happy customers for reviews is review gating (FTC, Google).', severity: 'block' },
  { pattern: /\b(not happy|unhappy|dissatisfied|not satisfied|bad experience)\b[^.!?]{0,60}\b(call|contact|text|email|reply to|tell)\s+(us|me)\b(?=[\s\S]{0,200}\breview)/i, term: 'review gating', reason: 'Routing unhappy customers away from reviews is gating.', severity: 'block' },
  { pattern: /\b(5|five)[\s-]*stars?\b[^.!?]{0,20}\breview|\breview\b[^.!?]{0,30}\b(5|five)[\s-]*stars?\b|\bpositive review/i, term: 'star ask', reason: 'Ask for honest reviews, never a rating.', severity: 'block' },
  { pattern: /\b(mention|name|shout[\s-]*out|tag)\b[^.!?]{0,30}\b(tech|technician|advisor|employee|staff|by name|mechanic)\b|\b(tech|technician|advisor|employee|mechanic)(?:'s)?\s+name\b[^.!?]{0,40}\breview/i, term: 'staff naming', reason: 'Asking reviewers to name staff ties reviews to employee rewards.', severity: 'warn' },
  { pattern: /(?:\$\s?\d+|\b\d+\s?%|\bfree\b|\bdiscount\b|\bgift cards?\b|\bentry\b)[^.!?]{0,40}\b(?:for|when|if|after)\b[^.!?]{0,30}\breview/i, term: 'review incentive', reason: 'FTC and Google ban incentives for reviews.', severity: 'block' },
  { pattern: /\b(goal|quota|target|need|trying to get)\b[^.!?]{0,30}\b\d+\s*(more\s+)?reviews\b/i, term: 'review quota', reason: 'Review quotas pressure customers; ask plainly.', severity: 'warn' },
];

const MONEY = String.raw`\$\s?\d[\d,]*(?:\.\d{2})?`;
/** Reg Z (12 CFR 1026.24(d)) triggering terms in credit ads. */
const REG_Z_TRIGGERS: readonly { pattern: RegExp; label: string }[] = [
  { pattern: new RegExp(`${MONEY}\\s*(?:\\/|per|a|each)\\s*(?:mo\\b|month|week|wk\\b)`, 'i'), label: 'payment amount' },
  { pattern: /\b\d{1,3}\s*(?:monthly|weekly|equal|easy)?\s*payments\b/i, label: 'number of payments' },
  { pattern: /\b\d{1,3}[\s-]*(?:months?|mos?\.?|years?)\s*(?:to pay|of payments|financing|term|same as cash)\b|\bpay (?:it )?over \d{1,3}\s*(?:months?|years?)\b/i, label: 'repayment period' },
  { pattern: new RegExp(`\\b(?:no|zero|\\d{1,2}%|${MONEY})\\s*(?:money\\s*)?down\\b|\\bdown payment\\b`, 'i'), label: 'down payment' },
  { pattern: /\bfinance charges?\b/i, label: 'finance charge' },
];
const REG_Z_DISCLOSURES: readonly { pattern: RegExp; label: string }[] = [
  { pattern: /\bannual percentage rate\b|\bAPR\b/i, label: 'APR (“annual percentage rate”)' },
  { pattern: /\bdown payment\b|\b(?:no|zero|\d{1,2}%|\$\s?\d[\d,]*)\s*(?:money\s*)?down\b/i, label: 'down payment' },
  { pattern: /\b\d{1,3}\s*(?:monthly\s*)?payments\b|\b\d{1,3}[\s-]*(?:months?|years?)\b/i, label: 'repayment terms' },
];

export interface FinancingCheck {
  triggers: string[];
  missing: string[];
  issue: ClaimIssue | null;
}

/** A credit ad that states a trigger term must also state APR, down payment and repayment terms. */
export function checkFinancing(text: string): FinancingCheck {
  const triggers = REG_Z_TRIGGERS.filter((t) => t.pattern.test(text)).map((t) => t.label);
  if (!triggers.length) return { triggers, missing: [], issue: null };
  const missing = REG_Z_DISCLOSURES.filter((d) => !d.pattern.test(text)).map((d) => d.label);
  const issue: ClaimIssue | null = missing.length
    ? { term: 'Reg Z disclosure', reason: `States ${triggers.join(', ')}; also state ${missing.join(', ')}.`, severity: 'block' }
    : null;
  return { triggers, missing, issue };
}

export function checkReviewPolicy(text: string): ClaimIssue[] {
  return runRules(text, [...REVIEW_POLICY_RULES, ...CONTENT_RULES.filter((r) => r.term === 'Yelp ask' || r.term === 'review incentive')]);
}

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
  const financing = checkFinancing(text).issue;
  const merged = [...checkClaims(text).issues, ...runRules(text, CONTENT_RULES), ...runRules(text, REVIEW_POLICY_RULES), ...(financing ? [financing] : [])];
  const issues = merged.filter((issue, index) => merged.findIndex((i) => i.term === issue.term) === index);
  const status: ComplianceStatus = issues.some((i) => i.severity === 'block') ? 'block' : issues.length ? 'warn' : 'pass';
  return { status, issues };
}

/** Template lint for automations, campaign steps and library templates. `{{tokens}}` are ignored. */
export function lintTemplate(fields: readonly (string | null | undefined)[]): ComplianceReport {
  return checkContent(fields.map((f) => (f ? f.replace(/\{\{\s*[a-z_]+\s*\}\}/gi, 'X') : f)));
}

export type PolicyPlatform = 'meta' | 'google' | 'tiktok';

export interface PolicyCheck {
  id: string;
  label: string;
  /** Auto checks run on the text; manual ones the owner ticks. */
  auto: boolean;
  passed: boolean | null;
  note?: string;
}

const PERSONAL_ATTRIBUTE = /\b(are you|do you have|you're|you are)\b[^.!?]{0,30}\b(broke|in debt|bad credit|divorced|struggling|overweight|depressed|poor)\b/i;
const SENSATIONAL = /!!|\b(shocking|you won'?t believe|miracle|secret trick|click here)\b/i;
const ALL_CAPS_WORD = /\b[A-Z]{5,}\b/;
const PHONE = /\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/;

/** Per-platform ad policy pre-check. Not legal advice; mirrors the platforms' published restricted-content rules. */
export function adPolicyChecklist(platform: PolicyPlatform, text: string): PolicyCheck[] {
  const report = checkContent([text]);
  const has = (term: string) => report.issues.some((i) => i.term === term || i.term.startsWith(term));
  const tamper = report.issues.some((i) => i.severity === 'block' && !['Reg Z disclosure', 'review gating', 'star ask', 'Yelp ask', 'review incentive'].includes(i.term));
  const financing = checkFinancing(text);
  const credit = financing.triggers.length > 0 || has('financing');
  const common: PolicyCheck[] = [
    { id: 'emissions', label: 'No emissions tampering', auto: true, passed: !tamper },
    { id: 'credit', label: credit ? 'Credit terms disclosed' : 'No credit offer', auto: true, passed: financing.issue === null, note: credit && platform === 'meta' ? 'Run under Special Ad Category: Financial products.' : undefined },
    { id: 'reviews', label: 'No review incentives', auto: true, passed: !has('review') && !has('star ask') && !has('Yelp ask') },
    { id: 'landing', label: 'Landing page matches offer', auto: false, passed: null },
    { id: 'privacy', label: 'Privacy link on forms', auto: false, passed: null },
  ];
  if (platform === 'meta') {
    return [...common,
      { id: 'attributes', label: 'No personal attributes', auto: true, passed: !PERSONAL_ATTRIBUTE.test(text), note: 'Meta bans “Are you…?” copy about finances or health.' },
      { id: 'sensational', label: 'No sensational hooks', auto: true, passed: !SENSATIONAL.test(text) },
    ];
  }
  if (platform === 'google') {
    return [...common,
      { id: 'editorial', label: 'Editorial style', auto: true, passed: !ALL_CAPS_WORD.test(text) && !/!!|!.*!/.test(text), note: 'No all caps; one “!” at most.' },
      { id: 'phone', label: 'No phone in text', auto: true, passed: !PHONE.test(text), note: 'Use a call asset instead.' },
      { id: 'trademarks', label: 'Brand names allowed', auto: false, passed: null, note: 'Ford, Cummins, Duramax: describe compatibility only.' },
    ];
  }
  return [...common,
    { id: 'sensational', label: 'No sensational hooks', auto: true, passed: !SENSATIONAL.test(text) },
    { id: 'dangerous', label: 'No dangerous driving', auto: false, passed: null, note: 'TikTok bans burnouts and street racing footage.' },
  ];
}

/** Lint-on-save for templates: a one-line error when wording is blocked (review policy, Reg Z, tampering), else null. */
export function policyBlockMessage(fields: readonly (string | null | undefined)[]): string | null {
  const blocks = lintTemplate(fields).issues.filter((i) => i.severity === 'block');
  return blocks.length ? `Wording blocked: ${blocks.map((i) => `${i.term} (${i.reason})`).join(' ')}` : null;
}

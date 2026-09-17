/**
 * Scaled-content guard: stops thin, templated or mass-produced pages from
 * going live. Pure so the admin page and the publish action share one rule.
 */

export type GuardKind = 'build_page' | 'blog_post' | 'faq' | 'area_page';

export const MIN_WORDS: Record<GuardKind, number> = { build_page: 40, blog_post: 200, faq: 0, area_page: 150 };
export const MIN_FAQ_ITEMS = 3;
/** Near-duplicate threshold on 3-word shingles (Jaccard). */
export const DUPLICATE_SIMILARITY = 0.6;
/** Blog posts plus area pages published in any rolling 30 days. */
export const MONTHLY_PUBLISH_CAP = 8;

const PLACEHOLDER = /\[(add|owner|fill)[^\]]*\]/i;

export interface GuardInput {
  kind: GuardKind;
  text: string;
  faqCount: number;
  /** Other live or queued pages of the same kind. */
  others: readonly { title: string; text: string }[];
  publishedLast30: number;
}

export interface GuardResult {
  ok: boolean;
  words: number;
  issues: string[];
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter((w) => /[a-z0-9]/i.test(w)).length;
}

function shingles(text: string): Set<string> {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const set = new Set<string>();
  for (let i = 0; i + 2 < words.length; i += 1) set.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  return set;
}

/** Jaccard similarity of 3-word shingles, 0–1. */
export function similarity(a: string, b: string): number {
  const x = shingles(a);
  const y = shingles(b);
  if (!x.size || !y.size) return 0;
  let shared = 0;
  for (const s of x) if (y.has(s)) shared += 1;
  return shared / (x.size + y.size - shared);
}

export function checkScaledContent(input: GuardInput): GuardResult {
  const issues: string[] = [];
  const words = wordCount(input.text);
  const min = MIN_WORDS[input.kind];
  if (words < min) issues.push(`Too thin: ${words} of ${min} words.`);
  if (input.kind === 'faq' && input.faqCount < MIN_FAQ_ITEMS) issues.push(`Add at least ${MIN_FAQ_ITEMS} questions.`);
  if (PLACEHOLDER.test(input.text)) issues.push('Replace the [Add …] notes with real detail.');
  const twin = input.others.find((o) => similarity(input.text, o.text) >= DUPLICATE_SIMILARITY);
  if (twin) issues.push(`Too similar to “${twin.title}”. Add unique detail.`);
  if ((input.kind === 'blog_post' || input.kind === 'area_page') && input.publishedLast30 >= MONTHLY_PUBLISH_CAP) {
    issues.push(`Monthly cap reached (${MONTHLY_PUBLISH_CAP} pages in 30 days).`);
  }
  return { ok: issues.length === 0, words, issues };
}

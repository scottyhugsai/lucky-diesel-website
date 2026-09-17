/**
 * Plain-English segment builder, rule-based. Turns "Cummins owners not seen in
 * 12 months who tow" into segment-rules conditions. The output always goes
 * through parseSegmentRules, so nothing here can widen what rules can do.
 * Pure and client-safe.
 */

import { parseSegmentRules, type SegmentCondition, type SegmentRules, type ServiceCategory } from './segment-rules';

export interface NlSegmentResult {
  rules: SegmentRules;
  /** One short phrase per condition, e.g. "Platform: cummins". */
  understood: string[];
  /** Words that didn't map to anything. */
  ignored: string[];
}

export const NL_MAX_CHARS = 300;

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, eighteen: 18, twenty: 20,
};
const UNIT_DAYS: Record<string, number> = { day: 1, week: 7, month: 30, year: 365 };
const NUM = String.raw`(\d+(?:\.\d+)?|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|eighteen|twenty)`;

function toNumber(raw: string): number {
  return NUMBER_WORDS[raw] ?? Number(raw);
}

/** "150k" → 150000, "$5,000" → 5000, "1.2m" → 1200000 */
function amount(raw: string): number {
  const match = /^\$?([\d,.]+)\s*(k|m)?$/.exec(raw.trim());
  if (!match) return NaN;
  const base = Number(match[1]!.replace(/,/g, ''));
  return base * (match[2] === 'k' ? 1000 : match[2] === 'm' ? 1_000_000 : 1);
}

function days(count: string, unit: string): number {
  return Math.round(toNumber(count) * (UNIT_DAYS[unit.replace(/s$/, '')] ?? 1));
}

const PLATFORMS: [RegExp, string][] = [
  [/\b(?:duramax|dmax|chevy|gmc)\b/g, 'duramax'],
  [/\b(?:cummins|ram|dodge)\b/g, 'cummins'],
  [/\b(?:power\s?stroke|ford)\b/g, 'powerstroke'],
];
const GENERATION = /\b(l5p|lml|lmm|lbz|lly|lb7|lm2|lz0|6\.7l?|6\.6l?|5\.9l?|6\.0l?|6\.4l?|7\.3l?|24v|12v)\b/g;
const USAGE: [RegExp, string][] = [
  [/\b(?:tow(?:s|ing|ers?)?|haul(?:s|ing)?|pull(?:s|ing)? (?:a )?(?:trailer|camper|boat|rv)s?)\b/g, 'towing'],
  [/\bdaily(?: drivers?| driven)?\b/g, 'daily'],
  [/\bwork trucks?\b/g, 'work'],
  [/\bshow trucks?\b/g, 'show'],
  [/\boff[\s-]?road(?:ers?|ing)?\b/g, 'offroad'],
];
const STAGES: [RegExp, string][] = [
  [/\bvips?\b/g, 'vip'], [/\blapsed\b/g, 'lapsed'], [/\brepeat(?: customers?)?\b/g, 'repeat'],
  [/\bleads\b/g, 'lead'], [/\bsubscribers\b/g, 'subscriber'], [/\blost (?:leads|customers)\b/g, 'lost'],
];
const TIERS: [RegExp, string][] = [[/\bstage[\s-]?1\b/g, 'stage_1'], [/\bstage[\s-]?2\b/g, 'stage_2'], [/\bfull[\s-]builds?\b/g, 'full_build']];
const SERVICES: [string, ServiceCategory][] = [
  ['tun(?:e|es|ed|ing)', 'tune'], ['turbos?', 'turbo'], ['injectors?', 'injectors'], ['(?:fuel system|cp[34]|lift pump)', 'fuel'],
  ['exhausts?', 'exhaust'], ['(?:transmission|trans|allison)', 'transmission'], ['(?:oil changes?|maintenance|services?)', 'maintenance'],
  ['diagnostics?', 'diagnostics'], ['head studs?', 'head_studs'], ['engine builds?', 'engine'],
];
const SOURCES = /\b(?:from|via|came from|found us on|found us through)\s+(google|facebook|instagram|tiktok|referrals?|website|youtube|walk[\s-]?ins?)\b/g;
const STOPWORDS = new Set([
  'owners', 'owner', 'customers', 'customer', 'people', 'trucks', 'truck', 'who', 'that', 'with', 'the', 'in', 'and', 'or', 'of', 'a', 'an', 'all',
  'everyone', 'anyone', 'show', 'me', 'find', 'list', 'drivers', 'driver', 'have', 'has', 'had', 'their', 'them', 'they', 'are', 'is', 'been', 'to',
  'for', 'on', 'at', 'last', 'past', 'guys', 'folks', 'us', 'our', 'shop', 'get', 'got', 'contacts', 'contact', 'which', 'whose', 'do', 'does', 'but',
]);

interface Hit { condition: SegmentCondition; label: string }

/**
 * Parses a short plain-English description. Matched text is blanked out so
 * the leftover words can be reported back as ignored.
 */
export function parseSegmentText(input: string): NlSegmentResult {
  let text = ` ${input.slice(0, NL_MAX_CHARS).toLowerCase().replace(/[’']/g, "'").replace(/[^\w\s$.,+'-]/g, ' ')} `;
  const hits: Hit[] = [];
  /** Blanks each match. `fn` returns a condition, `true` (consumed, no condition) or null (leave the text). */
  const take = (pattern: RegExp, fn: (m: RegExpExecArray) => Hit | true | null) => {
    text = text.replace(pattern, (...args) => {
      const groups = args.slice(0, -2) as string[];
      const match = Object.assign([...groups], { index: 0, input: text }) as unknown as RegExpExecArray;
      const hit = fn(match);
      if (!hit) return groups[0]!;
      if (hit !== true) hits.push(hit);
      return ' '.repeat(groups[0]!.length);
    });
  };
  const list = (field: 'platform' | 'generation' | 'usage' | 'lifecycle_stage' | 'loyalty_tier' | 'source', label: string, values: string[], negate = false): void => {
    if (!values.length) return;
    const existing = hits.find((h) => h.condition.field === field && h.condition.op === (negate ? 'not_in' : 'in'));
    if (existing && 'values' in existing.condition) {
      const merged = [...new Set([...(existing.condition.values as string[]), ...values])];
      existing.condition = { ...existing.condition, values: merged } as SegmentCondition;
      existing.label = `${label}${negate ? ' not' : ''}: ${merged.join(', ')}`;
      return;
    }
    hits.push({ condition: { field, op: negate ? 'not_in' : 'in', values } as SegmentCondition, label: `${label}${negate ? ' not' : ''}: ${values.join(', ')}` });
  };

  // Last visit: "not seen in 12 months", "haven't been in for a year", "no visit in 6 months".
  take(new RegExp(String.raw`\b(?:not seen|haven'?t (?:been )?(?:seen|visited|been in|come in)|have not (?:been in|visited|come in)|no visits?|not (?:been )?in|not back)\s+(?:in|for|since)?\s*(?:the\s+)?(?:last\s+|past\s+|over\s+)?${NUM}?\s*(day|week|month|year)s?\b`, 'g'), (m) => {
    const d = days(m[1] ?? '1', m[2]!);
    return { condition: { field: 'days_since_last_visit', op: 'gte', value: d }, label: `Last visit: ${d}+ days ago` };
  });
  take(new RegExp(String.raw`\b(?:over|more than)\s+${NUM}\s*(day|week|month|year)s?\s+(?:ago|since (?:their )?last visit)\b`, 'g'), (m) => {
    const d = days(m[1]!, m[2]!);
    return { condition: { field: 'days_since_last_visit', op: 'gte', value: d }, label: `Last visit: ${d}+ days ago` };
  });
  take(new RegExp(String.raw`\b(?:seen|visited|in|came in|been in)\s+(?:in\s+|within\s+)?(?:the\s+)?(?:last|past)\s+${NUM}?\s*(day|week|month|year)s?\b`, 'g'), (m) => {
    const d = days(m[1] ?? '1', m[2]!);
    return { condition: { field: 'days_since_last_visit', op: 'lte', value: d }, label: `Last visit: within ${d} days` };
  });

  // Service history, negated first so "never tuned" isn't read as "tuned".
  for (const [word, category] of SERVICES) {
    take(new RegExp(String.raw`\b(?:never (?:had (?:a |an |the )?)?|no |without (?:a |an )?|haven'?t had (?:a |an )?|not )${word}\b`, 'g'), () => ({
      condition: { field: 'service_history', op: 'has_none', values: [category] }, label: `Never had: ${category}`,
    }));
    take(new RegExp(String.raw`\b(?:had (?:a |an |the )?|got (?:a |an )?|with (?:a |an )?|bought (?:a |an )?)?${word}\b`, 'g'), () => ({
      condition: { field: 'service_history', op: 'has_any', values: [category] }, label: `Has had: ${category}`,
    }));
  }

  // Spend.
  take(/\b(?:spent|spend|ltv|lifetime value|worth)\s+(?:over|more than|at least|above)?\s*(\$?[\d,.]+k?)\b|(\$[\d,.]+k?)\s*\+/g, (m) => {
    const dollars = amount(m[1] ?? m[2]!);
    return Number.isFinite(dollars) ? { condition: { field: 'lifetime_value_cents', op: 'gte', value: Math.round(dollars * 100) }, label: `Spent: $${dollars}+` } : null;
  });

  // Mileage.
  take(/\bbetween\s+([\d,.]+k?)\s+(?:and|to|-)\s+([\d,.]+k?)\s*(?:miles|mi)\b/g, (m) => {
    const min = amount(m[1]!); const max = amount(m[2]!);
    return Number.isFinite(min) && Number.isFinite(max) && min <= max ? { condition: { field: 'mileage', op: 'between', min, max }, label: `Mileage: ${min}–${max}` } : null;
  });
  take(/\b(?:over|above|more than|at least|past)\s+([\d,.]+k?)\s*(?:miles|mi)\b|\b([\d,.]+k)\s*\+\s*(?:miles|mi)?/g, (m) => {
    const value = amount(m[1] ?? m[2]!);
    return Number.isFinite(value) ? { condition: { field: 'mileage', op: 'gte', value }, label: `Mileage: ${value}+` } : null;
  });
  take(/\b(?:under|below|less than|at most)\s+([\d,.]+k?)\s*(?:miles|mi)\b/g, (m) => {
    const value = amount(m[1]!);
    return Number.isFinite(value) ? { condition: { field: 'mileage', op: 'lte', value }, label: `Mileage: under ${value}` } : null;
  });

  // Visits.
  take(/\b(?:never (?:visited|been in|came in)|no (?:paid )?visits|never bought)\b/g, () => ({ condition: { field: 'has_visited', op: 'is', value: false }, label: 'Has visited: no' }));
  take(new RegExp(String.raw`\b(?:at least|more than|over)\s+${NUM}\s+visits?\b|\b(\d+)\s*\+\s*visits?\b`, 'g'), (m) => {
    const raw = m[1] ?? m[2]!;
    const n = toNumber(raw) + (/more than|over/.test(m[0]!) ? 1 : 0);
    return { condition: { field: 'paid_visits', op: 'gte', value: n }, label: `Paid visits: ${n}+` };
  });

  // Churn risk, consent, fleet, tags, source.
  take(/\b(?:at[\s-]risk|overdue|churn(?:ing)?|slipping(?: away)?|due back)\b/g, () => ({ condition: { field: 'overdue_ratio', op: 'gte', value: 1.5 }, label: 'Overdue: 1.5× usual gap' }));
  take(/\b(?:can (?:text|sms)|text(?:s|ing)? ok|opted[\s-]in to (?:texts|sms)|sms (?:opt[\s-]?ins?|subscribers|ok)|text subscribers)\b/g, () => ({ condition: { field: 'consent', op: 'is', value: 'sms_marketing' }, label: 'Can receive: marketing texts' }));
  take(/\b(?:can email|email (?:subscribers|ok|list)|subscribed to email|on the email list)\b/g, () => ({ condition: { field: 'consent', op: 'is', value: 'email_marketing' }, label: 'Can receive: marketing email' }));
  take(/\b(?:not|non)[\s-]fleet\b/g, () => ({ condition: { field: 'fleet', op: 'is', value: false }, label: 'Fleet: no' }));
  take(/\bfleets?\b(?: accounts?)?/g, () => ({ condition: { field: 'fleet', op: 'is', value: true }, label: 'Fleet: yes' }));
  take(/\btagged\s+["']?([a-z0-9][a-z0-9_-]{0,31})\b|\btag\s+["']?([a-z0-9][a-z0-9_-]{0,31})\b/g, (m) => {
    const tag = m[1] ?? m[2]!;
    return { condition: { field: 'tags', op: 'has_any', values: [tag] }, label: `Tag: ${tag}` };
  });
  const sources: string[] = [];
  take(SOURCES, (m) => { sources.push(m[1]!.replace(/s$/, '').replace(/[\s-]/g, '_')); return true; });

  // Lists: platform (with "not"/"non-"), generation, usage, stage, tier.
  const platforms: string[] = []; const notPlatforms: string[] = [];
  for (const [pattern, value] of PLATFORMS) {
    take(new RegExp(String.raw`\b(?:not|non|no|except)[\s-]+${pattern.source.slice(2)}`, 'g'), () => { notPlatforms.push(value); return true; });
    take(pattern, () => { platforms.push(value); return true; });
  }
  const generations: string[] = [];
  take(GENERATION, (m) => { generations.push(m[1]!.replace(/l$/, '')); return true; });
  const usage: string[] = [];
  for (const [pattern, value] of USAGE) take(pattern, () => { usage.push(value); return true; });
  const stages: string[] = [];
  for (const [pattern, value] of STAGES) take(pattern, () => { stages.push(value); return true; });
  const tiers: string[] = [];
  for (const [pattern, value] of TIERS) take(pattern, () => { tiers.push(value); return true; });

  list('platform', 'Platform', [...new Set(platforms)]);
  list('platform', 'Platform', [...new Set(notPlatforms)], true);
  list('generation', 'Generation', [...new Set(generations)]);
  list('usage', 'Usage', [...new Set(usage)]);
  list('lifecycle_stage', 'Stage', [...new Set(stages)]);
  list('loyalty_tier', 'Tier', [...new Set(tiers)]);
  list('source', 'Source', [...new Set(sources)]);

  const deduped = hits.filter((h, i) => hits.findIndex((o) => JSON.stringify(o.condition) === JSON.stringify(h.condition)) === i);
  const parsed = parseSegmentRules({ match: 'all', conditions: deduped.map((h) => h.condition) });
  const ignored = [...new Set(text.split(/[^a-z0-9$.+'-]+/).map((w) => w.replace(/^[.,'-]+|[.,'-]+$/g, '')).filter((w) => w.length > 1 && !STOPWORDS.has(w) && !/^\d+$/.test(w)))];
  if (!parsed.ok) return { rules: { match: 'all', conditions: [] }, understood: [], ignored };
  return { rules: parsed.rules, understood: deduped.map((h) => h.label), ignored };
}

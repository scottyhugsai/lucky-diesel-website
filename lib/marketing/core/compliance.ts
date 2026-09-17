/**
 * Marketing compliance helpers shared by part A (campaigns) and part B (ads,
 * social, AI copy). Pure and dependency-free.
 *
 * `checkClaims` is a regex risk scorer, not legal advice: it hard-fails
 * emissions-tampering language (Clean Air Act; every ad platform bans it) and
 * flags performance claims the owner must be able to document.
 */

export type ClaimSeverity = 'block' | 'warn';

export interface ClaimIssue {
  severity: ClaimSeverity;
  /** Stable rule id, e.g. `emissions_delete`. */
  rule: string;
  /** The text that matched, as written. */
  match: string;
  index: number;
  reason: string;
  suggestion?: string;
}

export interface ClaimsResult {
  /** `fail` = do not publish/send; `warn` = owner must confirm; `pass` = nothing found. */
  risk: 'pass' | 'warn' | 'fail';
  /** 0–100; blocks weigh 40, warnings 10. */
  score: number;
  issues: ClaimIssue[];
}

interface ClaimRule {
  rule: string;
  severity: ClaimSeverity;
  pattern: RegExp;
  reason: string;
  suggestion?: string;
}

const TAMPER_REASON = 'Emissions tampering language. Illegal under the Clean Air Act and banned by Meta, Google and TikTok ad policies.';
const COMPLIANT = 'Describe EPA-compliant or CARB EO-numbered work instead.';

const RULES: readonly ClaimRule[] = [
  { rule: 'emissions_delete', severity: 'block', pattern: /\b(?:dpf|egr|def|scr|doc|cat(?:alytic(?: converter)?)?|emissions?|urea|adblue|nox|particulate filter)[\s-]*(?:delete[ds]?|deleting|removal|removed?|eliminat\w*|bypass\w*|block[\s-]?offs?|off|kill\w*)\b/gi, reason: TAMPER_REASON, suggestion: COMPLIANT },
  { rule: 'delete_kit', severity: 'block', pattern: /\bdelete[\s-]*(?:kits?|pipes?|tunes?|tuners?|files?|programs?|packages?|parts?|builds?|trucks?)\b/gi, reason: TAMPER_REASON, suggestion: COMPLIANT },
  { rule: 'deleted_generic', severity: 'block', pattern: /\b(?:delete[ds]?|deleting)\b/gi, reason: '“Delete” reads as emissions-delete in diesel marketing.', suggestion: 'Remove the word; say “repair”, “replace” or “upgrade”.' },
  { rule: 'race_pipe', severity: 'block', pattern: /\b(?:race|test|straight|dpf[\s-]*back[\s-]*less)[\s-]*pipe[ds]?\b/gi, reason: TAMPER_REASON, suggestion: 'Name the compliant exhaust (e.g. DPF-back or filter-back system).' },
  { rule: 'cat_less', severity: 'block', pattern: /\b(?:cat|dpf|egr)[\s-]*less\b/gi, reason: TAMPER_REASON, suggestion: COMPLIANT },
  { rule: 'emissions_off', severity: 'block', pattern: /\b(?:emissions?[\s-]*(?:free|gone|off)|no[\s-]*emissions?[\s-]*(?:equipment|system|parts))\b/gi, reason: TAMPER_REASON, suggestion: COMPLIANT },
  { rule: 'defeat_device', severity: 'block', pattern: /\b(?:defeat[\s-]*devices?|tamper(?:ing|ed)?)\b/gi, reason: 'Defeat-device / tampering language.', suggestion: COMPLIANT },
  { rule: 'regen_off', severity: 'block', pattern: /\b(?:turn(?:s|ed|ing)?|shut(?:s|ting)?|disabl\w*)[\s-]*off[\s-]*(?:the[\s-]*)?(?:regen|dpf|egr|def|emissions?)\b|\b(?:disabl\w*|kill\w*|stop\w*)[\s-]*(?:the[\s-]*)?(?:regens?|dpf|egr|def)\b/gi, reason: TAMPER_REASON, suggestion: COMPLIANT },
  { rule: 'rolling_coal', severity: 'block', pattern: /\brol(?:l|ling)[\s-]*coal\b/gi, reason: 'Rolling coal requires tampering and is illegal.' },
  { rule: 'no_inspection', severity: 'block', pattern: /\b(?:no|without|skip|pass|beat)[\s-]*(?:the[\s-]*)?(?:emissions?|smog)[\s-]*(?:inspections?|tests?|checks?|testing)\b/gi, reason: 'Implies tampering is fine because SC has no emissions inspection. Federal law still applies.' },
  { rule: 'race_only', severity: 'block', pattern: /\b(?:race|competition|off[\s-]*road)[\s-]*(?:use[\s-]*)?only\b(?=[\s\S]{0,80}\b(?:tun\w*|pipe|file|street|daily|highway)\b)|\b(?:tun\w*|files?|street|daily)\b[\s\S]{0,80}\b(?:race|competition|off[\s-]*road)[\s-]*(?:use[\s-]*)?only\b/gi, reason: '“Off-road/race only” paired with tuning or street use is a known tampering disclaimer that does not make it legal.', suggestion: 'Drop the disclaimer and market only street-legal parts.' },
  { rule: 'off_road_only', severity: 'warn', pattern: /\b(?:race|competition|off[\s-]*road)[\s-]*(?:use[\s-]*)?only\b/gi, reason: '“Off-road only” products cannot be marketed for street trucks.', suggestion: 'Confirm the product and the audience with the owner.' },
  { rule: 'tuning_claim', severity: 'warn', pattern: /\btun(?:e[ds]?|er|ers|ing)\b/gi, reason: 'Tuning copy: confirm the tune is EPA-compliant or CARB EO-numbered.' },
  { rule: 'power_gain', severity: 'warn', pattern: /(?:\+\s?\d{2,3}\s?(?:hp|whp|horsepower|lb[\s-]?ft|ft[\s-]?lbs?|torque)\b|\b\d{2,3}\s?(?:hp|whp|horsepower)\s+(?:gains?|increase|more)\b|\b(?:more|extra|big|huge)\s+(?:power|hp|horsepower|torque)\b|\bgains\b)/gi, reason: 'Power claims need real dyno data for this truck and a compliant tune.' },
  { rule: 'legal_claim', severity: 'warn', pattern: /\b(?:epa[\s-]*(?:compliant|legal|approved|certified)|carb[\s-]*(?:eo|legal|approved|compliant|exempt)|50[\s-]*state[\s-]*legal|street[\s-]*legal|smog[\s-]*legal|sema[\s-]*verified)\b/gi, reason: 'Compliance claims need documentation (CARB EO number or SEMA verification) on file.' },
  { rule: 'guarantee', severity: 'warn', pattern: /\b(?:guarantee[ds]?|100%\s*(?:safe|reliable)|never\s+(?:break|fail)s?|no\s+risk)\b/gi, reason: 'Absolute guarantees are misleading unless written warranty terms back them.' },
];

const LEET: Record<string, string> = { '3': 'e', '0': 'o', '1': 'i', '4': 'a', '@': 'a', $: 's' };

/** Normalises dashes/whitespace and dotted acronyms (d.p.f → dpf). Keeps string length stable where possible. */
function normalize(text: string): string {
  return text
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/\b([a-z])\.([a-z])\.([a-z])\.?/gi, '$1$2$3')
    .replace(/\s+/g, ' ');
}

/** Second pass that undoes simple evasion (d3lete, dpf-d3l3te). Only used for blocking rules. */
function deLeet(text: string): string {
  return text.replace(/[a-z][3014@$]+[a-z]|[3014@$][a-z]{2,}/gi, (chunk) => chunk.replace(/[3014@$]/g, (c) => LEET[c] ?? c));
}

function scan(text: string, rules: readonly ClaimRule[], issues: ClaimIssue[], seen: Set<string>): void {
  for (const rule of rules) {
    for (const found of text.matchAll(rule.pattern)) {
      const key = `${rule.rule}:${found.index}`;
      if (seen.has(key)) continue;
      seen.add(key);
      issues.push({ severity: rule.severity, rule: rule.rule, match: found[0], index: found.index ?? 0, reason: rule.reason, suggestion: rule.suggestion });
    }
  }
}

export function checkClaims(text: string): ClaimsResult {
  const issues: ClaimIssue[] = [];
  const seen = new Set<string>();
  const normalized = normalize(text ?? '');
  scan(normalized, RULES, issues, seen);
  const blockRules = RULES.filter((r) => r.severity === 'block');
  scan(deLeet(normalized), blockRules, issues, seen);

  // A specific block (e.g. `dpf delete`) makes the generic `deleted_generic` hit at the same spot redundant.
  const blocks = issues.filter((i) => i.severity === 'block' && i.rule !== 'deleted_generic');
  const deduped = issues.filter((issue) => {
    if (issue.rule === 'deleted_generic') {
      return !blocks.some((b) => issue.index >= b.index && issue.index < b.index + b.match.length);
    }
    if (issue.rule === 'off_road_only') return !issues.some((i) => i.rule === 'race_only');
    return true;
  });
  deduped.sort((a, b) => a.index - b.index);

  const score = Math.min(100, deduped.reduce((sum, i) => sum + (i.severity === 'block' ? 40 : 10), 0));
  const risk = deduped.some((i) => i.severity === 'block') ? 'fail' : deduped.length ? 'warn' : 'pass';
  return { risk, score, issues: deduped };
}

// ─── Inbound SMS keywords ───────────────────────────────────────────────────
export type InboundIntent = 'stop' | 'start' | 'help' | 'other';

const STOP_WORDS = new Set(['STOP', 'STOPALL', 'STOP ALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT', 'OPTOUT', 'OPT OUT', 'REVOKE']);
const START_WORDS = new Set(['START', 'UNSTOP', 'SUBSCRIBE', 'OPTIN', 'OPT IN']);
const HELP_WORDS = new Set(['HELP', 'INFO']);
/** Opt-out “by any reasonable means” (FCC, in force 2025-04-11). */
const NATURAL_STOP = /\b(?:(?:stop|quit|no more|don'?t|do not|never)\b[\w\s']{0,20}\b(?:text|texting|txt|messag\w*|sms|contact\w*|call\w*)|(?:remove|take)\s+me\s+(?:off|from)|unsubscribe|leave me alone|wrong number|opt\s*out)\b/i;

export function classifyInboundSms(body: string): InboundIntent {
  const keyword = body.trim().toUpperCase().replace(/[^A-Z ]/g, '').replace(/\s+/g, ' ').trim();
  if (STOP_WORDS.has(keyword)) return 'stop';
  if (START_WORDS.has(keyword)) return 'start';
  if (HELP_WORDS.has(keyword)) return 'help';
  if (NATURAL_STOP.test(body)) return 'stop';
  return 'other';
}

/** SC TPPA: the business name in every marketing text; CTIA: opt-out language. */
export function ensureMarketingSms(body: string, businessName: string): string {
  let text = body.trim();
  if (!text.toLowerCase().includes(businessName.toLowerCase())) text = `${businessName}: ${text}`;
  if (!/\bstop\b/i.test(text)) text = `${text} Reply STOP to opt out.`;
  return text;
}

/** CAN-SPAM footer: identity, postal address and a working unsubscribe link. */
export function marketingEmailFooter(options: { senderName: string; postalAddress: string | null; unsubscribeUrl: string }): string {
  const lines = ['—', `You're receiving this from ${options.senderName} because you're a customer or asked to hear from us.`];
  if (options.postalAddress) lines.push(options.postalAddress);
  lines.push(`Unsubscribe: ${options.unsubscribeUrl}`);
  return lines.join('\n');
}

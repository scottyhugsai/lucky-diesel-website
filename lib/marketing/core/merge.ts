/**
 * Conditional merge sections for campaign copy. Pure.
 *
 *   {{#if platform=cummins}}Cummins owners…{{else}}Everyone else…{{/if}}
 *   {{#if vip}}VIP early access.{{/if}}
 *   {{#unless vip}}Join the club.{{/unless}}
 *   {{#if platform=duramax|powerstroke}}…{{/if}}
 *
 * Run before `renderTemplate` fills {{placeholders}}.
 */

export type ConditionFacts = Record<string, string | null | undefined>;

export const CONDITION_KEYS = ['platform', 'stage', 'tier', 'vip', 'fleet'] as const;

const FALSY = new Set(['', 'no', 'false', '0', 'none']);
const SECTION = /\{\{\s*#(if|unless)\s+([^}]{1,80}?)\s*\}\}((?:(?!\{\{\s*#(?:if|unless)\b)[\s\S])*?)\{\{\s*\/\1\s*\}\}/i;
const ELSE = /\{\{\s*else\s*\}\}/i;
const EXPRESSION = /^(!?)([a-z_]{1,30})\s*(?:(!=|=)\s*([a-z0-9_| -]{1,60}))?$/i;

/** Evaluates `key`, `!key`, `key=value`, `key!=a|b`. Unknown syntax is false. */
export function evaluateCondition(expression: string, facts: ConditionFacts): boolean {
  const match = EXPRESSION.exec(expression.trim());
  if (!match) return false;
  const [, negate, key, operator, expected] = match;
  const actual = (facts[key!.toLowerCase()] ?? '').toString().trim().toLowerCase();
  let result: boolean;
  if (!operator) result = !FALSY.has(actual);
  else {
    const options = expected!.split('|').map((o) => o.trim().toLowerCase()).filter(Boolean);
    result = options.includes(actual);
    if (operator === '!=') result = !result;
  }
  return negate ? !result : result;
}

/** Resolves every {{#if}}/{{#unless}} section, innermost first. */
export function renderConditionals(template: string, facts: ConditionFacts): string {
  let output = template;
  for (let i = 0; i < 20; i += 1) {
    const found = SECTION.exec(output);
    if (!found) break;
    const [whole, kind, expression, inner] = found;
    const [whenTrue, whenFalse = ''] = inner!.split(ELSE);
    const passes = evaluateCondition(expression!, facts);
    const chosen = (kind!.toLowerCase() === 'if' ? passes : !passes) ? whenTrue! : whenFalse;
    output = output.slice(0, found.index) + chosen + output.slice(found.index + whole.length);
  }
  return output.replace(/\n{3,}/g, '\n\n');
}

/** Facts for one recipient. `vip` is "yes" for the VIP stage or a full-build tier. */
export function conditionFacts(input: { platform?: string | null; stage?: string | null; tier?: string | null; isFleet?: boolean | null }): ConditionFacts {
  const vip = input.stage === 'vip' || input.tier === 'full_build';
  return { platform: input.platform ?? '', stage: input.stage ?? '', tier: input.tier ?? '', vip: vip ? 'yes' : '', fleet: input.isFleet ? 'yes' : '' };
}

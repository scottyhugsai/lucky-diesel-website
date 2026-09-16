/** Placeholder values available to message templates, e.g. "Hi {{first_name}}". */
export type TemplateVars = Record<string, string | number | null | undefined>;

const PLACEHOLDER = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;

/** Replaces {{name}} placeholders. Unknown or empty values render as nothing. */
export function renderTemplate(template: string, vars: TemplateVars): string {
  return template
    .replace(PLACEHOLDER, (_match, key: string) => {
      const value = vars[key.toLowerCase()];
      return value === null || value === undefined ? '' : String(value);
    })
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/** Placeholders referenced by a template, for showing the owner what's available. */
export function templatePlaceholders(template: string): string[] {
  return [...new Set([...template.matchAll(PLACEHOLDER)].map((match) => match[1]!.toLowerCase()))];
}

/** SMS segments: 160 GSM-7 characters, or 153 each when split. Unicode drops to 70/67. */
export function smsSegments(body: string): number {
  // eslint-disable-next-line no-control-regex
  const isGsm = /^[\x0A\x0D\x20-\x7E£¥èéùìòÇØøÅå_ÆæßÉ¡ÄÖÑÜ§¿äöñüà]*$/.test(body);
  const single = isGsm ? 160 : 70;
  const multi = isGsm ? 153 : 67;
  if (body.length <= single) return 1;
  return Math.ceil(body.length / multi);
}

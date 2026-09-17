import { lintTemplate, type ComplianceReport } from './compliance';

/** Template library input rules. Pure. */

export const TEMPLATE_CHANNELS = ['sms', 'email', 'social', 'review_reply', 'ad'] as const;
export type TemplateChannel = (typeof TEMPLATE_CHANNELS)[number];

export const TEMPLATE_CHANNEL_LABEL: Record<TemplateChannel, string> = { sms: 'Text', email: 'Email', social: 'Social', review_reply: 'Review reply', ad: 'Ad' };

const BODY_MAX: Record<TemplateChannel, number> = { sms: 480, email: 5000, social: 2200, review_reply: 1500, ad: 600 };
const TAG = /^[a-z0-9][a-z0-9-]{0,23}$/;

export interface TemplateInput {
  key: string;
  name: string;
  channel: TemplateChannel;
  subject: string | null;
  body: string;
  tags: string[];
}

export function templateKey(name: string): string {
  return name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '');
}

export function parseTemplateInput(raw: { key?: string; name: string; channel: string; subject: string; body: string; tags: string }): { ok: true; value: TemplateInput; report: ComplianceReport } | { ok: false; error: string } {
  const name = raw.name.trim();
  if (!name || name.length > 80) return { ok: false, error: 'Name is required (80 max).' };
  const channel = (TEMPLATE_CHANNELS as readonly string[]).includes(raw.channel) ? (raw.channel as TemplateChannel) : null;
  if (!channel) return { ok: false, error: 'Pick a channel.' };
  const body = raw.body.replace(/\r\n/g, '\n').trim();
  if (!body || body.length > BODY_MAX[channel]) return { ok: false, error: `Message is required (${BODY_MAX[channel]} characters max).` };
  const subject = raw.subject.trim() || null;
  if (channel === 'email' && !subject) return { ok: false, error: 'Emails need a subject.' };
  if (subject && subject.length > 200) return { ok: false, error: 'Subject is 200 characters max.' };
  const key = raw.key?.trim() || templateKey(name);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(key) || key.length > 60) return { ok: false, error: 'Use letters or numbers in the name.' };
  const tags = [...new Set(raw.tags.split(',').map((t) => t.trim().toLowerCase().replace(/\s+/g, '-')).filter(Boolean))];
  if (tags.length > 8 || tags.some((t) => !TAG.test(t))) return { ok: false, error: 'Up to 8 short tags, letters and numbers.' };
  const report = lintTemplate([subject, body]);
  if (report.status === 'block') return { ok: false, error: `Blocked: ${report.issues.filter((i) => i.severity === 'block').map((i) => i.reason).join(' ')}` };
  return { ok: true, value: { key, name, channel, subject: channel === 'email' ? subject : null, body, tags }, report };
}

export interface PolicyScanItem {
  id: string;
  label: string;
  kind: string;
  href: string;
  fields: (string | null)[];
}

/** Lints saved automation, campaign and library wording; returns only items with issues, blocks first. */
export function scanTemplates(items: readonly PolicyScanItem[]): (PolicyScanItem & { report: ComplianceReport })[] {
  return items
    .map((item) => ({ ...item, report: lintTemplate(item.fields) }))
    .filter((item) => item.report.status !== 'pass')
    .sort((a, b) => (a.report.status === b.report.status ? a.label.localeCompare(b.label) : a.report.status === 'block' ? -1 : 1));
}

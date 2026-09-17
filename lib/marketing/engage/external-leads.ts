/**
 * Pure mappers from third-party lead payloads (Meta Lead Ads, Google Ads lead
 * form assets, forwarded lead emails) to the fields our quote form collects.
 * The routes that call these verify signatures/keys first.
 */

export interface ExternalLead {
  name: string;
  email: string;
  phone: string;
  details: string;
  source: 'meta_lead_ads' | 'google_lead_form' | 'lead_email';
  externalId: string | null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function phone10(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  const national = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  return national.length === 10 ? `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}` : null;
}

function finish(fields: { name: string; email: string; phone: string; extra: string[] }, source: ExternalLead['source'], externalId: string | null): ExternalLead | null {
  const name = fields.name.trim().slice(0, 80);
  const email = fields.email.trim().toLowerCase();
  const phone = phone10(fields.phone);
  if (name.length < 2 || !EMAIL.test(email) || !phone) return null;
  const label = source === 'meta_lead_ads' ? 'Meta lead ad' : source === 'google_lead_form' ? 'Google lead form' : 'Forwarded lead email';
  const details = [`[${source}] ${label}`, ...fields.extra].join('\n').slice(0, 2000);
  return { name, email, phone, details, source, externalId };
}

const NAME_KEYS = ['full_name', 'name', 'first_name', 'last_name'];
const EMAIL_KEYS = ['email', 'email_address', 'work_email'];
const PHONE_KEYS = ['phone_number', 'phone', 'mobile_phone', 'work_phone'];

/** Meta Graph `/{leadgen_id}` → `field_data: [{ name, values: [] }]`. */
export function mapMetaLead(payload: unknown): ExternalLead | null {
  if (!payload || typeof payload !== 'object') return null;
  const v = payload as { id?: unknown; field_data?: unknown; ad_id?: unknown; form_id?: unknown };
  if (!Array.isArray(v.field_data)) return null;
  const map = new Map<string, string>();
  for (const field of v.field_data) {
    if (field && typeof field === 'object' && typeof field.name === 'string' && Array.isArray(field.values)) {
      map.set(field.name.toLowerCase(), field.values.filter((x: unknown) => typeof x === 'string').join(', ').slice(0, 300));
    }
  }
  const first = map.get('first_name');
  const last = map.get('last_name');
  const name = map.get('full_name') ?? map.get('name') ?? [first, last].filter(Boolean).join(' ');
  const extra = [...map.entries()].filter(([k]) => ![...NAME_KEYS, ...EMAIL_KEYS, ...PHONE_KEYS].includes(k)).map(([k, val]) => `${k.replace(/_/g, ' ')}: ${val}`);
  if (typeof v.ad_id === 'string') extra.push(`ad: ${v.ad_id}`);
  if (typeof v.form_id === 'string') extra.push(`form: ${v.form_id}`);
  return finish({
    name, email: EMAIL_KEYS.map((k) => map.get(k)).find(Boolean) ?? '', phone: PHONE_KEYS.map((k) => map.get(k)).find(Boolean) ?? '', extra,
  }, 'meta_lead_ads', typeof v.id === 'string' ? v.id : null);
}

/** Google Ads lead form webhook: `{ lead_id, google_key, campaign_id, user_column_data: [{ column_id, string_value }] }`. */
export function mapGoogleLead(payload: unknown): ExternalLead | null {
  if (!payload || typeof payload !== 'object') return null;
  const v = payload as { lead_id?: unknown; campaign_id?: unknown; user_column_data?: unknown };
  if (!Array.isArray(v.user_column_data)) return null;
  const map = new Map<string, string>();
  for (const col of v.user_column_data) {
    if (col && typeof col === 'object' && typeof col.column_id === 'string' && typeof col.string_value === 'string') map.set(col.column_id.toUpperCase(), col.string_value.slice(0, 300));
  }
  const name = map.get('FULL_NAME') ?? [map.get('FIRST_NAME'), map.get('LAST_NAME')].filter(Boolean).join(' ');
  const known = ['FULL_NAME', 'FIRST_NAME', 'LAST_NAME', 'EMAIL', 'PHONE_NUMBER'];
  const extra = [...map.entries()].filter(([k]) => !known.includes(k)).map(([k, val]) => `${k.toLowerCase().replace(/_/g, ' ')}: ${val}`);
  if (v.campaign_id !== undefined) extra.push(`campaign: ${String(v.campaign_id).slice(0, 40)}`);
  return finish({ name, email: map.get('EMAIL') ?? '', phone: map.get('PHONE_NUMBER') ?? '', extra }, 'google_lead_form', typeof v.lead_id === 'string' ? v.lead_id : null);
}

// Labels are hardcoded literals from the call sites below (never request data), so this
// cannot be driven by an attacker; the alternative would be ~20 duplicated literal regexes.
// nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
const LINE = (label: string) => new RegExp(`^\\s*(?:${label})\\s*[:\\-]\\s*(.+)$`, 'im');

/** Forwarded lead notification emails (Angi, Thumbtack, Nextdoor, Marketplace…) with "Name: / Phone: / Email:" lines. */
export function parseLeadEmail(input: { from: string; subject: string; text: string }): ExternalLead | null {
  const text = input.text.slice(0, 20_000);
  const pick = (label: string) => LINE(label).exec(text)?.[1]?.trim() ?? '';
  const platform = /angi|angie/i.test(`${input.from} ${input.subject}`) ? 'Angi'
    : /thumbtack/i.test(`${input.from} ${input.subject}`) ? 'Thumbtack'
      : /nextdoor/i.test(`${input.from} ${input.subject}`) ? 'Nextdoor'
        : /facebook|marketplace/i.test(`${input.from} ${input.subject}`) ? 'Facebook Marketplace' : 'Email';
  const message = pick('message|details|request|project|job description');
  const vehicle = pick('vehicle|truck');
  return finish({
    name: pick('name|customer name|customer|full name'),
    email: pick('email|e-mail|email address'),
    phone: pick('phone|phone number|mobile|cell'),
    extra: [`platform: ${platform}`, `subject: ${input.subject.slice(0, 150)}`, ...(vehicle ? [`truck: ${vehicle}`] : []), ...(message ? [message.slice(0, 1000)] : [])],
  }, 'lead_email', null);
}

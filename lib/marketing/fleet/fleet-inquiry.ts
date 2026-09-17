/**
 * Public fleet inquiry: parsing is pure (unit-tested), the write lands a
 * `prospect` fleet account. Prospects are never `active`, so net terms and
 * priority bays stay off until the owner promotes the account.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export interface FleetInquiry {
  name: string;
  contactName: string;
  email: string;
  phone: string;
  truckCount: number | null;
  city: string | null;
  notes: string | null;
}

export type InquiryField = 'name' | 'contactName' | 'email' | 'phone' | 'truckCount';

export type ParsedInquiry =
  | { ok: true; value: FleetInquiry }
  | { ok: false; spam: true }
  | { ok: false; spam?: false; errors: Partial<Record<InquiryField, string>> };

function digitsOnly(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  const local = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  return local.length === 10 ? `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}` : null;
}

/** Company, contact, email and phone are required; truck count and city are optional. */
export function parseFleetInquiry(body: unknown): ParsedInquiry {
  if (!body || typeof body !== 'object') return { ok: false, errors: { name: 'Invalid request.' } };
  const v = body as Record<string, unknown>;
  const str = (key: string, max: number) => (typeof v[key] === 'string' ? (v[key] as string).trim().slice(0, max) : '');

  // Honeypot: bots fill the hidden field, so answer as if it went through.
  if (str('company', 100)) return { ok: false, spam: true };

  const errors: Partial<Record<InquiryField, string>> = {};
  const name = str('name', 120);
  if (name.length < 2) errors.name = 'Enter your company name.';

  const contactName = str('contactName', 120);
  if (contactName.length < 2) errors.contactName = 'Enter your name.';

  const email = str('email', 254).toLowerCase();
  if (!EMAIL.test(email)) errors.email = 'Enter a valid email.';

  const phone = digitsOnly(str('phone', 40));
  if (!phone) errors.phone = 'Enter a 10-digit phone number.';

  const trucksRaw = str('truckCount', 12).replace(/,/g, '');
  let truckCount: number | null = null;
  if (trucksRaw) {
    const parsed = Number(trucksRaw);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100_000) errors.truckCount = 'Enter a whole number.';
    else truckCount = parsed;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { name, contactName, email, phone: phone!, truckCount, city: str('city', 80) || null, notes: str('notes', 1000) || null } };
}

/** What lands in `fleet_accounts`. Kept separate from the DB call so it is testable. */
export function inquiryRow(input: FleetInquiry, source = 'fleet') {
  return {
    name: input.name,
    contact_name: input.contactName,
    email: input.email,
    phone: input.phone,
    truck_count: input.truckCount,
    city: input.city,
    notes: input.notes,
    stage: 'prospect' as const,
    source,
    active: false,
  };
}

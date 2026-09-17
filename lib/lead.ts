import { EMAIL_SYNTAX, suggestEmailFix } from './marketing/core/email-typo';
import { cleanVin, parseHeardAbout } from './marketing/engage/rules';
import { OTHER_PLATFORM, OTHER_SERVICE, PLATFORMS, SERVICES } from './site';

/** Shared by the form (client) and the API route (server). */

/** Shown beside the opt-in checkbox. Bump the version whenever the wording changes. */
export const SMS_CONSENT_VERSION = '2026-09-16';
export const SMS_CONSENT_TEXT =
  'I agree to receive text messages from Lucky Diesel LLC about my service request, appointments, estimates, job status and service reminders at the number provided. Message frequency varies. Msg & data rates may apply. Reply STOP to opt out, HELP for help. Consent is not a condition of purchase.';

export interface Lead {
  name: string;
  phone: string;
  email: string;
  platformLabel: string;
  mileage: string;
  serviceLabel: string;
  details: string;
  platformId: string;
  serviceId: string;
  smsConsent: boolean;
  /** Self-reported "How did you hear about us?" option id. */
  heardAbout?: string | null;
  /** 17-character VIN when the visitor entered one. */
  vin?: string | null;
}

export type LeadField = 'name' | 'phone' | 'email' | 'platform' | 'generation' | 'service' | 'details';

export type ParseResult =
  | { ok: true; lead: Lead }
  | { ok: false; spam: boolean; errors: Partial<Record<LeadField, string>> };

const MAX_NAME = 80;
const MAX_MILEAGE = 20;
const MIN_DETAILS = 5;
const MAX_DETAILS = 2000;

function text(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  return typeof value === 'string' ? value.trim() : '';
}

function formatPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  const local = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (local.length !== 10) return null;
  return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
}

function describePlatform(
  platformId: string,
  generation: string,
): { label: string } | { error: LeadField; message: string } {
  if (platformId === OTHER_PLATFORM) return { label: 'Other truck / engine' };

  const platform = PLATFORMS.find((p) => p.id === platformId);
  if (!platform) return { error: 'platform', message: 'Pick your truck.' };
  if (!generation) return { label: platform.name };
  if (!platform.generations.includes(generation)) {
    return { error: 'generation', message: `Pick a ${platform.name} engine from the list.` };
  }
  return { label: `${platform.name} — ${generation}` };
}

export function parseLead(input: unknown): ParseResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, spam: false, errors: { name: 'Something went wrong. Please try again.' } };
  }
  const source = input as Record<string, unknown>;

  if (text(source, 'company')) return { ok: false, spam: true, errors: {} };

  const errors: Partial<Record<LeadField, string>> = {};

  const name = text(source, 'name');
  if (name.length < 2 || name.length > MAX_NAME) errors.name = 'Enter your name.';

  const phone = formatPhone(text(source, 'phone'));
  if (!phone) errors.phone = 'Enter a 10-digit phone number.';

  const email = text(source, 'email');
  if (!EMAIL_SYNTAX.test(email)) {
    errors.email = 'Enter a valid email.';
  } else {
    // A near-miss on a common domain is worth flagging: the lead is useless if the email bounces.
    const suggestion = suggestEmailFix(email);
    if (suggestion) errors.email = `Did you mean ${suggestion}?`;
  }

  const platform = describePlatform(text(source, 'platform'), text(source, 'generation'));
  if ('error' in platform) errors[platform.error] = platform.message;

  const serviceId = text(source, 'service');
  const service = SERVICES.find((s) => s.id === serviceId);
  if (!service && serviceId !== OTHER_SERVICE) errors.service = 'Pick the work you need.';

  const details = text(source, 'details');
  if (details.length < MIN_DETAILS) errors.details = 'Tell us a little about what’s going on.';
  if (details.length > MAX_DETAILS) errors.details = `Keep it under ${MAX_DETAILS} characters.`;

  if (Object.keys(errors).length > 0 || !phone || 'error' in platform) {
    return { ok: false, spam: false, errors };
  }

  return {
    ok: true,
    lead: {
      name,
      phone,
      email,
      platformLabel: platform.label,
      mileage: text(source, 'mileage').slice(0, MAX_MILEAGE),
      serviceLabel: service ? service.name : 'Other',
      details,
      platformId: text(source, 'platform'),
      serviceId: serviceId,
      smsConsent: source.smsConsent === true,
      heardAbout: parseHeardAbout(source.heardAbout),
      vin: cleanVin(source.vin),
    },
  };
}

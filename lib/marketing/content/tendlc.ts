/**
 * 10DLC (A2P) registration helper: assembles Twilio brand + campaign fields
 * and checks that sample messages match the declared use case. Pure; the
 * registration itself happens in the Twilio console.
 */

export const TENDLC_USE_CASES = ['MIXED', 'MARKETING', 'CUSTOMER_CARE', 'ACCOUNT_NOTIFICATION', 'LOW_VOLUME'] as const;
export type TendlcUseCase = (typeof TENDLC_USE_CASES)[number];
export const TENDLC_USE_CASE_LABEL: Record<TendlcUseCase, string> = {
  MIXED: 'Mixed (service + promos)',
  MARKETING: 'Marketing',
  CUSTOMER_CARE: 'Customer care',
  ACCOUNT_NOTIFICATION: 'Account notifications',
  LOW_VOLUME: 'Low volume mixed',
};

export const BUSINESS_TYPES = ['LLC', 'Corporation', 'Partnership', 'Sole Proprietor', 'Non-profit'] as const;

export interface TendlcProfile {
  legalName: string;
  businessType: string;
  ein: string;
  website: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  useCase: TendlcUseCase;
  description: string;
  messageFlow: string;
  privacyUrl: string;
  termsUrl: string;
  helpMessage: string;
  optOutMessage: string;
  samples: string[];
}

export const PROFILE_TEXT_KEYS = ['legalName', 'businessType', 'ein', 'website', 'street', 'city', 'state', 'postalCode', 'contactName', 'contactEmail', 'contactPhone', 'description', 'messageFlow', 'privacyUrl', 'termsUrl', 'helpMessage', 'optOutMessage'] as const;
const MAX_FIELD = 1024;
export const MAX_SAMPLES = 5;

export interface TendlcDefaults {
  legalName: string;
  brandName: string;
  website: string;
  city: string;
  state: string;
  contactEmail: string;
  contactPhone: string;
  consentText: string;
  quoteUrl: string;
  privacyUrl: string;
  termsUrl: string;
  samples: string[];
}

export function defaultProfile(d: TendlcDefaults): TendlcProfile {
  return {
    legalName: d.legalName, businessType: 'LLC', ein: '', website: d.website, street: '', city: d.city, state: d.state, postalCode: '',
    contactName: '', contactEmail: d.contactEmail, contactPhone: d.contactPhone, useCase: 'MIXED',
    description: `${d.brandName} is a diesel truck repair shop in ${d.city}, ${d.state}. We text customers who opted in about service requests, appointments, job status and reminders, plus occasional service offers.`,
    messageFlow: `Customers opt in on our website form (${d.quoteUrl}) by checking an unchecked box next to this text: "${d.consentText}" Staff can also record consent given in person. Opt-in is never required to buy.`,
    privacyUrl: d.privacyUrl, termsUrl: d.termsUrl,
    helpMessage: `${d.brandName}: for help call ${d.contactPhone} or email ${d.contactEmail}. Msg & data rates may apply. Reply STOP to opt out.`,
    optOutMessage: `${d.brandName}: you're unsubscribed and won't get more texts. Reply START to resubscribe.`,
    samples: d.samples.slice(0, MAX_SAMPLES),
  };
}

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value.slice(0, MAX_FIELD) : fallback;
}

/** Stored JSON → profile, filling gaps from defaults. */
export function readProfile(stored: unknown, defaults: TendlcProfile): TendlcProfile {
  const raw = stored && typeof stored === 'object' && !Array.isArray(stored) ? (stored as Record<string, unknown>) : {};
  const profile = { ...defaults };
  for (const key of PROFILE_TEXT_KEYS) profile[key] = text(raw[key], defaults[key]);
  profile.useCase = (TENDLC_USE_CASES as readonly string[]).includes(raw.useCase as string) ? (raw.useCase as TendlcUseCase) : defaults.useCase;
  profile.samples = Array.isArray(raw.samples) ? raw.samples.filter((s): s is string => typeof s === 'string' && s.trim() !== '').map((s) => s.slice(0, MAX_FIELD)).slice(0, MAX_SAMPLES) : defaults.samples;
  return profile;
}

const PROMO = /\b(offer|deal|special|save|% off|\$\d+ off|discount|sale|promo|book now|due for|win[\s-]?back|it'?s been|come back|limited)\b/i;
const LINK = /https?:\/\/|\b[a-z0-9-]+\.(com|net|org|co|us)\b/i;
const PHONE = /\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/;

export function isPromotional(sample: string): boolean {
  return PROMO.test(sample);
}

export interface TendlcIssue {
  field: string;
  message: string;
}

export function validateProfile(p: TendlcProfile, brandName: string): TendlcIssue[] {
  const issues: TendlcIssue[] = [];
  const need = (field: keyof TendlcProfile, label: string) => {
    if (!String(p[field]).trim()) issues.push({ field, message: `${label} is required.` });
  };
  need('legalName', 'Legal name'); need('website', 'Website'); need('street', 'Street address'); need('city', 'City'); need('state', 'State'); need('postalCode', 'ZIP');
  need('contactName', 'Contact name'); need('contactEmail', 'Contact email'); need('contactPhone', 'Contact phone'); need('privacyUrl', 'Privacy policy URL');
  if (p.businessType !== 'Sole Proprietor' && !/^\d{2}-?\d{7}$/.test(p.ein.trim())) issues.push({ field: 'ein', message: 'EIN must be 9 digits (XX-XXXXXXX), matching IRS records.' });
  if (p.postalCode.trim() && !/^\d{5}(-\d{4})?$/.test(p.postalCode.trim())) issues.push({ field: 'postalCode', message: 'ZIP must be 5 digits.' });
  if (p.description.trim().length < 40) issues.push({ field: 'description', message: 'Describe the campaign in at least 40 characters.' });
  if (!/opt[\s-]?in|consent|agree/i.test(p.messageFlow) || !LINK.test(p.messageFlow)) issues.push({ field: 'messageFlow', message: 'Opt-in flow must explain how consent is collected and include the form URL.' });
  if (!/stop/i.test(p.messageFlow) || !/rates may apply/i.test(p.messageFlow)) issues.push({ field: 'messageFlow', message: 'Quote the consent text with STOP and “Msg & data rates may apply”.' });
  if (!p.helpMessage.includes(brandName) || !PHONE.test(p.helpMessage) && !/@/.test(p.helpMessage)) issues.push({ field: 'helpMessage', message: 'HELP reply needs the brand name and a phone or email.' });
  if (!p.optOutMessage.includes(brandName) || !/unsubscribed|no more|won'?t (get|receive)/i.test(p.optOutMessage)) issues.push({ field: 'optOutMessage', message: 'STOP reply needs the brand name and confirm no more texts.' });

  if (p.samples.length < 2) issues.push({ field: 'samples', message: 'Add at least 2 sample messages.' });
  p.samples.forEach((s, i) => {
    if (!s.includes(brandName)) issues.push({ field: `samples.${i}`, message: `Sample ${i + 1} must name ${brandName}.` });
    if (/\{\{/.test(s)) issues.push({ field: `samples.${i}`, message: `Sample ${i + 1} still has {{tokens}}; use real example values.` });
  });
  if (p.samples.length && !p.samples.some((s) => /reply stop|text stop|stop to (opt out|end|unsubscribe)/i.test(s))) issues.push({ field: 'samples', message: 'At least one sample must show “Reply STOP to opt out”.' });

  const promos = p.samples.filter(isPromotional).length;
  const service = p.samples.length - promos;
  if ((p.useCase === 'CUSTOMER_CARE' || p.useCase === 'ACCOUNT_NOTIFICATION') && promos) issues.push({ field: 'useCase', message: `${promos} sample(s) look promotional. Pick Mixed or Marketing, or remove them.` });
  if (p.useCase === 'MARKETING' && !promos) issues.push({ field: 'useCase', message: 'Marketing use case needs promotional samples.' });
  if ((p.useCase === 'MIXED' || p.useCase === 'LOW_VOLUME') && p.samples.length >= 2 && (!promos || !service)) issues.push({ field: 'useCase', message: 'Mixed use case needs both service and promotional samples.' });
  return issues;
}

export function sampleFlags(samples: readonly string[]): { embeddedLinks: boolean; embeddedPhone: boolean } {
  return { embeddedLinks: samples.some((s) => LINK.test(s)), embeddedPhone: samples.some((s) => PHONE.test(s)) };
}

/** Plain-text packet laid out like the Twilio console forms, for copy/paste. */
export function tendlcPacket(p: TendlcProfile): string {
  const flags = sampleFlags(p.samples);
  const lines = [
    'A2P 10DLC REGISTRATION PACKET',
    '',
    '== Brand (Customer Profile) ==',
    `Legal business name: ${p.legalName}`,
    `Business type: ${p.businessType}`,
    `EIN: ${p.ein}`,
    `Website: ${p.website}`,
    `Address: ${p.street}, ${p.city}, ${p.state} ${p.postalCode}`,
    `Vertical: Automotive`,
    `Authorized contact: ${p.contactName} · ${p.contactEmail} · ${p.contactPhone}`,
    '',
    '== Campaign ==',
    `Use case: ${p.useCase}`,
    `Description: ${p.description}`,
    `Message flow / opt-in: ${p.messageFlow}`,
    `Privacy policy: ${p.privacyUrl}`,
    `Terms: ${p.termsUrl}`,
    `Embedded links: ${flags.embeddedLinks ? 'Yes' : 'No'}`,
    `Embedded phone numbers: ${flags.embeddedPhone ? 'Yes' : 'No'}`,
    'Opt-in keywords: START, YES',
    'Opt-out keywords: STOP, STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT',
    'Help keywords: HELP, INFO',
    `Help message: ${p.helpMessage}`,
    `Opt-out message: ${p.optOutMessage}`,
    '',
    '== Sample messages ==',
    ...p.samples.map((s, i) => `${i + 1}. ${s}`),
  ];
  return lines.join('\n');
}

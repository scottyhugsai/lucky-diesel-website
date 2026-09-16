/* Emissions & performance acknowledgement. Pure: shared by the signing form (preview) and the server action (record). */

export const ACK_TEMPLATE_VERSION = '2026-09-16';

const ACK_TRIGGER = /\b(tun(e|es|ed|ing)|calibrat\w*|ez-?lynk|exhaust|turbo\w*)\b/i;

/** Jobs touching the tune, exhaust or turbo need a signed acknowledgement. */
export function needsAcknowledgement(title: string, descriptions: readonly string[]): boolean {
  return [title, ...descriptions].some((text) => ACK_TRIGGER.test(text));
}

export const INTENDED_USES = {
  street: 'Driven on public roads (daily driving, work and/or towing)',
  offroad: 'Used off-highway or in sanctioned competition only, and not driven on public roads',
} as const;

export type IntendedUse = keyof typeof INTENDED_USES;

export function isIntendedUse(value: unknown): value is IntendedUse {
  return typeof value === 'string' && Object.hasOwn(INTENDED_USES, value);
}

export interface AcknowledgementSubject {
  vehicle: string;
  vin: string | null;
  jobNumber: number;
  jobTitle: string;
  items: readonly string[];
}

export function acknowledgementBody(subject: AcknowledgementSubject, use: IntendedUse): string {
  const work = subject.items.length ? subject.items.join('; ') : subject.jobTitle;
  return [
    `Lucky Diesel emissions & performance acknowledgement (version ${ACK_TEMPLATE_VERSION})`,
    '',
    `Vehicle: ${subject.vehicle}${subject.vin ? ` · VIN ${subject.vin}` : ''}`,
    `Job #${subject.jobNumber}: ${subject.jobTitle}`,
    `Work covered: ${work}`,
    '',
    '1. I understand this work involves engine calibration, exhaust and/or turbocharger components that can affect my vehicle’s emissions controls, emissions-related warranty and inspection results.',
    '2. Lucky Diesel has reviewed with me the manufacturer’s emissions labeling for the parts and calibrations in this job, including any that are labeled for off-highway or competition use only.',
    `3. Intended use: ${INTENDED_USES[use]}. I will use each part and calibration only as its manufacturer’s labeling allows.`,
    '4. I am responsible for how this vehicle is used and for keeping it compliant with the federal, state and local laws that apply where I drive it, including any emissions inspections.',
    '5. Lucky Diesel does not represent that this work meets the emissions requirements of any particular state or locality.',
  ].join('\n');
}

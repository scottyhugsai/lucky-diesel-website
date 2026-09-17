/* Validates the campaign builder payload. Everything from the browser is untrusted. */

import { MARKETING_EVENTS } from '@/lib/marketing/core/events';

export const CAMPAIGN_KINDS = ['broadcast', 'drip', 'lifecycle'] as const;
export const CAMPAIGN_CHANNELS = ['email', 'sms'] as const;
export const EXIT_OPTIONS = ['booked', 'replied', 'unsubscribed'] as const;
export const BODY_MAX = 1600;
export const SUBJECT_MAX = 150;
export const MAX_STEPS = 8;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_DELAY_MINUTES = 365 * 24 * 60;

export interface StepDraft {
  order: number;
  variant: 'A' | 'B';
  delayMinutes: number;
  subject: string;
  body: string;
}

export interface CampaignDraft {
  name: string;
  kind: (typeof CAMPAIGN_KINDS)[number];
  channel: (typeof CAMPAIGN_CHANNELS)[number];
  segmentId: string | null;
  triggerEvent: string | null;
  steps: StepDraft[];
  abPercent: number;
  abMetric: 'click' | 'booking';
  abDecideAfterMinutes: number;
  windowStart: number;
  windowEnd: number;
  exitOn: string[];
  seasonalKey: string | null;
}

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const int = (value: unknown, min: number, max: number): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max ? value : null;
const str = (value: unknown, max: number): string | null => (typeof value === 'string' && value.trim().length <= max ? value.trim() : null);

export function parseSteps(raw: unknown, channel: CampaignDraft['channel'], kind: CampaignDraft['kind']): Parsed<StepDraft[]> {
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, error: 'Write a message first.' };
  if (raw.length > MAX_STEPS * 2) return { ok: false, error: `At most ${MAX_STEPS} steps.` };
  const steps: StepDraft[] = [];
  for (const item of raw) {
    const s = (item ?? {}) as Record<string, unknown>;
    const order = int(s.order, 1, MAX_STEPS);
    const variant = s.variant === 'A' || s.variant === 'B' ? s.variant : null;
    const delay = int(s.delayMinutes, 0, MAX_DELAY_MINUTES);
    const subject = str(s.subject ?? '', SUBJECT_MAX);
    const body = str(s.body, BODY_MAX);
    if (order === null || !variant || delay === null) return { ok: false, error: 'A step is malformed.' };
    if (subject === null) return { ok: false, error: `Subjects must be ${SUBJECT_MAX} characters or fewer.` };
    if (!body) return { ok: false, error: `Step ${order}${variant === 'B' ? ' variant B' : ''} needs a message (max ${BODY_MAX}).` };
    if (channel === 'email' && !subject) return { ok: false, error: `Step ${order}${variant === 'B' ? ' variant B' : ''} needs a subject.` };
    steps.push({ order, variant, delayMinutes: kind === 'broadcast' ? 0 : delay, subject: channel === 'email' ? subject : '', body });
  }
  if (kind === 'broadcast' && steps.some((s) => s.order !== 1)) return { ok: false, error: 'Broadcasts send one message.' };
  const keys = new Set(steps.map((s) => `${s.order}:${s.variant}`));
  if (keys.size !== steps.length) return { ok: false, error: 'Duplicate steps.' };
  if (steps.some((s) => s.variant === 'B' && !keys.has(`${s.order}:A`))) return { ok: false, error: 'Variant B needs a variant A.' };
  return { ok: true, value: steps.sort((a, b) => a.order - b.order || a.variant.localeCompare(b.variant)) };
}

export function parseCampaignDraft(json: string): Parsed<CampaignDraft> {
  let raw: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object') return { ok: false, error: 'Campaign data is missing.' };
    raw = parsed as Record<string, unknown>;
  } catch {
    return { ok: false, error: 'Campaign data is not valid.' };
  }
  const name = str(raw.name, 120);
  if (!name) return { ok: false, error: 'Name the campaign (max 120 characters).' };
  const kind = CAMPAIGN_KINDS.find((k) => k === raw.kind);
  const channel = CAMPAIGN_CHANNELS.find((c) => c === raw.channel);
  if (!kind || !channel) return { ok: false, error: 'Pick a campaign type and channel.' };

  const segmentId = typeof raw.segmentId === 'string' && raw.segmentId ? raw.segmentId : null;
  if (segmentId && !UUID.test(segmentId)) return { ok: false, error: 'Pick a valid segment.' };
  const triggerEvent = typeof raw.triggerEvent === 'string' && raw.triggerEvent ? raw.triggerEvent : null;
  if (triggerEvent && !(MARKETING_EVENTS as readonly string[]).includes(triggerEvent)) return { ok: false, error: 'Pick a valid trigger.' };
  if (kind === 'broadcast' && !segmentId) return { ok: false, error: 'Pick who gets it.' };
  if (kind === 'lifecycle' && !triggerEvent) return { ok: false, error: 'Pick what starts it.' };
  if (kind === 'drip' && !segmentId && !triggerEvent) return { ok: false, error: 'Pick a segment or a trigger.' };

  const steps = parseSteps(raw.steps, channel, kind);
  if (!steps.ok) return steps;
  const hasB = steps.value.some((s) => s.variant === 'B');
  const abPercent = int(raw.abPercent, 0, 100);
  const abDecide = int(raw.abDecideAfterMinutes, 0, 7 * 24 * 60);
  const windowStart = int(raw.windowStart, 0, 23);
  const windowEnd = int(raw.windowEnd, 1, 24);
  if (abPercent === null || abDecide === null) return { ok: false, error: 'A/B settings are not valid.' };
  if (windowStart === null || windowEnd === null || windowEnd <= windowStart) return { ok: false, error: 'Send window must end after it starts.' };
  const exitOn = Array.isArray(raw.exitOn) ? raw.exitOn.filter((e): e is string => (EXIT_OPTIONS as readonly string[]).includes(String(e))) : [];
  const seasonalKey = typeof raw.seasonalKey === 'string' && /^[a-z_]{3,40}$/.test(raw.seasonalKey) ? raw.seasonalKey : null;

  return {
    ok: true,
    value: {
      name, kind, channel, segmentId, triggerEvent: kind === 'broadcast' ? null : triggerEvent, steps: steps.value,
      abPercent: hasB ? (kind === 'broadcast' ? Math.max(abPercent, 10) : 100) : 0,
      abMetric: raw.abMetric === 'booking' ? 'booking' : 'click', abDecideAfterMinutes: abDecide,
      windowStart, windowEnd, exitOn: [...new Set(exitOn)], seasonalKey,
    },
  };
}

/**
 * Pure send-policy rules for marketing: purpose detection, quiet hours, send
 * windows, frequency caps and address normalisation. No I/O, so it is safe to
 * import from the proxy, route handlers, the send path and tests.
 */

export type MessagePurpose = 'transactional' | 'marketing';

/** Automation keys that carry promotional content start with this prefix. */
export const MARKETING_AUTOMATION_PREFIX = 'mkt_';
/** `messages.automation_key` for campaign sends: `campaign:<uuid>`. */
export const CAMPAIGN_KEY_PREFIX = 'campaign:';

export const DEFAULT_TIME_ZONE = 'America/New_York';
/** TCPA / SC TPPA: no marketing texts before 8am or from 9pm, recipient local time. */
export const DEFAULT_QUIET_START_HOUR = 21;
export const DEFAULT_QUIET_END_HOUR = 8;

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

export function isMarketingAutomationKey(key: string | null | undefined): boolean {
  return Boolean(key && (key.startsWith(MARKETING_AUTOMATION_PREFIX) || key.startsWith(CAMPAIGN_KEY_PREFIX)));
}

export function campaignAutomationKey(campaignId: string): string {
  return `${CAMPAIGN_KEY_PREFIX}${campaignId}`;
}

/** Local hour and minute of an instant in a time zone. */
export function localClock(at: Date, timeZone = DEFAULT_TIME_ZONE): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: 'numeric', hourCycle: 'h23', timeZone }).formatToParts(at);
  const read = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { hour: read('hour'), minute: read('minute') };
}

export interface SendWindow {
  /** First allowed local hour (inclusive). */
  startHour: number;
  /** First disallowed local hour (exclusive). */
  endHour: number;
  timeZone?: string;
}

/** Quiet hours expressed as the complementary allowed window. */
export function quietHoursWindow(quietStart = DEFAULT_QUIET_START_HOUR, quietEnd = DEFAULT_QUIET_END_HOUR, timeZone = DEFAULT_TIME_ZONE): SendWindow {
  return { startHour: quietEnd, endHour: quietStart, timeZone };
}

/** Narrowest window allowed by both (e.g. campaign 9–20 inside legal 8–21). */
export function intersectWindows(a: SendWindow, b: SendWindow): SendWindow {
  const startHour = Math.max(a.startHour, b.startHour);
  const endHour = Math.max(startHour + 1, Math.min(a.endHour, b.endHour));
  return { startHour, endHour, timeZone: a.timeZone ?? b.timeZone };
}

export function isWithinWindow(at: Date, window: SendWindow): boolean {
  const { hour } = localClock(at, window.timeZone);
  return hour >= window.startHour && hour < window.endHour;
}

/** `at` if it is inside the window, otherwise the next window opening (on the hour). */
export function nextSendTime(at: Date, window: SendWindow): Date {
  if (isWithinWindow(at, window)) return at;
  const { hour, minute } = localClock(at, window.timeZone);
  const hoursAhead = hour >= window.endHour ? 24 - hour + window.startHour : window.startHour - hour;
  const candidate = new Date(at.getTime() + hoursAhead * 60 * MINUTE_MS - minute * MINUTE_MS);
  candidate.setUTCSeconds(0, 0);
  // DST transitions can land an hour off; nudge forward until inside.
  for (let i = 0; i < 3 && !isWithinWindow(candidate, window); i += 1) candidate.setTime(candidate.getTime() + 60 * MINUTE_MS);
  return candidate;
}

export interface FrequencyCap {
  maxPerWeek: number;
}

/** True when another marketing message on this channel would exceed the weekly cap. */
export function isCapReached(sentInLastWeek: number, cap: FrequencyCap): boolean {
  return sentInLastWeek >= cap.maxPerWeek;
}

export function weekAgo(now: Date): Date {
  return new Date(now.getTime() - 7 * DAY_MS);
}

/** E.164 for US numbers; `+<digits>` otherwise. Empty string when there are no digits. */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
}

/** The last 10 digits, for matching loosely formatted stored phones. */
export function phoneTail(phone: string): string {
  return phone.replace(/\D/g, '').slice(-10);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeAddress(channel: 'sms' | 'email', value: string): string {
  return channel === 'sms' ? normalizePhone(value) : normalizeEmail(value);
}

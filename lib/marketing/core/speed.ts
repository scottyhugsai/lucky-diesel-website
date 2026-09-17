/** Speed-to-lead rules: SLA escalation, stale deals, business hours, nudges. Pure. */

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export const OPEN_STATUSES = ['new', 'contacted', 'booked'] as const;

export function isOpenStatus(status: string): boolean {
  return (OPEN_STATUSES as readonly string[]).includes(status);
}

export interface CrmRules {
  slaFirstMinutes: number;
  slaBackupMinutes: number;
  hotScore: number;
  staleHours: number;
  unansweredHours: number;
  quoteNudgeDays: number;
}

export const DEFAULT_CRM_RULES: CrmRules = { slaFirstMinutes: 5, slaBackupMinutes: 15, hotScore: 70, staleHours: 48, unansweredHours: 2, quoteNudgeDays: 3 };

/** 0 = fine, 1 = owner alert due, 2 = backup alert due. Only untouched new leads escalate. */
export function slaLevel(lead: { status: string; createdAt: Date; contactedAt: Date | null }, now: Date, rules: Pick<CrmRules, 'slaFirstMinutes' | 'slaBackupMinutes'>): 0 | 1 | 2 {
  if (lead.status !== 'new' || lead.contactedAt) return 0;
  const waited = now.getTime() - lead.createdAt.getTime();
  if (waited >= rules.slaBackupMinutes * MINUTE_MS) return 2;
  if (waited >= rules.slaFirstMinutes * MINUTE_MS) return 1;
  return 0;
}

/** Only alert on leads from the last day, so an old backlog never floods the owner's phone. */
export const SLA_LOOKBACK_MS = DAY_MS;

export function minutesWaiting(createdAt: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / MINUTE_MS));
}

export function isSnoozed(snoozedUntil: Date | null, now: Date): boolean {
  return Boolean(snoozedUntil && snoozedUntil.getTime() > now.getTime());
}

/** Open deal with no activity for `staleHours`, not snoozed. */
export function isStale(lead: { status: string; lastActivityAt: Date; snoozedUntil: Date | null }, now: Date, staleHours: number): boolean {
  if (!isOpenStatus(lead.status) || isSnoozed(lead.snoozedUntil, now)) return false;
  return now.getTime() - lead.lastActivityAt.getTime() >= staleHours * HOUR_MS;
}

/** A snooze that ended in the last `withinMs` (the follow-up is due now). */
export function snoozeJustEnded(snoozedUntil: Date | null, now: Date, withinMs = 7 * DAY_MS): boolean {
  if (!snoozedUntil) return false;
  const since = now.getTime() - snoozedUntil.getTime();
  return since >= 0 && since < withinMs;
}

export interface ShopHours {
  openHour: number;
  closeHour: number;
  /** 0 = Sunday. */
  openDays: readonly number[];
  timeZone: string;
}

function localParts(at: Date, timeZone: string): { weekday: number; hour: number } {
  const parts = new Intl.DateTimeFormat('en-US', { weekday: 'short', hour: 'numeric', hourCycle: 'h23', timeZone }).formatToParts(at);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return { weekday: days.indexOf(parts.find((p) => p.type === 'weekday')?.value ?? 'Sun'), hour: Number(parts.find((p) => p.type === 'hour')?.value ?? 0) };
}

export function isShopOpen(at: Date, hours: ShopHours): boolean {
  const { weekday, hour } = localParts(at, hours.timeZone);
  return hours.openDays.includes(weekday) && hour >= hours.openHour && hour < hours.closeHour;
}

export const AUTO_REPLY_WINDOW_HOURS = 12;

/** Dedupe bucket so each number gets at most one after-hours reply per window. */
export function autoReplyBucket(phone: string, now: Date): string {
  return `${phone.replace(/\D/g, '').slice(-10)}:${Math.floor(now.getTime() / (AUTO_REPLY_WINDOW_HOURS * HOUR_MS))}`;
}

/** Quote nudge is due inside [expires - nudgeDays, expires). */
export function quoteNudgeDue(expiresAt: Date | null, now: Date, nudgeDays: number): boolean {
  if (!expiresAt) return false;
  const left = expiresAt.getTime() - now.getTime();
  return left > 0 && left <= nudgeDays * DAY_MS;
}

/** Nurture messages by lost reason: [days after lost, catalog key]. */
export const LOST_NURTURE: Readonly<Record<string, readonly (readonly [number, string])[]>> = {
  Price: [[30, 'mkt_lost_price_30d'], [90, 'mkt_lost_price_90d']],
  Timing: [[30, 'mkt_lost_timing_30d'], [90, 'mkt_lost_timing_90d']],
  'No response': [[30, 'mkt_lost_no_response_30d']],
  'Went elsewhere': [[90, 'mkt_lost_elsewhere_90d']],
};

const NURTURE_WINDOW_DAYS = 7;

/** The nurture key due for a lost lead now (within a week of its day mark), or null. */
export function lostNurtureDue(reason: string | null, lostAt: Date, now: Date): string | null {
  const steps = reason ? LOST_NURTURE[reason] : undefined;
  if (!steps) return null;
  const days = (now.getTime() - lostAt.getTime()) / DAY_MS;
  return steps.find(([mark]) => days >= mark && days < mark + NURTURE_WINDOW_DAYS)?.[1] ?? null;
}

export interface ThreadMessage {
  direction: 'inbound' | 'outbound';
  createdAt: Date;
  automationKey: string | null;
}

export const INBOX_REPLY_KEY = 'inbox_reply';

/** A person typed it (inbox reply or an untagged manual send), not an automation. */
export function isHumanReply(message: ThreadMessage): boolean {
  return message.direction === 'outbound' && (message.automationKey === null || message.automationKey === INBOX_REPLY_KEY);
}

/**
 * The customer's latest real message (not STOP/START/HELP) has no human reply
 * after it and is older than `hours`. Auto-replies don't count as answered.
 */
export function isUnanswered(messages: readonly ThreadMessage[], now: Date, hours: number): boolean {
  const sorted = [...messages].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const lastInbound = sorted.findLastIndex((m) => m.direction === 'inbound' && !m.automationKey?.startsWith('inbound:'));
  if (lastInbound < 0) return false;
  if (sorted.slice(lastInbound + 1).some(isHumanReply)) return false;
  return now.getTime() - sorted[lastInbound]!.createdAt.getTime() >= hours * HOUR_MS;
}

/** Waiting for us at all (any age): used for the inbox badge. */
export function awaitingReply(messages: readonly ThreadMessage[]): boolean {
  return isUnanswered(messages, new Date(8.64e15), 0);
}

/** Inbox: conversation grouping, thread keys and template reply suggestions. Pure. */

import { normalizeAddress } from './policy';
import { awaitingReply, isHumanReply, type ThreadMessage } from './speed';

export type InboxChannel = 'sms' | 'email';

export interface InboxMessage {
  id: string;
  channel: InboxChannel;
  direction: 'inbound' | 'outbound';
  address: string;
  body: string;
  subject: string | null;
  status: string;
  automationKey: string | null;
  customerId: string | null;
  createdAt: string;
}

export interface ThreadSummary {
  key: string;
  channel: InboxChannel;
  address: string;
  customerId: string | null;
  lastAt: string;
  preview: string;
  lastDirection: 'inbound' | 'outbound';
  count: number;
  awaitingReply: boolean;
}

const KEY = /^(sms|email):([^\s]{3,320})$/;

export function threadKey(channel: InboxChannel, address: string): string {
  return `${channel}:${normalizeAddress(channel, address)}`;
}

export function parseThreadKey(raw: unknown): { channel: InboxChannel; address: string } | null {
  if (typeof raw !== 'string') return null;
  const match = KEY.exec(raw.trim());
  if (!match) return null;
  const channel = match[1] as InboxChannel;
  const address = normalizeAddress(channel, match[2]!);
  if (channel === 'sms' && !/^\+\d{8,15}$/.test(address)) return null;
  if (channel === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(address)) return null;
  return { channel, address };
}

export function toThreadMessage(m: InboxMessage): ThreadMessage {
  return { direction: m.direction, createdAt: new Date(m.createdAt), automationKey: m.automationKey };
}

/**
 * Groups messages into customer conversations, newest first. Staff alerts
 * (to the owner or team) are dropped, as are outbound-only automated threads
 * with no customer record.
 */
export function messagesByThread(messages: readonly InboxMessage[], staffAddresses: ReadonlySet<string>): Map<string, InboxMessage[]> {
  const byKey = new Map<string, InboxMessage[]>();
  for (const m of messages) {
    const address = normalizeAddress(m.channel, m.address);
    if (!address || staffAddresses.has(address)) continue;
    const key = `${m.channel}:${address}`;
    byKey.set(key, [...(byKey.get(key) ?? []), m]);
  }
  for (const [key, list] of byKey) byKey.set(key, [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
  return byKey;
}

export function groupThreads(messages: readonly InboxMessage[], staffAddresses: ReadonlySet<string>): ThreadSummary[] {
  const threads: ThreadSummary[] = [];
  for (const [key, sorted] of messagesByThread(messages, staffAddresses)) {
    const hasConversation = sorted.some((m) => m.direction === 'inbound' || isHumanReply(toThreadMessage(m)));
    const customerId = sorted.findLast((m) => m.customerId)?.customerId ?? null;
    if (!hasConversation && !customerId) continue;
    const last = sorted[sorted.length - 1]!;
    threads.push({
      key, channel: last.channel, address: key.slice(key.indexOf(':') + 1), customerId, lastAt: last.createdAt,
      preview: last.body.replace(/\s+/g, ' ').slice(0, 90), lastDirection: last.direction, count: sorted.length,
      awaitingReply: awaitingReply(sorted.map(toThreadMessage)),
    });
  }
  return threads.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

export type ReplyIntent = 'price' | 'booking' | 'status' | 'hours' | 'thanks' | 'other';

const INTENTS: readonly (readonly [ReplyIntent, RegExp])[] = [
  ['status', /\b(ready|done|status|update|finished|how('?s| is) (my|the) truck|pick ?up)\b/i],
  ['price', /\b(how much|price|cost|quote|estimate|\$\s?\d|charge|rate)\b/i],
  ['booking', /\b(book|appointment|schedule|come in|drop (it )?off|bring (it|my truck) in|availability|available|opening|slot)\b/i],
  ['hours', /\b(hours|open|close[sd]?|saturday|sunday|weekend|address|location|where are you)\b/i],
  ['thanks', /^\s*(thanks|thank you|thx|ty|appreciate it|sounds good|ok(ay)?|great)[\s.!]*$/i],
];

export function classifyReplyIntent(text: string): ReplyIntent {
  return INTENTS.find(([, pattern]) => pattern.test(text))?.[0] ?? 'other';
}

export interface ReplyFacts {
  firstName: string;
  bookingLink: string;
  shopPhone: string;
  /** e.g. "In progress" for the customer's open job, when there is one. */
  jobStatus: string | null;
  hours: string;
}

/** Short, honest template replies. Never quotes a price. */
export function templateReply(intent: ReplyIntent, facts: ReplyFacts): string {
  const hi = facts.firstName ? `Hey ${facts.firstName}, ` : 'Hey, ';
  switch (intent) {
    case 'status':
      return facts.jobStatus
        ? `${hi}your truck is ${facts.jobStatus.toLowerCase()} right now. We'll text you as soon as that changes.`
        : `${hi}let me check on that and get right back to you.`;
    case 'price':
      return `${hi}every truck is a little different, so we quote after a quick look. Book a check-in here: ${facts.bookingLink} or call ${facts.shopPhone}.`;
    case 'booking':
      return `${hi}you can grab a time that works here: ${facts.bookingLink}. Or tell us a day and we'll set it up.`;
    case 'hours':
      return `${hi}we're open ${facts.hours}. Book ahead so a bay is ready: ${facts.bookingLink}`;
    case 'thanks':
      return `Anytime${facts.firstName ? `, ${facts.firstName}` : ''}. Holler if you need anything.`;
    default:
      return `${hi}thanks for reaching out. What truck are you working with and what's going on with it?`;
  }
}

/** True when a draft mentions a dollar amount (drafts must never promise a price). */
export function hasPrice(text: string): boolean {
  return /\$\s?\d|\b\d+\s?(dollars|bucks)\b/i.test(text);
}

/** Text-to-book link with the truck and service pre-filled. */
export function bookingLinkFor(base: string, input: { platform?: string | null; service?: string | null }): string {
  const params = new URLSearchParams();
  if (input.platform && /^[a-z]{3,20}$/.test(input.platform)) params.set('platform', input.platform);
  if (input.service && /^[a-z_-]{3,30}$/.test(input.service)) params.set('service', input.service);
  const query = params.toString();
  return `${base}/book${query ? `?${query}` : ''}`;
}

/** Weekday list like "Mon–Fri 8am–5pm". */
export function describeHours(openDays: readonly number[], openHour: number, closeHour: number): string {
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const days = [...openDays].sort((a, b) => a - b);
  const contiguous = days.length > 1 && days.every((d, i) => i === 0 || d === days[i - 1]! + 1);
  const dayText = days.length === 0 ? 'by appointment' : contiguous ? `${names[days[0]!]}–${names[days[days.length - 1]!]}` : days.map((d) => names[d]).join(', ');
  const hour = (h: number) => (h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`);
  return `${dayText} ${hour(openHour)}–${hour(closeHour)}`;
}

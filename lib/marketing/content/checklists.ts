/**
 * Recurring marketing ops checklists. Pure: the catalog, the period a tick
 * belongs to, and progress maths. Ticks live in `ops_checklist_ticks`.
 */

export const CHECKLIST_KINDS = ['launch', 'weekly', 'monthly'] as const;
export type ChecklistKind = (typeof CHECKLIST_KINDS)[number];

export interface ChecklistItem {
  /** Matches the `item` column pattern: lower snake case. */
  id: string;
  label: string;
  href?: string;
}

export interface Checklist {
  kind: ChecklistKind;
  title: string;
  cadence: string;
  items: readonly ChecklistItem[];
}

export const CHECKLISTS: readonly Checklist[] = [
  {
    kind: 'launch',
    title: 'Go live',
    cadence: 'Once',
    items: [
      { id: 'sending_rules', label: 'Sender name, address, quiet hours', href: '/admin/marketing/settings#sending' },
      { id: 'sender_dns', label: 'SPF, DKIM, DMARC pass', href: '/admin/marketing/settings#deliverability' },
      { id: 'tendlc', label: '10DLC packet submitted', href: '/admin/marketing/settings#tendlc' },
      { id: 'consent_text', label: 'Consent text reviewed', href: '/admin/marketing/settings#consent' },
      { id: 'legal_pages', label: 'Privacy + SMS terms live', href: '/privacy' },
      { id: 'connections', label: 'Ad and social accounts linked', href: '/admin/marketing/content/connections' },
    ],
  },
  {
    kind: 'weekly',
    title: 'Weekly',
    cadence: 'Every week',
    items: [
      { id: 'approvals', label: 'Clear the approval queue', href: '/admin/marketing/ads/approvals' },
      { id: 'reviews', label: 'Reply to new reviews', href: '/admin/marketing/reviews' },
      { id: 'leads', label: 'Follow up open leads', href: '/admin/marketing/contacts' },
      { id: 'ad_spend', label: 'Check spend and cost per lead', href: '/admin/marketing/ads/performance' },
      { id: 'social', label: 'Schedule next week of posts', href: '/admin/marketing/social' },
    ],
  },
  {
    kind: 'monthly',
    title: 'Monthly',
    cadence: 'Every month',
    items: [
      { id: 'suppressions', label: 'Review opt-outs and complaints', href: '/admin/marketing/settings#suppressions' },
      { id: 'health', label: 'Fix integration alerts', href: '/admin/marketing/content/connections#health' },
      { id: 'ai_spend', label: 'Check AI spend vs cap', href: '/admin/marketing/settings#ai' },
      { id: 'templates', label: 'Refresh tired templates', href: '/admin/marketing/content/templates' },
      { id: 'budget', label: 'Set next month’s budget', href: '/admin/marketing/ads/campaigns' },
    ],
  },
];

export function findChecklist(kind: string): Checklist | null {
  return CHECKLISTS.find((c) => c.kind === kind) ?? null;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** ISO-8601 week number of the Thursday in the same week. */
export function isoWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return { year: d.getUTCFullYear(), week: Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7) };
}

/** The period a tick belongs to: `once`, `2026-W38` or `2026-09`. */
export function periodKey(kind: ChecklistKind, now = new Date()): string {
  if (kind === 'launch') return 'once';
  if (kind === 'monthly') return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}`;
  const { year, week } = isoWeek(now);
  return `${year}-W${pad(week)}`;
}

export interface ChecklistProgress {
  done: number;
  total: number;
  complete: boolean;
}

export function progress(list: Checklist, doneIds: ReadonlySet<string>): ChecklistProgress {
  const done = list.items.filter((i) => doneIds.has(i.id)).length;
  return { done, total: list.items.length, complete: done === list.items.length };
}

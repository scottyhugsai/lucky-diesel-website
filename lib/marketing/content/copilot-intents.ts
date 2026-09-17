/** Copilot question routing: keywords → data tools + time window. Pure and deterministic. */

export const COPILOT_TOOLS = ['leads', 'ads', 'reviews', 'campaigns', 'optouts', 'approvals', 'social', 'bookings', 'nps', 'ai_spend'] as const;
export type CopilotTool = (typeof COPILOT_TOOLS)[number];

export interface CopilotIntent {
  tools: CopilotTool[];
  days: number;
  periodLabel: string;
  /** True when no keyword matched: the answer is an overview. */
  fallback: boolean;
}

const KEYWORDS: Record<CopilotTool, RegExp> = {
  leads: /\b(leads?|inquir\w*|requests?|quotes?|sources?|where .* (?:come|coming) from)\b/i,
  ads: /\b(ads?|advert\w*|spend|spent|cost per lead|cpl|roas|meta|facebook ads|google ads|tiktok ads|budget|campaign performance|best campaign)\b/i,
  reviews: /\b(reviews?|ratings?|stars?|reputation)\b/i,
  campaigns: /\b(texts?|sms|emails?|broadcasts?|drips?|opens?|clicks?|sends?|sent)\b/i,
  optouts: /\b(opt[\s-]?outs?|unsubscrib\w*|stop|suppress\w*|complaints?)\b/i,
  approvals: /\b(approv\w*|waiting|pending|queue|needs? me)\b/i,
  social: /\b(social|posts?|instagram|ig|facebook|tiktok|gbp)\b/i,
  bookings: /\b(book\w*|appointments?|jobs?|bays?)\b/i,
  nps: /\b(nps|survey|promoters?|recommend)\b/i,
  ai_spend: /\b(ai (?:spend|cost|budget)|ai cap|tokens?)\b/i,
};

const PERIODS: readonly { pattern: RegExp; days: number; label: string }[] = [
  { pattern: /\btoday\b/i, days: 1, label: 'today' },
  { pattern: /\byesterday\b/i, days: 2, label: 'the last 2 days' },
  { pattern: /\b(this|last|past) week\b|\b7 days\b/i, days: 7, label: 'the last 7 days' },
  { pattern: /\b(two|2) weeks\b|\b14 days\b/i, days: 14, label: 'the last 14 days' },
  { pattern: /\b(quarter|90 days|3 months)\b/i, days: 90, label: 'the last 90 days' },
  { pattern: /\b(this|last|past) year\b|\b365 days\b|\b12 months\b/i, days: 365, label: 'the last 12 months' },
  { pattern: /\b(this|last|past) month\b|\b30 days\b/i, days: 30, label: 'the last 30 days' },
];

export const OVERVIEW_TOOLS: readonly CopilotTool[] = ['leads', 'ads', 'reviews', 'approvals'];

export function parseQuestion(question: string): CopilotIntent {
  const period = PERIODS.find((p) => p.pattern.test(question)) ?? { days: 30, label: 'the last 30 days' };
  // "ai spend" should not also trigger the ads tool on the word "spend".
  const aiSpend = KEYWORDS.ai_spend.test(question);
  const tools = COPILOT_TOOLS.filter((tool) => (tool === 'ads' && aiSpend ? false : KEYWORDS[tool].test(question)));
  // "social posts on facebook" is social, not ads; "facebook ads" is ads.
  const cleaned = tools.includes('social') && tools.includes('ads') && !/\bads?\b|spend|cpl|roas|budget/i.test(question) ? tools.filter((t) => t !== 'ads') : tools;
  if (!cleaned.length) return { tools: [...OVERVIEW_TOOLS], days: period.days, periodLabel: period.label, fallback: true };
  return { tools: cleaned.slice(0, 4), days: period.days, periodLabel: period.label, fallback: false };
}

export const SUGGESTED_QUESTIONS = [
  'How many leads this week?',
  'What did ads cost per lead this month?',
  'Any reviews to answer?',
  'Opt-outs in the last 30 days?',
  'What needs my approval?',
] as const;

export function dollars(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

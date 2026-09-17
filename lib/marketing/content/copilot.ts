import 'server-only';
import { writeCopy, type GenerationMeta } from './ai';
import { checkContent, type ComplianceReport } from './compliance';
import { dollars, parseQuestion, plural, type CopilotIntent, type CopilotTool } from './copilot-intents';
import { adminDb, loadVoice, recordGeneration, type Db } from './db';
import { campaignPerformance } from './metrics-service';
import { npsScore } from './reputation';
import { monthlyAiSpend } from './spend-cap';

/**
 * Marketing copilot: answers owner questions from the app's own data.
 * Each tool runs a fixed query and returns facts + a plain sentence. Demo mode
 * joins the sentences; live AI rewrites them from the same facts only, and the
 * no-fabrication check in writeCopy falls back to the data answer.
 */

interface ToolResult {
  facts: Record<string, string | number | boolean | null>;
  sentence: string;
  simulated?: boolean;
  link?: { href: string; label: string };
}

export interface CopilotAnswer {
  text: string;
  tools: CopilotTool[];
  periodLabel: string;
  generator: GenerationMeta['generator'];
  compliance: ComplianceReport;
  includesSimulatedData: boolean;
  links: { href: string; label: string }[];
  /** Why the AI answer was replaced with the data answer, if it was. */
  note: string | null;
}

const since = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

type Runner = (db: Db, days: number, label: string) => Promise<ToolResult>;

const TOOLS: Record<CopilotTool, Runner> = {
  async leads(db, days, label) {
    const { data, error } = await db.from('leads').select('source, status').gte('created_at', since(days)).limit(5000);
    if (error) throw new Error(`leads: ${error.message}`);
    const rows = data ?? [];
    const bySource = new Map<string, number>();
    for (const r of rows) bySource.set(r.source, (bySource.get(r.source) ?? 0) + 1);
    const top = [...bySource.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    const booked = rows.filter((r) => r.status === 'booked' || r.status === 'won').length;
    return {
      facts: { leads: rows.length, booked, ...Object.fromEntries(top.map(([s, n]) => [`source_${s}`, n])) },
      sentence: `${plural(rows.length, 'lead')} in ${label}${rows.length ? `, ${booked} booked or won` : ''}.${top.length ? ` Top sources: ${top.map(([s, n]) => `${s.replace(/_/g, ' ')} (${n})`).join(', ')}.` : ''}`,
      link: { href: '/admin/marketing/contacts', label: 'Contacts' },
    };
  },
  async ads(db, days, label) {
    const campaigns = await campaignPerformance(days, db);
    const spend = campaigns.reduce((t, c) => t + c.spendCents, 0);
    const leads = campaigns.reduce((t, c) => t + c.leads, 0);
    const best = [...campaigns].filter((c) => c.leads > 0).sort((a, b) => (a.costPerLeadCents ?? Infinity) - (b.costPerLeadCents ?? Infinity))[0];
    const simulated = campaigns.some((c) => c.simulated && c.spendCents > 0);
    const cpl = leads ? Math.round(spend / leads) : null;
    return {
      facts: { adSpendCents: spend, adLeads: leads, costPerLeadCents: cpl, bestCampaign: best?.name ?? null, bestCplCents: best?.costPerLeadCents ?? null, simulated },
      sentence: spend
        ? `Ads spent ${dollars(spend)} in ${label} for ${plural(leads, 'lead')}${cpl !== null ? ` (${dollars(cpl)} each)` : ''}.${best ? ` Best: ${best.name} at ${dollars(best.costPerLeadCents ?? 0)} per lead.` : ''}`
        : `No ad spend in ${label}.`,
      simulated,
      link: { href: '/admin/marketing/ads/performance', label: 'Ad performance' },
    };
  },
  async reviews(db, days, label) {
    const { data, error } = await db.from('reviews').select('rating, replied, source').gte('reviewed_at', since(days)).limit(2000);
    if (error) throw new Error(`reviews: ${error.message}`);
    const rows = data ?? [];
    const avg = rows.length ? Math.round((rows.reduce((t, r) => t + r.rating, 0) / rows.length) * 10) / 10 : null;
    const { count: unanswered } = await db.from('reviews').select('id', { count: 'exact', head: true }).eq('replied', false);
    return {
      facts: { reviews: rows.length, averageRating: avg, unanswered: unanswered ?? 0 },
      sentence: `${plural(rows.length, 'review')} in ${label}${avg !== null ? `, averaging ${avg} stars` : ''}. ${plural(unanswered ?? 0, 'review')} still need a reply.`,
      link: { href: '/admin/marketing/reviews', label: 'Reviews' },
    };
  },
  async campaigns(db, days, label) {
    const { data, error } = await db.from('campaign_sends').select('channel, status, opened_at, clicked_at').gte('created_at', since(days)).in('status', ['sent', 'simulated']).limit(20_000);
    if (error) throw new Error(`sends: ${error.message}`);
    const rows = data ?? [];
    const texts = rows.filter((r) => r.channel === 'sms').length;
    const emails = rows.filter((r) => r.channel === 'email').length;
    const opened = rows.filter((r) => r.opened_at).length;
    const clicked = rows.filter((r) => r.clicked_at).length;
    const simulated = rows.some((r) => r.status === 'simulated');
    return {
      facts: { textsSent: texts, emailsSent: emails, opened, clicked, simulated },
      sentence: `Campaigns sent ${plural(texts, 'text')} and ${plural(emails, 'email')} in ${label}: ${opened} opened, ${clicked} clicked${simulated ? ' (some simulated)' : ''}.`,
      simulated,
      link: { href: '/admin/marketing/campaigns', label: 'Campaigns' },
    };
  },
  async optouts(db, days, label) {
    const { data, error } = await db.from('suppressions').select('channel, reason').gte('created_at', since(days)).limit(5000);
    if (error) throw new Error(`suppressions: ${error.message}`);
    const rows = data ?? [];
    const complaints = rows.filter((r) => r.reason === 'complaint').length;
    return {
      facts: { optOuts: rows.length, smsOptOuts: rows.filter((r) => r.channel === 'sms').length, emailOptOuts: rows.filter((r) => r.channel === 'email').length, complaints },
      sentence: `${plural(rows.length, 'opt-out')} in ${label} (${rows.filter((r) => r.channel === 'sms').length} text, ${rows.filter((r) => r.channel === 'email').length} email)${complaints ? `, ${plural(complaints, 'complaint')}` : ''}.`,
      link: { href: '/admin/marketing/settings#suppressions', label: 'Suppressions' },
    };
  },
  async approvals(db) {
    const { count, error } = await db.from('marketing_approvals').select('id', { count: 'exact', head: true }).eq('decision', 'pending');
    if (error) throw new Error(`approvals: ${error.message}`);
    return {
      facts: { pendingApprovals: count ?? 0 },
      sentence: count ? `${plural(count, 'draft')} waiting for your approval.` : 'Nothing is waiting for approval.',
      link: { href: '/admin/marketing/ads/approvals', label: 'Approvals' },
    };
  },
  async social(db, days, label) {
    const [{ count: published }, { count: scheduled }] = await Promise.all([
      db.from('social_posts').select('id', { count: 'exact', head: true }).eq('status', 'published').gte('published_at', since(days)),
      db.from('social_posts').select('id', { count: 'exact', head: true }).eq('status', 'scheduled').gte('scheduled_for', new Date().toISOString()),
    ]);
    return {
      facts: { postsPublished: published ?? 0, postsScheduled: scheduled ?? 0 },
      sentence: `${plural(published ?? 0, 'post')} published in ${label}; ${scheduled ?? 0} scheduled ahead.`,
      link: { href: '/admin/marketing/social', label: 'Social calendar' },
    };
  },
  async bookings(db, days, label) {
    const { data, error } = await db.from('appointments').select('status').gte('created_at', since(days)).limit(5000);
    if (error) throw new Error(`appointments: ${error.message}`);
    const rows = data ?? [];
    const cancelled = rows.filter((r) => r.status === 'cancelled' || r.status === 'no_show').length;
    return {
      facts: { bookings: rows.length, cancelledOrNoShow: cancelled },
      sentence: `${plural(rows.length, 'booking')} made in ${label}${cancelled ? `, ${cancelled} cancelled or no-show` : ''}.`,
    };
  },
  async nps(db, days, label) {
    const { data, error } = await db.from('nps_responses').select('score').gte('responded_at', since(days)).not('score', 'is', null).limit(5000);
    if (error) throw new Error(`nps: ${error.message}`);
    const scores = (data ?? []).map((r) => r.score!);
    const score = npsScore(scores);
    return {
      facts: { surveyResponses: scores.length, nps: score },
      sentence: scores.length ? `NPS ${score} from ${plural(scores.length, 'survey response')} in ${label}.` : `No survey responses in ${label}.`,
    };
  },
  async ai_spend(db) {
    const status = await monthlyAiSpend(db);
    return {
      facts: { aiSpentUsd: status.spentUsd, aiCapUsd: status.capUsd, aiCapReached: status.over },
      sentence: `AI spend this month: $${status.spentUsd.toFixed(2)} of a $${status.capUsd.toFixed(2)} cap${status.over ? ' (cap reached, using templates)' : ''}.`,
      link: { href: '/admin/marketing/settings#ai', label: 'AI cap' },
    };
  },
};

async function runTools(db: Db, intent: CopilotIntent): Promise<ToolResult[]> {
  const settled = await Promise.allSettled(intent.tools.map((tool) => TOOLS[tool](db, intent.days, intent.periodLabel)));
  return settled.map((s, i) => {
    if (s.status === 'fulfilled') return s.value;
    console.error(`[marketing/copilot] ${intent.tools[i]} failed: ${s.reason instanceof Error ? s.reason.message : String(s.reason)}`);
    return { facts: {}, sentence: `I couldn’t load ${intent.tools[i]!.replace('_', ' ')} data right now.` };
  });
}

const MAX_QUESTION = 300;

export async function askCopilot(input: { question: string; requestedBy: string | null }, db: Db = adminDb()): Promise<CopilotAnswer> {
  const question = input.question.trim().slice(0, MAX_QUESTION);
  const intent = parseQuestion(question);
  const results = await runTools(db, intent);
  const dataAnswer = [intent.fallback ? `Here’s the quick picture for ${intent.periodLabel}.` : '', ...results.map((r) => r.sentence)].filter(Boolean).join(' ');
  const facts = Object.assign({ period: intent.periodLabel }, ...results.map((r) => r.facts)) as Record<string, unknown>;

  const { text, meta, unverified } = await writeCopy({
    task: `Answer the shop owner's question in 1–3 short sentences using only the facts. If the facts don't answer it, say what you can see. Question: ${question}`,
    facts,
    maxChars: 600,
    voice: await loadVoice(db),
    fallback: dataAnswer,
  });
  const compliance = checkContent([text]);
  await recordGeneration(db, { kind: 'assistant', input: { question, tools: intent.tools, days: intent.days }, output: { text, facts }, meta, requestedBy: input.requestedBy });
  return {
    text,
    tools: intent.tools,
    periodLabel: intent.periodLabel,
    generator: meta.generator,
    compliance,
    includesSimulatedData: results.some((r) => r.simulated),
    links: results.flatMap((r) => (r.link ? [r.link] : [])),
    note: unverified.length ? 'AI answer had numbers not in your data, so this is the data-only answer.' : null,
  };
}

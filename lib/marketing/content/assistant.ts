import 'server-only';
import { BUSINESS } from '@/lib/site';
import { siteUrl } from '@/lib/site-url';
import { writeCopy, type GenerationMeta } from './ai';
import { fitText } from './brand';
import { checkContent, type ComplianceReport } from './compliance';
import { adminDb, loadVoice, recordGeneration, type Db } from './db';
import { campaignPerformance } from './metrics-service';
import { proposeWeeklyPlan } from './planner-service';
import type { PlanItem } from './planner';
import { npsScore } from './reputation';

/** Marketing assistant: every answer is built from shop data and compliance-checked. */

export interface AssistantAnswer {
  text: string;
  compliance: ComplianceReport;
  generator: GenerationMeta['generator'];
  /** Numbers that came from simulated (demo) data. */
  includesSimulatedData: boolean;
}

export async function suggestNextCampaign(db: Db = adminDb()): Promise<AssistantAnswer & { item: PlanItem | null; notes: string[] }> {
  const plan = await proposeWeeklyPlan(db);
  const item = plan.items.find((i) => i.type === 'ad') ?? plan.items[0] ?? null;
  const text = item
    ? `Next best move: ${item.title}. Why: ${item.reason}${plan.notes.length ? ` Note: ${plan.notes.join(' ')}` : ''}`
    : `Nothing stands out this week. ${plan.notes.join(' ')}`;
  return { text, item, notes: plan.notes, compliance: checkContent([text]), generator: 'demo', includesSimulatedData: false };
}

function dollars(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export async function summarizeLast30Days(db: Db = adminDb()): Promise<AssistantAnswer & { stats: Record<string, number | null> }> {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [campaigns, { count: leads }, { count: posts }, { data: reviews }, { data: nps }] = await Promise.all([
    campaignPerformance(30, db),
    db.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', since),
    db.from('social_posts').select('id', { count: 'exact', head: true }).eq('status', 'published').gte('published_at', since),
    db.from('reviews').select('rating, source').gte('reviewed_at', since),
    db.from('nps_responses').select('score').gte('responded_at', since).not('score', 'is', null),
  ]);
  const spend = campaigns.reduce((t, c) => t + c.spendCents, 0);
  const adLeads = campaigns.reduce((t, c) => t + c.leads, 0);
  const real = (reviews ?? []).filter((r) => ['google', 'facebook', 'manual'].includes(r.source));
  const simulated = campaigns.some((c) => c.simulated && c.spendCents > 0);
  const best = [...campaigns].filter((c) => c.leads > 0).sort((a, b) => (a.costPerLeadCents ?? Infinity) - (b.costPerLeadCents ?? Infinity))[0];
  const score = npsScore((nps ?? []).map((n) => n.score!));
  const stats = { adSpendCents: spend, adLeads, websiteLeads: leads ?? 0, postsPublished: posts ?? 0, newRealReviews: real.length, nps: score };
  const text = [
    `Last 30 days: ${leads ?? 0} leads came in.`,
    spend ? `Ads spent ${dollars(spend)} for ${adLeads} leads${adLeads ? ` (${dollars(spend / adLeads)} each)` : ''}${simulated ? ' (simulated demo numbers)' : ''}.` : 'No ad spend.',
    best ? `Best campaign: ${best.name} at ${dollars(best.costPerLeadCents ?? 0)} per lead.` : '',
    `${posts ?? 0} social ${posts === 1 ? 'post' : 'posts'} went out and ${real.length} new real ${real.length === 1 ? 'review' : 'reviews'} arrived.`,
    score !== null ? `NPS ${score}.` : '',
  ].filter(Boolean).join(' ');
  return { text, stats, compliance: checkContent([text]), generator: 'demo', includesSimulatedData: simulated };
}

/** Demo caption/email from a prompt: honest, short and on-brand. The AI path uses the same guardrails. */
function demoCopy(kind: 'caption' | 'email', prompt: string): string {
  const topic = fitText(prompt.replace(/^(write|make|draft)\s+(me\s+)?(a|an)?\s*(caption|post|email)\s*(about|for|on)?\s*/i, '').replace(/[.!?]+$/, ''), 120) || 'our diesel shop';
  if (kind === 'caption') {
    return `${topic.charAt(0).toUpperCase()}${topic.slice(1)}.\n\nDiesel-only techs in ${BUSINESS.city}. Duramax, Powerstroke and Cummins.\n\nBook a bay: ${siteUrl()}/book\n\n#LuckyDiesel #CharlestonSC #DieselTrucks`;
  }
  return `Subject: ${fitText(topic.charAt(0).toUpperCase() + topic.slice(1), 60)}\n\nHey {{first_name}},\n\n${topic.charAt(0).toUpperCase()}${topic.slice(1)}. If your truck is due, we can get you in: ${siteUrl()}/book or call ${BUSINESS.phoneDisplay}.\n\n— Lucky Diesel`;
}

const MAX_PROMPT = 500;

export async function writeFromPrompt(input: { kind: 'caption' | 'email'; prompt: string; requestedBy: string | null }, db: Db = adminDb()): Promise<AssistantAnswer> {
  const prompt = input.prompt.trim().slice(0, MAX_PROMPT);
  const promptCheck = checkContent([prompt]);
  if (promptCheck.status === 'block') {
    return { text: 'I can’t write that: the request asks for language that’s illegal to market (see issues).', compliance: promptCheck, generator: 'demo', includesSimulatedData: false };
  }
  const { text, meta } = await writeCopy({
    task: input.kind === 'caption' ? `Write a social caption: ${prompt}` : `Write a short marketing email (with a Subject: line) using {{first_name}}: ${prompt}`,
    facts: { city: BUSINESS.city, phone: BUSINESS.phoneDisplay, booking: `${siteUrl()}/book` },
    maxChars: input.kind === 'caption' ? 600 : 1200, voice: await loadVoice(db), fallback: demoCopy(input.kind, prompt),
  });
  const compliance = checkContent([text]);
  await recordGeneration(db, { kind: input.kind === 'caption' ? 'social_caption' : 'email', input: { prompt }, output: { text, compliance }, meta, requestedBy: input.requestedBy });
  return { text, compliance, generator: meta.generator, includesSimulatedData: false };
}

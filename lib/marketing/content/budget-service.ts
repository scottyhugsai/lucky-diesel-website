import 'server-only';
import { isApprovalValid, payloadHash } from './approvals';
import { latestApproval, loadSubject } from './approvals-service';
import { nextMonth, parseSeasonMultipliers, seasonalBudgetCents } from './budget';
import { adAdapterFor } from './channels/registry';
import { adminDb, fail, isCampaignPlatform, loadGuards, type Db, type Result } from './db';
import { budgetViolations } from './publish-service';

/**
 * Seasonal budget changes. The app proposes; nothing changes until the owner
 * approves the exact new amount. Approval re-checks every budget cap, pushes
 * the budget to the platform (simulated in demo) and records a fresh approval
 * for the new campaign payload.
 */

const ACTIVE = ['approved', 'scheduled', 'live', 'paused'];

function shopToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
}

export async function loadSeasonMultipliers(db: Db = adminDb()): Promise<Record<number, number>> {
  const { data } = await db.from('budget_guards').select('season_multipliers').eq('platform', 'all').maybeSingle();
  return parseSeasonMultipliers(data?.season_multipliers ?? {});
}

export async function saveSeasonMultipliers(values: Record<number, number>, db: Db = adminDb()): Promise<Result> {
  const { data } = await db.from('budget_guards').select('id').eq('platform', 'all').maybeSingle();
  if (!data) return { ok: false, error: 'Set a whole-shop budget cap first.' };
  const { error } = await db.from('budget_guards').update({ season_multipliers: Object.fromEntries(Object.entries(values).map(([m, v]) => [m, v])) }).eq('id', data.id);
  return error ? { ok: false, error: error.message } : { ok: true, data: undefined };
}

/** Drafts next month's budget for every approved or running campaign. Returns how many changed. */
export async function proposeSeasonalBudgets(createdBy: string | null, month = nextMonth(shopToday()), db: Db = adminDb()): Promise<Result<{ proposed: number; month: string }>> {
  try {
    const multipliers = await loadSeasonMultipliers(db);
    const multiplier = multipliers[Number(month.slice(5, 7))] ?? 1;
    const guards = (await loadGuards(db)).filter((g) => g.active);
    const { data: campaigns } = await db.from('ad_campaigns').select('id, platform, daily_budget_cents, ends_on').in('status', ACTIVE);
    const { data: history } = await db.from('budget_change_proposals').select('campaign_id, from_cents, created_at').eq('status', 'approved').order('created_at');
    let proposed = 0;
    for (const c of campaigns ?? []) {
      if (!isCampaignPlatform(c.platform) || c.platform === 'lsa') continue;
      if (c.ends_on && c.ends_on < `${month}-01`) continue;
      // Base = the budget before any seasonal change, so months don't compound.
      const base = history?.find((h) => h.campaign_id === c.id)?.from_cents ?? c.daily_budget_cents;
      const caps = guards.filter((g) => g.platform === c.platform || g.platform === 'all').map((g) => g.maxDailyCents).filter((cap) => cap > 0);
      const target = seasonalBudgetCents(base, multiplier, caps.length ? Math.min(...caps) : null);
      if (target === c.daily_budget_cents) continue;
      await db.from('budget_change_proposals').update({ status: 'superseded', decided_at: new Date().toISOString() }).eq('campaign_id', c.id).eq('month', month).eq('status', 'pending');
      const { error } = await db.from('budget_change_proposals').insert({ campaign_id: c.id, month, from_cents: c.daily_budget_cents, to_cents: target, multiplier, created_by: createdBy });
      if (error) return { ok: false, error: error.message };
      proposed += 1;
    }
    return { ok: true, data: { proposed, month } };
  } catch (error) {
    return fail(error);
  }
}

export async function decideBudgetProposal(input: { proposalId: string; approve: boolean; decidedBy: string }, db: Db = adminDb()): Promise<Result<{ applied: boolean; simulated: boolean }>> {
  try {
    const { data: proposal } = await db.from('budget_change_proposals').select('*').eq('id', input.proposalId).maybeSingle();
    if (!proposal || proposal.status !== 'pending') return { ok: false, error: 'This change was already decided.' };
    const decided = { decided_by: input.decidedBy, decided_at: new Date().toISOString() };
    if (!input.approve) {
      await db.from('budget_change_proposals').update({ status: 'rejected', ...decided }).eq('id', proposal.id).eq('status', 'pending');
      return { ok: true, data: { applied: false, simulated: true } };
    }

    const { data: campaign } = await db.from('ad_campaigns').select('*, ad_publications(external_ids, simulated)').eq('id', proposal.campaign_id).maybeSingle();
    if (!campaign || !ACTIVE.includes(campaign.status) || !isCampaignPlatform(campaign.platform)) return { ok: false, error: 'Campaign is no longer running.' };
    if (campaign.daily_budget_cents !== proposal.from_cents) return { ok: false, error: 'The budget changed since this was proposed. Propose again.' };
    const [before, approval] = await Promise.all([loadSubject(db, 'ad_campaign', campaign.id), latestApproval(db, 'ad_campaign', campaign.id)]);
    if (!before || !isApprovalValid(approval, before.payload)) return { ok: false, error: 'Campaign changed since its approval. Re-approve it first.' };

    const violations = await budgetViolations(db, { ...campaign, daily_budget_cents: proposal.to_cents });
    if (violations.length) {
      await db.from('budget_change_proposals').update({ error: violations.join(' ') }).eq('id', proposal.id);
      return { ok: false, error: violations.join(' ') };
    }

    const { adapter } = await adAdapterFor(campaign.platform, db);
    const live = campaign.ad_publications.filter((p) => !p.simulated);
    const seen = new Set<string>();
    for (const p of live) {
      const ids = (p.external_ids ?? {}) as Record<string, string>;
      const key = JSON.stringify(ids);
      if (seen.has(key)) continue;
      seen.add(key);
      await adapter.setBudget(ids, proposal.to_cents);
    }

    const { error } = await db.from('ad_campaigns').update({ daily_budget_cents: proposal.to_cents }).eq('id', campaign.id).eq('daily_budget_cents', proposal.from_cents);
    if (error) return { ok: false, error: error.message };
    const after = await loadSubject(db, 'ad_campaign', campaign.id);
    // The owner approved this exact budget: record it so publishing and activation stay valid.
    await db.from('marketing_approvals').insert({
      subject_type: 'ad_campaign', subject_id: campaign.id, payload_hash: payloadHash(after?.payload), decision: 'approved', requested_by: proposal.created_by,
      decided_by: input.decidedBy, decided_at: decided.decided_at, warnings_acknowledged: approval?.warningsAcknowledged ?? false,
      notes: `Seasonal budget ${proposal.month}: $${proposal.from_cents / 100} → $${proposal.to_cents / 100}/day`,
    });
    await db.from('budget_change_proposals').update({ status: 'approved', error: null, ...decided }).eq('id', proposal.id);
    return { ok: true, data: { applied: true, simulated: live.length === 0 } };
  } catch (error) {
    return fail(error);
  }
}

export interface ProposalView {
  id: string;
  campaign: string;
  month: string;
  fromCents: number;
  toCents: number;
  multiplier: number;
  error: string | null;
}

export async function pendingProposals(db: Db = adminDb()): Promise<ProposalView[]> {
  const { data } = await db.from('budget_change_proposals').select('id, month, from_cents, to_cents, multiplier, error, ad_campaigns(name)').eq('status', 'pending').order('created_at');
  return (data ?? []).map((p) => ({ id: p.id, campaign: p.ad_campaigns?.name ?? 'Campaign', month: p.month, fromCents: p.from_cents, toCents: p.to_cents, multiplier: Number(p.multiplier), error: p.error }));
}

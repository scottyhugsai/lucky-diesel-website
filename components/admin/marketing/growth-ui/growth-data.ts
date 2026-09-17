import 'server-only';
import { monthlyStatement, parseTierPerks, type StatementRow, type TierPerks } from '@/lib/marketing/core/promotions';
import { getMarketingSettings, type MarketingSettings } from '@/lib/marketing/core/settings';
import { siteUrl } from '@/lib/site-url';
import { createAdminClient } from '@/lib/supabase/admin';

export interface CustomerOption { id: string; name: string }

export async function loadCustomerOptions(): Promise<CustomerOption[]> {
  const { data } = await createAdminClient().from('customers').select('id, full_name').order('full_name').limit(500);
  return (data ?? []).map((c) => ({ id: c.id, name: c.full_name }));
}

export async function loadSegments(): Promise<{ id: string; name: string; count: number }[]> {
  const { data } = await createAdminClient().from('segments').select('id, name, member_count').order('name');
  return (data ?? []).map((s) => ({ id: s.id, name: s.name, count: s.member_count }));
}

export interface PartnerRow {
  id: string;
  name: string;
  kind: string;
  code: string;
  link: string;
  active: boolean;
  rewardCents: number;
  referred: number;
  rewarded: number;
  owedCents: number;
  statement: StatementRow[];
}

export interface ReferralOverview {
  settings: MarketingSettings;
  codes: { id: string; code: string; customer: string; customerId: string; uses: number; active: boolean; link: string; rewardedCents: number; referred: number; optIn: boolean }[];
  pipeline: { id: string; referrer: string; referred: string; status: string; rewardCents: number; createdAt: string }[];
  totals: { pending: number; qualified: number; rewarded: number; rewardedCents: number; pendingCents: number };
  partners: PartnerRow[];
}

export async function loadReferrals(): Promise<ReferralOverview> {
  const db = createAdminClient();
  const [settings, { data: codes }, { data: referrals }, { data: partners }] = await Promise.all([
    getMarketingSettings(db),
    db.from('referral_codes').select('id, code, uses, active, referrer_reward_cents, customer_id, customers(full_name, referral_leaderboard_opt_in)').order('uses', { ascending: false }),
    db.from('referrals').select('id, status, reward_cents, created_at, referral_code_id, referrer:customers!referrals_referrer_customer_id_fkey(full_name), referred:customers!referrals_referred_customer_id_fkey(full_name), leads(full_name)').order('created_at', { ascending: false }).limit(100),
    db.from('referral_partners').select('*, partner_referrals(status, reward_cents, created_at, rewarded_at)').order('name'),
  ]);
  const base = siteUrl();
  const rows = referrals ?? [];
  const byCode = (codeId: string) => rows.filter((r) => r.referral_code_id === codeId);
  const rewardFor = (codeCents: number) => codeCents || settings.referrerRewardCents;
  return {
    settings,
    codes: (codes ?? []).map((c) => ({
      id: c.id, code: c.code, customer: c.customers?.full_name ?? 'Customer', customerId: c.customer_id, uses: c.uses, active: c.active,
      link: `${base}/refer/${c.code}`, referred: byCode(c.id).length, optIn: c.customers?.referral_leaderboard_opt_in ?? false,
      rewardedCents: byCode(c.id).filter((r) => r.status === 'rewarded').reduce((t, r) => t + r.reward_cents, 0),
    })),
    partners: (partners ?? []).map((p) => {
      const rows = p.partner_referrals.map((r) => ({ createdAt: r.created_at, status: r.status, rewardCents: r.reward_cents, rewardedAt: r.rewarded_at }));
      const statement = monthlyStatement(rows, settings.timeZone);
      return {
        id: p.id, name: p.name, kind: p.kind, code: p.code, link: `${base}/refer/${p.code}`, active: p.active, rewardCents: p.reward_cents,
        referred: rows.filter((r) => r.status !== 'void').length,
        rewarded: rows.filter((r) => r.status === 'rewarded').length,
        owedCents: statement.reduce((t, s) => t + s.owedCents, 0),
        statement: statement.slice(0, 6),
      };
    }),
    pipeline: rows.map((r) => ({
      id: r.id, referrer: r.referrer?.full_name ?? 'Customer', referred: r.referred?.full_name ?? r.leads?.full_name ?? 'New lead',
      status: r.status, rewardCents: r.reward_cents, createdAt: r.created_at,
    })),
    totals: {
      pending: rows.filter((r) => r.status === 'pending').length,
      qualified: rows.filter((r) => r.status === 'qualified').length,
      rewarded: rows.filter((r) => r.status === 'rewarded').length,
      rewardedCents: rows.filter((r) => r.status === 'rewarded').reduce((t, r) => t + r.reward_cents, 0),
      pendingCents: rows.filter((r) => r.status === 'pending' || r.status === 'qualified').length * rewardFor(0),
    },
  };
}

export interface LoyaltyOverview {
  settings: MarketingSettings;
  pointValueCents: number;
  perks: TierPerks;
  tiers: { tier: string; count: number; minCents: number }[];
  members: { customerId: string; name: string; tier: string; points: number; spendCents: number }[];
  recent: { id: string; name: string; kind: string; points: number; note: string | null; at: string }[];
}

export async function loadLoyalty(): Promise<LoyaltyOverview> {
  const db = createAdminClient();
  const [settings, { data: accounts }, { data: events }, { data: program }] = await Promise.all([
    getMarketingSettings(db),
    db.from('loyalty_accounts').select('customer_id, tier, points_balance, lifetime_spend_cents, customers(full_name)').order('points_balance', { ascending: false }).limit(200),
    db.from('loyalty_events').select('id, kind, points, note, created_at, customers(full_name)').order('created_at', { ascending: false }).limit(8),
    db.from('marketing_settings').select('point_value_cents, tier_perks').eq('id', 1).maybeSingle(),
  ]);
  const rows = accounts ?? [];
  const t = settings.tierThresholds;
  const tiers = [
    { tier: 'stock', minCents: 0 }, { tier: 'stage_1', minCents: t.stage_1 }, { tier: 'stage_2', minCents: t.stage_2 }, { tier: 'full_build', minCents: t.full_build },
  ].map((x) => ({ ...x, count: rows.filter((r) => r.tier === x.tier).length }));
  return {
    settings,
    pointValueCents: program?.point_value_cents ?? 5,
    perks: parseTierPerks(program?.tier_perks),
    tiers,
    members: rows.map((r) => ({ customerId: r.customer_id, name: r.customers?.full_name ?? 'Customer', tier: r.tier, points: r.points_balance, spendCents: r.lifetime_spend_cents })),
    recent: (events ?? []).map((e) => ({ id: e.id, name: e.customers?.full_name ?? 'Customer', kind: e.kind, points: e.points, note: e.note, at: e.created_at })),
  };
}

export const TIER_LABEL: Record<string, string> = { stock: 'Stock', stage_1: 'Stage 1', stage_2: 'Stage 2', full_build: 'Full build' };

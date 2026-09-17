import 'server-only';
import type { Json, Tables } from '@/lib/db/database.types';
import { createAdminClient } from '@/lib/supabase/admin';
import { DEFAULT_VOICE, type BrandVoice } from './brand';
import type { GenerationMeta } from './ai';
import type { BudgetGuard } from './budget';
import type { BuildRef, CampaignPlatform } from './types';

export type Db = ReturnType<typeof createAdminClient>;

export function adminDb(): Db {
  return createAdminClient();
}

export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export function fail(error: unknown): { ok: false; error: string } {
  return { ok: false, error: error instanceof Error ? error.message : String(error) };
}

export function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value ?? null)) as Json;
}

/** The owner's brand voice, falling back to defaults for anything unset. */
export async function loadVoice(db: Db): Promise<BrandVoice> {
  const { data } = await db.from('brand_voice').select('*').eq('id', 1).maybeSingle();
  if (!data) return DEFAULT_VOICE;
  return {
    tone: data.tone || DEFAULT_VOICE.tone,
    doRules: data.do_rules.length ? data.do_rules : DEFAULT_VOICE.doRules,
    dontRules: data.dont_rules.length ? data.dont_rules : DEFAULT_VOICE.dontRules,
    bannedPhrases: [...new Set([...DEFAULT_VOICE.bannedPhrases, ...data.banned_phrases])],
    approvedClaims: data.approved_claims.length ? data.approved_claims : DEFAULT_VOICE.approvedClaims,
    hashtags: data.hashtags.length ? data.hashtags : DEFAULT_VOICE.hashtags,
    defaultCta: data.default_cta || DEFAULT_VOICE.defaultCta,
  };
}

type JobKind = Tables<'ai_generation_jobs'>['kind'];

/** Writes the audit row for one generation (demo or AI). Returns its id, or null if logging failed. */
export async function recordGeneration(
  db: Db,
  job: { kind: JobKind; input: unknown; output: unknown; meta: GenerationMeta; requestedBy: string | null; error?: string | null },
): Promise<string | null> {
  const { data, error } = await db
    .from('ai_generation_jobs')
    .insert({
      kind: job.kind,
      status: job.error ? 'failed' : 'succeeded',
      generator: job.meta.generator,
      model_id: job.meta.model,
      input: toJson(job.input),
      output: toJson(job.output),
      input_tokens: job.meta.inputTokens,
      output_tokens: job.meta.outputTokens,
      cost_usd: job.meta.costUsd,
      error: job.error ?? job.meta.fallbackReason,
      requested_by: job.requestedBy,
      finished_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error) console.error(`[marketing] could not record ${job.kind} generation: ${error.message}`);
  return data?.id ?? null;
}

export async function loadGuards(db: Db): Promise<BudgetGuard[]> {
  const { data } = await db.from('budget_guards').select('*');
  return (data ?? []).map((g) => ({
    platform: g.platform as BudgetGuard['platform'],
    maxDailyCents: g.max_daily_cents,
    maxMonthlyCents: g.max_monthly_cents,
    maxCampaignDays: g.max_campaign_days,
    autoPauseCplCents: g.auto_pause_cpl_cents,
    pacingTolerance: Number(g.pacing_tolerance),
    active: g.active,
  }));
}

export function isCampaignPlatform(value: string): value is CampaignPlatform {
  return ['meta', 'google', 'tiktok', 'lsa'].includes(value);
}

export function buildToRef(build: Tables<'builds'>): BuildRef {
  return {
    id: build.id,
    slug: build.slug,
    title: build.title,
    vehicleLabel: build.vehicle_label,
    platform: build.platform,
    beforeHp: build.before_hp,
    afterHp: build.after_hp,
    beforeTorque: build.before_torque,
    afterTorque: build.after_torque,
    parts: build.parts,
    image: build.hero_image,
    isSample: build.is_sample,
  };
}

/** A logged dyno run compared with the same truck's baseline pull. */
export async function dynoRunToRef(db: Db, runId: string): Promise<BuildRef | null> {
  const { data: run } = await db.from('dyno_runs').select('*, vehicles(*)').eq('id', runId).maybeSingle();
  if (!run?.vehicles) return null;
  const { data: baseline } = await db
    .from('dyno_runs')
    .select('horsepower, torque')
    .eq('vehicle_id', run.vehicle_id)
    .eq('is_baseline', true)
    .lt('run_at', run.run_at)
    .order('run_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: parts } = await db.from('build_items').select('part_name').eq('vehicle_id', run.vehicle_id).limit(5);
  const v = run.vehicles;
  const label = [v.year, v.make, v.model, v.engine_code].filter(Boolean).join(' ');
  return {
    id: run.id,
    slug: null,
    title: run.label,
    vehicleLabel: label || 'Customer truck',
    platform: v.platform ?? 'other',
    beforeHp: run.is_baseline ? null : baseline?.horsepower ?? null,
    afterHp: run.horsepower,
    beforeTorque: run.is_baseline ? null : baseline?.torque ?? null,
    afterTorque: run.torque,
    parts: (parts ?? []).map((p) => p.part_name),
    image: null,
    isSample: false,
  };
}

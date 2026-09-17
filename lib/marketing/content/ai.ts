import { AD_LIMITS, fitText, type BrandVoice } from './brand';
import { checkContent } from './compliance';
import { gatewayAuth, gatewayImage, gatewayText, type GatewayAuth } from './ai-gateway';
import { generateDemoVariants } from './demo-generator';
import type { Facts } from './copy-library';
import type { AdFormat, CreativeBrief, Generator, VariantDraft } from './types';

/**
 * Provider abstraction. "Build it now, connect AI later":
 *   live  → MARKETING_AI_MODE=live AND gateway credentials exist
 *   demo  → everything else, and any live failure falls back to demo
 * Every result says which generator produced it.
 */

export const DEFAULT_TEXT_MODEL = 'anthropic/claude-haiku-4.5';
export const DEFAULT_IMAGE_MODEL = 'google/gemini-3.1-flash-image';

export type AiMode =
  | { live: true; auth: GatewayAuth; model: string; imageModel: string }
  | { live: false; reason: string };

export function resolveAiMode(env: Record<string, string | undefined> = process.env): AiMode {
  if (env.MARKETING_AI_MODE !== 'live') return { live: false, reason: 'MARKETING_AI_MODE is not "live"' };
  const auth = gatewayAuth(env);
  if (!auth) return { live: false, reason: 'no AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN' };
  return { live: true, auth, model: env.MARKETING_AI_MODEL?.trim() || DEFAULT_TEXT_MODEL, imageModel: env.MARKETING_AI_IMAGE_MODEL?.trim() || DEFAULT_IMAGE_MODEL };
}

export interface GenerationMeta {
  generator: Generator;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number;
  /** Why a live request fell back to the demo generator. */
  fallbackReason: string | null;
}

const DEMO_META: GenerationMeta = { generator: 'demo', model: 'demo/templates', inputTokens: null, outputTokens: null, costUsd: 0, fallbackReason: null };

function voiceSystemPrompt(voice: BrandVoice): string {
  return [
    `You write marketing copy for Lucky Diesel, a diesel truck repair and performance shop in Charleston, SC. Tone: ${voice.tone}`,
    `Do: ${voice.doRules.join(' ')}`,
    `Never: ${voice.dontRules.join(' ')} Never use these words: ${voice.bannedPhrases.join(', ')}.`,
    'Use only facts provided. Do not invent numbers, prices, reviews, customers or dates.',
  ].join('\n');
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** Validates model JSON against the platform limits and our own compliance check. */
export function parseAiVariants(raw: string, brief: CreativeBrief, template: VariantDraft): VariantDraft[] {
  const limits = AD_LIMITS[brief.platform];
  const parsed: unknown = JSON.parse(raw);
  const list = typeof parsed === 'object' && parsed !== null && Array.isArray((parsed as { variants?: unknown }).variants) ? (parsed as { variants: unknown[] }).variants : [];
  return list.flatMap((item, i) => {
    if (typeof item !== 'object' || item === null) return [];
    const v = item as Record<string, unknown>;
    const headline = asString(v.headline);
    const primary = asString(v.primary_text);
    if (!headline || !primary) return [];
    const cta = asString(v.cta);
    const draft: VariantDraft = {
      ...template,
      label: `V${i + 1} · ${asString(v.angle) ?? 'ai'}`,
      hook: asString(v.hook) ?? '',
      angle: asString(v.angle) ?? 'ai',
      headline: fitText(headline, limits.headline),
      longHeadline: limits.longHeadline ? fitText(asString(v.long_headline) ?? headline, limits.longHeadline) : null,
      primaryText: fitText(primary, limits.primary),
      description: limits.description ? fitText(asString(v.description) ?? '', limits.description) || null : null,
      cta: cta && limits.ctas.includes(cta) ? cta : limits.ctas[0]!,
      generator: 'ai',
    };
    const report = checkContent([draft.headline, draft.longHeadline, draft.primaryText, draft.description]);
    const issues = [...report.issues, ...template.complianceIssues.filter((x) => x.term === 'off-road-only SKU')];
    const status = issues.some((x) => x.severity === 'block') ? 'block' : issues.length ? 'warn' : 'pass';
    return [{ ...draft, imageParams: { ...template.imageParams, headline: draft.headline }, complianceStatus: status, complianceIssues: issues }];
  });
}

export async function generateAdVariants(
  brief: CreativeBrief,
  voice: BrandVoice,
  extraFacts: Facts = {},
  env: Record<string, string | undefined> = process.env,
): Promise<{ variants: VariantDraft[]; meta: GenerationMeta }> {
  const demo = generateDemoVariants(brief, extraFacts);
  const mode = resolveAiMode(env);
  if (!mode.live || !demo[0]) return { variants: demo, meta: DEMO_META };

  const limits = AD_LIMITS[brief.platform];
  try {
    const result = await gatewayText(mode.auth, {
      model: mode.model,
      maxTokens: 1500,
      json: true,
      messages: [
        { role: 'system', content: voiceSystemPrompt(voice) },
        {
          role: 'user',
          content: [
            `Write ${demo.length} distinct ad variants for ${brief.platform} with goal "${brief.goal}"${brief.audience ? ` for ${brief.audience}` : ''}.`,
            `Limits: headline ≤${limits.headline} chars, primary_text ≤${limits.primary}${limits.description ? `, description ≤${limits.description}` : ''}${limits.longHeadline ? `, long_headline ≤${limits.longHeadline}` : ''}. cta one of ${limits.ctas.join(', ')}.`,
            `Facts (use only these): ${JSON.stringify(demo[0].imageParams)}`,
            'Vary the hook and angle. Respond with JSON: {"variants":[{"angle","hook","headline","long_headline","primary_text","description","cta"}]}',
          ].join('\n'),
        },
      ],
    });
    const variants = parseAiVariants(result.text, brief, demo[0]);
    if (!variants.length) throw new Error('AI returned no usable variants');
    return { variants, meta: { generator: 'ai', model: result.model, inputTokens: result.inputTokens, outputTokens: result.outputTokens, costUsd: result.costUsd, fallbackReason: null } };
  } catch (error) {
    return { variants: demo, meta: { ...DEMO_META, fallbackReason: error instanceof Error ? error.message : String(error) } };
  }
}

/** Free-form copy (captions, emails, replies). `fallback` is the demo generator's version. */
export async function writeCopy(
  request: { task: string; facts: Record<string, unknown>; maxChars: number; voice: BrandVoice; fallback: string },
  env: Record<string, string | undefined> = process.env,
): Promise<{ text: string; meta: GenerationMeta }> {
  const mode = resolveAiMode(env);
  if (!mode.live) return { text: request.fallback, meta: DEMO_META };
  try {
    const result = await gatewayText(mode.auth, {
      model: mode.model,
      maxTokens: 800,
      json: false,
      messages: [
        { role: 'system', content: voiceSystemPrompt(request.voice) },
        { role: 'user', content: `${request.task}\nFacts: ${JSON.stringify(request.facts)}\nMaximum ${request.maxChars} characters. Plain text only.` },
      ],
    });
    return { text: fitText(result.text, request.maxChars), meta: { generator: 'ai', model: result.model, inputTokens: result.inputTokens, outputTokens: result.outputTokens, costUsd: result.costUsd, fallbackReason: null } };
  } catch (error) {
    return { text: request.fallback, meta: { ...DEMO_META, fallbackReason: error instanceof Error ? error.message : String(error) } };
  }
}

/** A background photo from an image model, only in live mode. Null means "use a template". */
export async function generateBackground(prompt: string, format: AdFormat, env: Record<string, string | undefined> = process.env): Promise<{ dataUrl: string; meta: GenerationMeta } | null> {
  const mode = resolveAiMode(env);
  if (!mode.live) return null;
  try {
    const image = await gatewayImage(mode.auth, { model: mode.imageModel, prompt, aspectRatio: format.replace('1.91:1', '16:9') });
    return image ? { dataUrl: image.dataUrl, meta: { generator: 'ai', model: image.model, inputTokens: null, outputTokens: null, costUsd: image.costUsd, fallbackReason: null } } : null;
  } catch (error) {
    console.error(`[marketing/ai] background image failed, using a template: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

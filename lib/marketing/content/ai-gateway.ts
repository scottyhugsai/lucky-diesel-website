/**
 * Vercel AI Gateway over plain REST (OpenAI-compatible endpoints), because the
 * AI SDK isn't installed and new packages aren't allowed. This is the only file
 * that talks to the gateway; swap it for `generateText`/`generateImage` from
 * `ai` later without touching callers.
 *
 * Auth: AI_GATEWAY_API_KEY, or the Vercel OIDC token (VERCEL_OIDC_TOKEN, which
 * Vercel injects in deployments and `vercel env pull` writes locally).
 * Billing must be enabled on the Vercel team or requests fail with
 * `customer_verification_required` (see docs/research/marketing-tech.md §1.1).
 */

const DEFAULT_BASE = 'https://ai-gateway.vercel.sh/v1';
const TEXT_TIMEOUT_MS = 30_000;
const IMAGE_TIMEOUT_MS = 60_000;

/** USD per 1M tokens (input, output), from the gateway model list 2026-09-17. */
const PRICES: Record<string, [number, number]> = {
  'anthropic/claude-sonnet-4.6': [3, 15],
  'anthropic/claude-haiku-4.5': [1, 5],
  'openai/gpt-5-mini': [0.25, 2],
  'google/gemini-3-flash': [0.5, 3],
};
const IMAGE_PRICES: Record<string, number> = {
  'google/gemini-3.1-flash-image': 0.045,
  'google/gemini-2.5-flash-image': 0.039,
};

export interface GatewayAuth {
  token: string;
  kind: 'api_key' | 'oidc';
}

export function gatewayAuth(env: Record<string, string | undefined>): GatewayAuth | null {
  const key = env.AI_GATEWAY_API_KEY?.trim();
  if (key) return { token: key, kind: 'api_key' };
  const oidc = env.VERCEL_OIDC_TOKEN?.trim();
  if (oidc) return { token: oidc, kind: 'oidc' };
  return null;
}

export class GatewayError extends Error {
  constructor(message: string, readonly status: number, readonly type: string | null) {
    super(message);
    this.name = 'GatewayError';
  }
}

interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

interface ChatResponse {
  choices?: { message?: { content?: string | null; images?: { image_url?: { url?: string } }[] } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
  error?: { message?: string; type?: string };
}

/**
 * Monthly spend cap, checked before every paid request. Loaded lazily so this
 * file stays importable from pure code and tests; throws GatewayError 'spend_cap'.
 */
async function enforceSpendCap(): Promise<void> {
  const { monthlyAiSpend } = await import('./spend-cap');
  const status = await monthlyAiSpend();
  if (status.over) throw new GatewayError(`Monthly AI cap reached ($${status.spentUsd.toFixed(2)} of $${status.capUsd.toFixed(2)}). Using templates.`, 402, 'spend_cap');
}

async function post(auth: GatewayAuth, body: Record<string, unknown>, timeoutMs: number, base = DEFAULT_BASE): Promise<ChatResponse> {
  await enforceSpendCap();
  const response = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = (await response.json().catch(() => ({}))) as ChatResponse;
  if (!response.ok || data.error) {
    throw new GatewayError(data.error?.message ?? `AI Gateway HTTP ${response.status}`, response.status, data.error?.type ?? null);
  }
  return data;
}

export interface GatewayText {
  text: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number;
}

export async function gatewayText(
  auth: GatewayAuth,
  request: { model: string; messages: ChatMessage[]; maxTokens: number; json: boolean },
): Promise<GatewayText> {
  const data = await post(auth, {
    model: request.model,
    messages: request.messages,
    max_tokens: request.maxTokens,
    ...(request.json ? { response_format: { type: 'json_object' } } : {}),
  }, TEXT_TIMEOUT_MS);
  const text = data.choices?.[0]?.message?.content?.trim() ?? '';
  if (!text) throw new GatewayError('AI Gateway returned no text', 502, 'empty');
  const inputTokens = data.usage?.prompt_tokens ?? null;
  const outputTokens = data.usage?.completion_tokens ?? null;
  const [inPrice, outPrice] = PRICES[request.model] ?? [0, 0];
  const estimated = ((inputTokens ?? 0) * inPrice + (outputTokens ?? 0) * outPrice) / 1_000_000;
  return { text, model: request.model, inputTokens, outputTokens, costUsd: data.usage?.cost ?? estimated };
}

export interface GatewayImage {
  dataUrl: string;
  model: string;
  costUsd: number;
}

/** Image output through a multimodal chat model. Returns null when the model sends no image. */
export async function gatewayImage(auth: GatewayAuth, request: { model: string; prompt: string; aspectRatio: string }): Promise<GatewayImage | null> {
  const data = await post(auth, {
    model: request.model,
    modalities: ['text', 'image'],
    messages: [{ role: 'user', content: `${request.prompt}\nAspect ratio ${request.aspectRatio}. No text, no logos, no license plates, no people’s faces.` }],
  }, IMAGE_TIMEOUT_MS);
  const url = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url || !url.startsWith('data:image/')) return null;
  return { dataUrl: url, model: request.model, costUsd: data.usage?.cost ?? IMAGE_PRICES[request.model] ?? 0 };
}

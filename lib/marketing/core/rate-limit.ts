import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { LIMITS, type Bucket } from './rate-limit-policy';
import { createThrottle } from './requests';

export { LIMITS, type Bucket, type Limit } from './rate-limit-policy';

/**
 * Request limits counted where every instance can see them.
 *
 * The in-memory throttle this replaces kept counters in a module-level Map, so
 * on serverless each cold instance began at zero and instances multiply with
 * load. A limit of "5 per 10 minutes" was five *per instance*, and it was
 * weakest exactly when traffic was highest.
 */


/**
 * Last resort only. If Postgres cannot be reached we still refuse a flood from
 * one instance rather than letting everything through — but this is the weak
 * behaviour the shared counter exists to replace, so it logs when it is used.
 */
const fallbacks = new Map<string, ReturnType<typeof createThrottle>>();

function fallbackBlocked(bucket: Bucket, subject: string): boolean {
  const limit = LIMITS[bucket];
  let throttle = fallbacks.get(bucket);
  if (!throttle) {
    throttle = createThrottle(limit.windowSeconds * 1000, limit.max);
    fallbacks.set(bucket, throttle);
  }
  return throttle(subject);
}

/**
 * `scripts/gen-types.mjs` emits `Functions: Record<string, never>` — it
 * introspects tables and enums but not routines, so every RPC on this project
 * is untyped. Rather than loosen the client everywhere, the one call is made
 * through this signature, which states what the migration actually declares.
 */
type ConsumeRateLimit = (
  name: 'consume_rate_limit',
  args: { p_bucket: string; p_subject: string; p_window_seconds: number; p_max: number },
) => PromiseLike<{ data: boolean | null; error: { message: string } | null }>;

/**
 * True when this request is over the limit and should be refused.
 *
 * `subject` is whoever is being limited — usually the client IP, but a session
 * or account id where that identifies the caller better than an address shared
 * by a whole carrier.
 */
export async function overRateLimit(bucket: Bucket, subject: string | null): Promise<boolean> {
  const who = (subject ?? 'unknown').slice(0, 120);
  const { windowSeconds, max } = LIMITS[bucket];
  try {
    const rpc = createAdminClient().rpc as unknown as ConsumeRateLimit;
    const { data, error } = await rpc('consume_rate_limit', {
      p_bucket: bucket,
      p_subject: who,
      p_window_seconds: windowSeconds,
      p_max: max,
    });
    if (error) throw new Error(error.message);
    return data === false;
  } catch (error) {
    console.error(`[rate-limit] ${bucket} fell back to in-memory: ${error instanceof Error ? error.message : String(error)}`);
    return fallbackBlocked(bucket, who);
  }
}

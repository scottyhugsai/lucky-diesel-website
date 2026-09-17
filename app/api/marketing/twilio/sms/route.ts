import { autoReplyIfClosed } from '@/lib/marketing/core/after-hours';
import { handleInboundSms } from '@/lib/marketing/core/consent';
import { readTwilioRequest } from '@/lib/marketing/core/requests';
import { twiml } from '@/lib/marketing/core/tokens';
import { createAdminClient } from '@/lib/supabase/admin';

const XML = { 'Content-Type': 'text/xml; charset=utf-8' };

/** Twilio inbound SMS webhook: STOP / START / HELP and natural-language opt-outs. */
export async function POST(request: Request) {
  const { params, valid, reason } = await readTwilioRequest(request);
  if (!valid) return new Response(reason ?? 'forbidden', { status: 403 });
  const from = params.From ?? '';
  if (!/\d{7,}/.test(from.replace(/\D/g, ''))) return new Response(twiml(), { headers: XML });

  try {
    const db = createAdminClient();
    const result = await handleInboundSms(db, { from, body: (params.Body ?? '').slice(0, 1600), messageSid: params.MessageSid ?? null });
    // Real question outside shop hours: one auto-reply per number per 12 hours.
    if (!result.reply && result.intent === 'other') await autoReplyIfClosed(db, { from, customerId: result.customerId });
    return new Response(twiml(result.reply ?? undefined), { headers: XML });
  } catch (error) {
    console.error(`[marketing] inbound SMS failed: ${error instanceof Error ? error.message : String(error)}`);
    // Twilio retries on 5xx; an opt-out must not be lost.
    return new Response(twiml(), { status: 500, headers: XML });
  }
}

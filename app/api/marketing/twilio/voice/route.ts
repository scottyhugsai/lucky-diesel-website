import { handleVoiceStatus } from '@/lib/marketing/core/calls';
import { readTwilioRequest } from '@/lib/marketing/core/requests';
import { twiml } from '@/lib/marketing/core/tokens';

/**
 * Twilio voice status callback (or <Dial action>). A no-answer/busy call gets an
 * immediate text-back. Point the number's status callback URL here.
 */
export async function POST(request: Request) {
  const { params, valid, reason } = await readTwilioRequest(request);
  if (!valid) return new Response(reason ?? 'forbidden', { status: 403 });
  const callSid = params.CallSid ?? '';
  if (!/^CA[0-9a-fA-F]{32}$/.test(callSid) && !(process.env.DEMO_MODE === 'true' && /^[A-Za-z0-9_-]{6,64}$/.test(callSid))) {
    return new Response('missing CallSid', { status: 400 });
  }

  try {
    const result = await handleVoiceStatus({
      callSid, from: params.From ?? '', to: params.To ?? null, callStatus: params.CallStatus ?? '', dialCallStatus: params.DialCallStatus ?? null,
    });
    return new Response(twiml(), { headers: { 'Content-Type': 'text/xml; charset=utf-8', 'X-Missed-Call': result.detail.slice(0, 100) } });
  } catch (error) {
    console.error(`[marketing] voice status failed: ${error instanceof Error ? error.message : String(error)}`);
    return new Response(twiml(), { status: 500, headers: { 'Content-Type': 'text/xml; charset=utf-8' } });
  }
}

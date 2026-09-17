import { createThrottle } from '@/lib/marketing/core/requests';
import { verifyToken } from '@/lib/marketing/core/tokens';
import { createAdminClient } from '@/lib/supabase/admin';

/** 1×1 transparent GIF. */
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const throttle = createThrottle(60_000, 60);

function pixel(): Response {
  return new Response(new Uint8Array(PIXEL), {
    headers: { 'Content-Type': 'image/gif', 'Content-Length': String(PIXEL.length), 'Cache-Control': 'no-store, no-cache, must-revalidate', Pragma: 'no-cache' },
  });
}

/**
 * Email open pixel. The signed token names the campaign send, so no address or
 * customer id is ever in the URL. Opens feed send-time optimization and the
 * engagement sunset; they are never used to gate consent. Always returns the
 * image so a broken token can't show a missing-image box in someone's inbox.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const sendId = verifyToken('open', url.searchParams.get('t'))?.s;
  if (!sendId || !UUID.test(sendId)) return pixel();
  if (throttle(sendId)) return pixel();

  try {
    const db = createAdminClient();
    const { data: send } = await db.from('campaign_sends').select('id, opened_at').eq('id', sendId).maybeSingle();
    if (send && !send.opened_at) await db.from('campaign_sends').update({ opened_at: new Date().toISOString() }).eq('id', send.id).is('opened_at', null);
  } catch (error) {
    console.error(`[marketing] open tracking failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  return pixel();
}

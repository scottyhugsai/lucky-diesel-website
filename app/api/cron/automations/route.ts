import { NextResponse, type NextRequest } from 'next/server';
import { dispatchDue, emit } from '@/lib/automations/engine';
import { SHOP_TIME_ZONE } from '@/lib/format';

/**
 * Vercel Cron entry point. Sends due automation runs; the 7am run also sends
 * the owner's daily summary. Hobby plans allow one cron per day — on Pro,
 * schedule this every 5 minutes so reminders go out on time.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const now = new Date();
  const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: SHOP_TIME_ZONE }).format(now));
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: SHOP_TIME_ZONE }).format(now);

  if (hour === 7) {
    await emit({ name: 'daily.summary', subjectType: 'shop', subjectId: null, discriminator: day });
  }
  const summary = await dispatchDue({ now, limit: 200 });
  return NextResponse.json({ ok: true, ...summary });
}

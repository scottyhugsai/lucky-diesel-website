import Link from 'next/link';
import { MarketingNav } from '@/components/admin/marketing/core-ui/MarketingNav';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  await requireRole('admin');
  const supabase = await createClient();
  const { data: connections } = await supabase.from('channel_connections').select('status');
  const anyLive = (connections ?? []).some((c) => c.status === 'connected');
  const smsLive = process.env.MESSAGING_SMS_MODE === 'live';
  const demo = !anyLive || !smsLive;

  const chip = demo ? (
    <Link
      href="/admin/marketing/settings#channels"
      title="Channels aren’t connected. Sends are simulated or go to the demo inbox."
      className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-amber-400/35 bg-amber-400/10 px-2.5 text-[0.7rem] font-bold uppercase tracking-widest text-amber-300 hover:border-amber-300"
    >
      <span className="size-1.5 animate-pulse rounded-full bg-amber-300 motion-reduce:animate-none" aria-hidden="true" />
      Demo mode
    </Link>
  ) : (
    <span className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-clover/35 bg-clover/10 px-2.5 text-[0.7rem] font-bold uppercase tracking-widest text-clover">
      <span className="size-1.5 rounded-full bg-clover" aria-hidden="true" /> Live
    </span>
  );

  return (
    <>
      <MarketingNav demoChip={chip} />
      {children}
    </>
  );
}

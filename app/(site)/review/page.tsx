import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { BUSINESS } from '@/lib/site';
import { createAdminClient } from '@/lib/supabase/admin';

export const metadata: Metadata = { title: 'How did we do? | Lucky Diesel', robots: { index: false } };
export const dynamic = 'force-dynamic';

/** Review links in texts point here so the Google link can change without re-sending messages. */
export default async function ReviewPage() {
  const { data } = await createAdminClient().from('shop_settings').select('google_review_url').eq('id', 1).maybeSingle();
  if (data?.google_review_url) redirect(data.google_review_url);

  return (
    <section className="mx-auto max-w-2xl px-4 pb-24 pt-32 sm:px-6 sm:pt-40">
      <p className="kicker">Thanks for trusting us</p>
      <h1 className="display mt-4 text-[length:var(--text-display)]">How did we do?</h1>
      <p className="mt-6 text-lg text-chalk/75">
        Our Google review page is on the way. In the meantime, tell us how your truck is running. Good or bad, it goes straight to the owner.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <a href={BUSINESS.smsHref} className="btn-go display flex h-14 items-center justify-center rounded-sm px-7 text-xl not-italic">Text us</a>
        <a href={`mailto:${BUSINESS.email}?subject=How%20my%20truck%20is%20running`} className="flex h-14 items-center justify-center rounded-sm border border-chalk/25 px-7 font-semibold hover:border-clover hover:text-clover">Email the owner</a>
      </div>
    </section>
  );
}

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { QuietPage } from '@/components/site/QuietPage';
import { BUSINESS } from '@/lib/site';
import { createAdminClient } from '@/lib/supabase/admin';

export const metadata: Metadata = { title: 'How did we do? | Lucky Diesel', robots: { index: false } };
export const dynamic = 'force-dynamic';

/** Review links in texts point here so the Google link can change without re-sending messages. */
export default async function ReviewPage() {
  const { data } = await createAdminClient().from('shop_settings').select('google_review_url').eq('id', 1).maybeSingle();
  if (data?.google_review_url) redirect(data.google_review_url);

  return (
    <QuietPage
      eyebrow="Thanks for trusting us"
      title="How did we do?"
      line="Good or bad, it goes straight to the owner."
      status="The Google review link is not connected yet, so this page sends it to us directly instead."
      onward={[
        { href: BUSINESS.smsHref, label: 'Text us', line: 'The fastest way to say it.', external: true },
        { href: `mailto:${BUSINESS.email}?subject=How%20my%20truck%20is%20running`, label: 'Email the owner', line: 'If it needs more than a text.', external: true },
        { href: BUSINESS.phoneHref, label: `Call ${BUSINESS.phoneDisplay}`, line: 'If something went wrong, say it out loud.', external: true },
      ]}
    />
  );
}

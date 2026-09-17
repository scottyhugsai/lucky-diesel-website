import type { Metadata } from 'next';
import { ArrowRight, Gauge, MessageSquare } from 'lucide-react';
import { notFound } from 'next/navigation';
import { firstName, money } from '@/lib/format';
import { lookupReferralCode, normalizeReferralCode } from '@/lib/marketing/core/referrals';
import { getMarketingSettings } from '@/lib/marketing/core/settings';
import { BUSINESS } from '@/lib/site';
import { createAdminClient } from '@/lib/supabase/admin';

export const metadata: Metadata = { title: `You’re invited | ${BUSINESS.name}`, robots: { index: false, follow: false } };

/**
 * Referral landing. The buttons go through /api/marketing/referral, which validates
 * the code, sets the `ld_ref` cookie and forwards to booking with UTMs.
 */
export default async function ReferPage({ params }: { params: Promise<{ code: string }> }) {
  const code = normalizeReferralCode((await params).code);
  if (!code) notFound();
  const db = createAdminClient();
  const found = await lookupReferralCode(code, db).catch(() => null);
  if (!found) notFound();
  const [{ data: referrer }, settings] = await Promise.all([
    db.from('customers').select('full_name').eq('id', found.customerId).maybeSingle(),
    getMarketingSettings(db),
  ]);
  const name = referrer ? firstName(referrer.full_name) : 'A friend';
  const claim = `/api/marketing/referral?code=${encodeURIComponent(code)}`;
  const discount = settings.refereeDiscountCents > 0 ? money(settings.refereeDiscountCents, { whole: true }) : null;

  return (
    <section aria-labelledby="refer-heading" className="pb-28 pt-28 sm:pt-36">
      <div className="mx-auto grid max-w-2xl gap-8 px-4 sm:px-6">
        <header className="grid gap-4">
          <p className="kicker">Invited by {name}</p>
          <h1 id="refer-heading" className="display text-[length:var(--text-display)]">{discount ? `${discount} off your first job` : `${name} sent you`}</h1>
          <p className="text-lg text-chalk/80">
            {name} trusts us with their truck. Book a visit and we’ll take care of yours{discount ? `. The ${discount} comes off your first paid job.` : '.'}
          </p>
        </header>
        <div className="grid gap-3 sm:grid-cols-2">
          <a href={claim} className="btn-go display inline-flex h-14 items-center justify-center gap-2 rounded-sm text-xl not-italic [[data-design=v2]_&]:rounded-full">
            Book service <ArrowRight className="size-5" aria-hidden="true" />
          </a>
          <a href={BUSINESS.smsHref} className="inline-flex h-14 items-center justify-center gap-2 rounded-sm border border-line text-lg font-semibold hover:border-clover [[data-design=v2]_&]:rounded-full">
            <MessageSquare className="size-5 text-clover" aria-hidden="true" /> Text a question
          </a>
        </div>
        <ul className="grid gap-3 rounded-md border border-line bg-carbon-2 p-5 text-chalk/80 [[data-design=v2]_&]:rounded-2xl">
          <li className="flex gap-3"><Gauge className="size-5 shrink-0 text-clover" aria-hidden="true" />Diesel-only shop in {BUSINESS.city}.</li>
          <li className="flex gap-3"><span className="font-mono text-clover">1</span>Book online or text us.</li>
          <li className="flex gap-3"><span className="font-mono text-clover">2</span>Mention code <span className="font-mono text-chalk">{code}</span> if you call.</li>
        </ul>
        {discount && <p className="text-sm text-steel">New customers only. One per customer. Applied by the shop at checkout.</p>}
      </div>
    </section>
  );
}

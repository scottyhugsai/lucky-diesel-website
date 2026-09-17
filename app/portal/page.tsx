import Link from 'next/link';
import { CalendarDays, ChevronRight, MessageSquare, Receipt, Wrench } from 'lucide-react';
import { ButtonLink, Card, EmptyState, StatusPill } from '@/components/app/ui';
import { ActionBand } from '@/components/portal/ActionBand';
import { JobProgress } from '@/components/portal/JobProgress';
import { NotLinked } from '@/components/portal/NotLinked';
import { TruckCard } from '@/components/portal/TruckCard';
import { ReferFriendPrompt } from '@/components/marketing-public/ReferFriendPrompt';
import { loadGarage } from '@/components/portal/garage';
import { requireRole } from '@/lib/auth';
import { dateTime, firstName, SHOP_TIME_ZONE, vehicleLabel } from '@/lib/format';
import { referralShareUrl, type ReferralShare } from '@/lib/marketing/core/referral-share';
import { ensureReferralCode } from '@/lib/marketing/core/referrals';
import { getMarketingSettings } from '@/lib/marketing/core/settings';
import { siteUrl } from '@/lib/site-url';
import { createAdminClient } from '@/lib/supabase/admin';

export const metadata = { title: 'My Garage | Lucky Diesel' };

function greeting(now = new Date()): string {
  const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: SHOP_TIME_ZONE }).format(now));
  return hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
}

const QUICK_LINKS = [
  { href: '/portal/book', label: 'Book service', icon: CalendarDays },
  { href: '/portal/jobs', label: 'Job history', icon: Wrench },
  { href: '/portal/invoices', label: 'Invoices', icon: Receipt },
  { href: '/portal/messages', label: 'Messages', icon: MessageSquare },
] as const;

/** The customer's referral link, or null if it can't be made right now (the card just hides). */
async function loadReferralShare(customerId: string): Promise<ReferralShare | null> {
  try {
    const db = createAdminClient();
    const [result, settings] = await Promise.all([ensureReferralCode(customerId, db), getMarketingSettings(db)]);
    if (!result.ok) {
      console.error(`[portal] referral code for ${customerId} failed: ${result.error}`);
      return null;
    }
    return { code: result.code, url: referralShareUrl(siteUrl(), result.code), discountCents: settings.refereeDiscountCents };
  } catch (error) {
    console.error(`[portal] referral share failed: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

export default async function GaragePage() {
  const viewer = await requireRole('client');
  if (!viewer.customerId) return <NotLinked />;
  const [{ vehicles, activeJobs, actions, nextAppointment, latestDyno }, referralShare] = await Promise.all([loadGarage(viewer.customerId), loadReferralShare(viewer.customerId)]);
  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));

  return (
    <div className="space-y-8 sm:space-y-10">
      <header>
        <p className="kicker">My garage</p>
        <h1 className="display mt-2 text-5xl sm:text-6xl">
          {greeting()}, {firstName(viewer.profile.full_name) || 'there'}
        </h1>
      </header>

      <ActionBand items={actions} />

      {activeJobs.length > 0 && (
        <section aria-labelledby="in-the-shop" className="space-y-3">
          <h2 id="in-the-shop" className="text-xs font-semibold uppercase tracking-widest text-steel">In the shop</h2>
          {activeJobs.map((job) => (
            <Link key={job.id} href={`/portal/jobs/${job.id}`} className="group block rounded-md border border-line bg-carbon-2 p-4 transition-colors hover:border-clover/50 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-steel">Job #{job.number} · {vehicleLabel(vehicleById.get(job.vehicle_id))}</p>
                  <p className="display mt-1 text-3xl not-italic sm:text-4xl">{job.title}</p>
                </div>
                <StatusPill status={job.status} customer />
              </div>
              <JobProgress status={job.status} className="mt-5" />
              <p className="mt-4 flex items-center justify-between gap-3 text-sm text-chalk/60">
                <span>{job.promised_at ? `Promised ${dateTime(job.promised_at)}` : 'We’ll text you at each step.'}</span>
                <span className="flex items-center gap-1 font-semibold text-clover">
                  Details <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </p>
            </Link>
          ))}
        </section>
      )}

      <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <section aria-labelledby="my-trucks">
          <h2 id="my-trucks" className="mb-3 text-xs font-semibold uppercase tracking-widest text-steel">My trucks</h2>
          {vehicles.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {vehicles.map((vehicle) => {
                const dyno = latestDyno.get(vehicle.id);
                return <TruckCard key={vehicle.id} vehicle={vehicle} horsepower={dyno?.horsepower ?? null} torque={dyno?.torque ?? null} />;
              })}
            </div>
          ) : (
            <EmptyState title="No trucks yet">We add your truck at check-in.</EmptyState>
          )}
        </section>

        <div className="space-y-6">
          <Card title="Next appointment">
            {nextAppointment ? (
              <div>
                <p className="display text-2xl not-italic">{nextAppointment.service_label}</p>
                <p className="mt-1 text-chalk/75">{dateTime(nextAppointment.starts_at)}</p>
                <p className="mt-1 text-sm text-steel">{vehicleLabel(vehicleById.get(nextAppointment.vehicle_id ?? ''))}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-chalk/65">Nothing on the calendar.</p>
                <ButtonLink href="/portal/book" size="sm">Book service</ButtonLink>
              </div>
            )}
          </Card>
          <nav aria-label="Quick links" className="grid grid-cols-2 gap-2">
            {QUICK_LINKS.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className="flex min-h-14 items-center gap-2.5 rounded-md border border-line bg-carbon-2 px-3 text-sm font-semibold transition-colors hover:border-clover/50 hover:text-clover">
                <Icon className="size-4 text-clover" aria-hidden="true" />
                {label}
              </Link>
            ))}
          </nav>
          {referralShare && <ReferFriendPrompt share={referralShare} />}
        </div>
      </div>
    </div>
  );
}

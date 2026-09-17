import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PrintButton } from '@/components/admin/core/InvoiceTools';
import { UUID_RE } from '@/components/admin/core/parse';
import { requireRole } from '@/lib/auth';
import { money } from '@/lib/format';
import { buildProposal } from '@/lib/marketing/fleet/fleet-math';
import { loadFleetDetail } from '@/lib/marketing/fleet/fleet-service';
import { BUSINESS } from '@/lib/site';
import { createAdminClient } from '@/lib/supabase/admin';

export const metadata = { title: 'Fleet proposal | Lucky Diesel admin' };

/* Print only the proposal sheet, on white, without the app chrome. */
const PRINT_CSS = `
@media print {
  @page { margin: 12mm; }
  html, body { background: #fff !important; }
  aside, nav[aria-label="App"], header.sticky { display: none !important; }
  body * { visibility: hidden !important; }
  #proposal-doc, #proposal-doc * { visibility: visible !important; }
  #proposal-doc { position: absolute; inset: 0 auto auto 0; width: 100%; box-shadow: none !important; border: 0 !important; }
}`;

const today = () => new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' }).format(new Date());

export default async function FleetProposalPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole('admin');
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const db = createAdminClient();
  const [detail, { data: settings }] = await Promise.all([
    loadFleetDetail(db, id),
    db.from('shop_settings').select('labor_rate_cents').limit(1).maybeSingle(),
  ]);
  if (!detail) notFound();
  const { fleet } = detail;

  const sections = buildProposal(
    {
      fleetName: fleet.name,
      contactName: fleet.contact_name,
      truckCount: fleet.truck_count ?? detail.trucks.length,
      pmDays: fleet.pm_interval_days,
      pmMiles: fleet.pm_interval_miles,
      terms: fleet.billing_terms,
      priority: fleet.priority,
      slaHours: fleet.sla_hours,
      laborDiscountPct: fleet.labor_discount_pct,
      laborRateCents: settings?.labor_rate_cents ?? 16_500,
    },
    (cents) => money(cents),
  );

  return (
    <div>
      <style>{PRINT_CSS}</style>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/admin/marketing/growth/fleet/${id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-steel hover:text-chalk">
          <ArrowLeft className="size-4" aria-hidden="true" /> Report
        </Link>
        <PrintButton />
      </div>

      <article id="proposal-doc" className="mx-auto max-w-3xl rounded-md bg-[#f7f8f6] text-[#111412] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)] print:rounded-none print:shadow-none">
        <div className="h-2 bg-[#1fbf3f] print:h-1.5" aria-hidden="true" />
        <div className="grid gap-8 p-6 sm:p-10">
          <header className="grid gap-4 border-b border-[#111412]/15 pb-6 sm:flex sm:items-start sm:justify-between sm:gap-6">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-widest text-[#111412]/55">Fleet proposal</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight">{fleet.name}</h1>
              {fleet.contact_name && <p className="mt-1 text-[#111412]/70">Attn: {fleet.contact_name}</p>}
            </div>
            <div className="shrink-0 text-sm sm:text-right">
              <p className="font-bold">{BUSINESS.name}</p>
              <p className="text-[#111412]/70">{BUSINESS.city}, {BUSINESS.region}</p>
              <p className="text-[#111412]/70">{BUSINESS.phoneDisplay}</p>
              <p className="mt-2 text-[#111412]/55">{today()}</p>
            </div>
          </header>

          {sections.map((section) => (
            <section key={section.heading} className="grid gap-2">
              <h2 className="text-xs font-bold uppercase tracking-widest text-[#111412]/55">{section.heading}</h2>
              <ul className="grid gap-1.5">
                {section.lines.map((line) => (
                  <li key={line} className="flex gap-2 text-[0.95rem] leading-relaxed">
                    <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-[#1fbf3f]" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <footer className="border-t border-[#111412]/15 pt-5 text-sm text-[#111412]/70">
            <p>Prices hold for 30 days. Call {BUSINESS.phoneDisplay} to get on the schedule.</p>
          </footer>
        </div>
      </article>
    </div>
  );
}

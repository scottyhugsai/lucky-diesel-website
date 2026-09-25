import type { Metadata } from 'next';
import { RETENTION } from '@/lib/retention';
import { BUSINESS } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Privacy Policy | Lucky Diesel',
  description: 'How Lucky Diesel collects, uses and protects your information, including text messaging.',
  alternates: { canonical: '/privacy' },
};

/* DRAFT for attorney review. Includes the SMS disclosures carriers require for 10DLC registration. */
const SECTIONS = [
  {
    title: 'What we collect',
    body: 'When you request service, book, or use your customer portal, we collect your name, phone number, email, vehicle details (such as VIN, engine and mileage), service history, photos taken during inspections, and payment records. Card details are handled by our payment processor, Stripe; we never store full card numbers.',
  },
  {
    title: 'How we use it',
    body: 'To respond to your request, schedule and perform work, send estimates, job updates, invoices and receipts, keep your service history, send service reminders, and improve our service.',
  },
  {
    title: 'Text messages',
    body: 'If you opt in, we text you about your service request, appointments, estimates, job status and service reminders. Message frequency varies. Message and data rates may apply. Reply STOP to opt out at any time or HELP for help. Consent is not a condition of purchase. Mobile numbers and text-messaging opt-in data are never shared with or sold to third parties or affiliates for marketing purposes.',
  },
  {
    title: 'Who we share with',
    body: 'Only service providers that help us run the shop (hosting, email and text delivery, payments), bound to use your data solely for that purpose, or when the law requires it. We do not sell personal information.',
  },
  {
    title: 'How we protect it',
    body: 'Your portal is protected by sign-in, and the database enforces separately that one customer\u2019s records cannot be read by another. Payment card numbers never reach us. Our own staff accounts are reviewed regularly.',
  },
  {
    title: 'How long we keep it',
    body: 'We do not keep personal information indefinitely. Each kind has a limit, and when it is reached we delete it.',
    table: RETENTION,
  },
  {
    title: 'Your choices',
    body: `Ask us to update or delete your information by calling ${BUSINESS.phoneDisplay} or emailing ${BUSINESS.email}.`,
  },
] as const;

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 pb-24 pt-32 sm:px-6 sm:pt-40">
      <p className="kicker">Legal</p>
      <h1 className="display mt-4 text-[length:var(--text-display)]">Privacy policy</h1>
      <p className="mt-4 rounded-sm border border-line bg-carbon-2 px-4 py-3 text-sm text-steel">
        Draft pending review. {BUSINESS.legalName}, {BUSINESS.city}, {BUSINESS.region}. Last updated September 2026.
      </p>
      <div className="mt-12 space-y-10">
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="display text-3xl not-italic">{section.title}</h2>
            <p className="mt-3 text-lg leading-relaxed text-chalk/75">{section.body}</p>
            {'table' in section && (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-line">
                      <th scope="col" className="py-3 pr-4 font-semibold">What</th>
                      <th scope="col" className="py-3 pr-4 font-semibold">Kept for</th>
                      <th scope="col" className="py-3 font-semibold">Then</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.table.map((rule) => (
                      <tr key={rule.data} className="border-b border-line align-top">
                        <td className="py-3 pr-4 text-chalk/85">{rule.data}</td>
                        <td className="py-3 pr-4 whitespace-nowrap text-chalk/70">{rule.kept}</td>
                        <td className="py-3 text-chalk/70">{rule.then}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}
      </div>
    </article>
  );
}

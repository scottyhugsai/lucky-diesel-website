import type { Metadata } from 'next';
import { CalendarClock, FileText, Gauge, Wrench } from 'lucide-react';
import { BUSINESS } from '@/lib/site';
import { FleetInquiryForm } from './FleetInquiryForm';

export const metadata: Metadata = {
  title: `Fleet service | ${BUSINESS.name}`,
  description: `Preventive maintenance, priority bays and net terms for work trucks in ${BUSINESS.city}, ${BUSINESS.region}.`,
  alternates: { canonical: '/fleet' },
};

const INCLUDED = [
  { icon: CalendarClock, title: 'PM on schedule', body: 'We track every unit by days or miles and tell you what’s coming due.' },
  { icon: Wrench, title: 'Priority bays', body: 'Fleet accounts get bays held back so a down truck gets looked at fast.' },
  { icon: FileText, title: 'Net terms', body: 'Net 15 or net 30, with one monthly statement listing every invoice.' },
  { icon: Gauge, title: 'Monthly report', body: 'Units serviced, spend, time in shop and what’s due next month.' },
];

const STEPS = [
  { step: '01', title: 'Walk the yard', body: 'We list your units and set a PM interval for each one.' },
  { step: '02', title: 'Get a proposal', body: 'Labor rate, terms and response time in writing before anything starts.' },
  { step: '03', title: 'Run the schedule', body: 'You get a weekly heads-up and a monthly report. We keep the trucks moving.' },
];

export default function FleetPage() {
  return (
    <div className="pb-24 pt-28 sm:pt-36">
      <div className="mx-auto grid max-w-6xl gap-16 px-4 sm:px-6">
        <section aria-labelledby="fleet-heading" className="grid gap-4">
          <p className="kicker">Fleet &amp; B2B</p>
          <h1 id="fleet-heading" className="display text-[length:var(--text-display)]">Keep the trucks working</h1>
          <p className="max-w-xl text-lg text-chalk/75">
            Diesel PM, diagnostics and repair for work trucks around {BUSINESS.city}. One shop, one invoice, one schedule.
          </p>
          <p className="text-sm text-steel">Serving {BUSINESS.areaServed.join(' · ')}</p>
        </section>

        <section aria-labelledby="fleet-included" className="grid gap-6">
          <h2 id="fleet-included" className="display text-4xl not-italic">What you get</h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {INCLUDED.map(({ icon: Icon, title, body }) => (
              <li key={title} className="grid gap-2 rounded-md border border-line bg-carbon-2 p-6">
                <Icon className="size-5 text-clover" aria-hidden="true" />
                <h3 className="display text-2xl not-italic">{title}</h3>
                <p className="text-chalk/75">{body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="fleet-steps" className="grid gap-6">
          <h2 id="fleet-steps" className="display text-4xl not-italic">How it starts</h2>
          <ol className="grid gap-4 sm:grid-cols-3">
            {STEPS.map(({ step, title, body }) => (
              <li key={step} className="grid gap-2 rounded-md border border-line bg-carbon-2 p-6">
                <span className="font-mono text-sm text-clover">{step}</span>
                <h3 className="display text-2xl not-italic">{title}</h3>
                <p className="text-chalk/75">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="quote" aria-labelledby="fleet-quote" className="grid gap-6 scroll-mt-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start lg:gap-12">
          <div className="grid gap-3">
            <h2 id="fleet-quote" className="display text-4xl not-italic">Get a fleet quote</h2>
            <p className="text-chalk/75">Tell us what you run. We’ll call to talk through units and terms.</p>
            <p className="text-sm text-steel">
              Prefer the phone? <a href={BUSINESS.phoneHref} className="text-clover underline-offset-4 hover:underline">{BUSINESS.phoneDisplay}</a>
            </p>
          </div>
          <div className="rounded-md border border-line bg-carbon-2 p-6 sm:p-8">
            <FleetInquiryForm />
          </div>
        </section>
      </div>
    </div>
  );
}

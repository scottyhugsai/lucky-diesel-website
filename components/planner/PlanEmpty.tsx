'use client';

import { MessageSquare, Phone } from 'lucide-react';
import { BUSINESS } from '@/lib/site';
import { QuoteRequest } from './QuoteRequest';
import { truckLabel, type PlannerState } from './state';
import { BTN_GHOST, BTN_PRIMARY, SURFACE } from './ui';

function ContactButtons() {
  return (
    <div className="flex flex-col gap-2.5 sm:flex-row">
      <a href={BUSINESS.phoneHref} className={`${BTN_PRIMARY} w-full sm:w-auto`}>
        <Phone className="size-5" aria-hidden="true" /> Call {BUSINESS.phoneDisplay}
      </a>
      <a href={BUSINESS.smsHref} className={`${BTN_GHOST} w-full sm:w-auto`}>
        <MessageSquare className="size-4 text-clover" aria-hidden="true" /> Text us
      </a>
    </div>
  );
}

/** Shopify is unreachable: send them to a human. */
export function CatalogDown() {
  return (
    <div role="status" className={`${SURFACE} grid max-w-xl gap-5 p-6`}>
      <p className="text-lg text-chalk/80">Parts list is updating. Call or text and we’ll plan it with you.</p>
      <ContactButtons />
    </div>
  );
}

/** Nothing listed for this generation yet. */
export function NoFitment({ state }: { state: PlannerState }) {
  return (
    <div className="grid max-w-xl gap-6">
      <div role="status" className="grid gap-2">
        <h2 className="text-2xl font-semibold">Tell us about your truck.</h2>
        <p className="text-chalk/75">We don’t list parts for the {truckLabel(state)} online yet. We still build them.</p>
      </div>
      <div className={`${SURFACE} p-5`}>
        <QuoteRequest state={state} plan={null} submitLabel="Send my truck" />
      </div>
      <ContactButtons />
    </div>
  );
}

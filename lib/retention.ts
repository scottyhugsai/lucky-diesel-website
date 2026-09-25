/**
 * How long each kind of personal data is kept.
 *
 * Published on /privacy, which makes it a commitment to the customer rather
 * than a note in a repository. That is why it lives here and not in a
 * document: docs/SECURITY.md points at this file instead of restating it, so
 * the promise on the page and the answer in the codebase cannot drift apart.
 *
 * DRAFT alongside the rest of /privacy, pending attorney review.
 */

export interface RetentionRule {
  /** Named as a customer would recognise it, not as the table is named. */
  data: string;
  kept: string;
  then: string;
  /** The tables it covers, for whoever has to implement the deletion. */
  tables: readonly string[];
}

export const RETENTION: readonly RetentionRule[] = [
  {
    data: 'Enquiries that did not become a job',
    kept: '24 months',
    then: 'Deleted',
    tables: ['leads'],
  },
  {
    data: 'Customer records and service history',
    kept: 'While you are a customer, then 7 years',
    then: 'Deleted, apart from what tax law requires us to keep',
    tables: ['customers', 'vehicles', 'work_orders', 'invoices'],
  },
  {
    data: 'Quote forms you started but did not finish',
    kept: '90 days',
    then: 'Deleted',
    tables: ['partial_leads'],
  },
  {
    data: 'Which pages you visited and how you found us',
    kept: '14 months',
    then: 'Deleted',
    tables: ['tracking_visitors', 'attribution_touches'],
  },
  {
    data: 'Texts, emails and call records',
    kept: '24 months',
    then: 'Deleted',
    tables: ['messages', 'calls'],
  },
  {
    data: 'A record of you agreeing to be contacted',
    kept: '7 years',
    then: 'Kept — it is the proof you asked to hear from us',
    tables: ['contact_consent_events'],
  },
] as const;

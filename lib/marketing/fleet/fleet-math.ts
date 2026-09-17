/**
 * Pure fleet & B2B rules: net terms, prospect CSV import, monthly/quarterly
 * reports and the proposal outline. No I/O, so it is unit-tested directly.
 */

const DAY_MS = 86_400_000;

export const BILLING_TERMS = ['due_on_receipt', 'net_15', 'net_30'] as const;
export type BillingTerms = (typeof BILLING_TERMS)[number];
export const TERMS_LABEL: Record<BillingTerms, string> = { due_on_receipt: 'Due on receipt', net_15: 'Net 15', net_30: 'Net 30' };
const TERMS_DAYS: Record<BillingTerms, number> = { due_on_receipt: 0, net_15: 15, net_30: 30 };

/** Retail customers keep the shop's default 7 days. */
export const RETAIL_DUE_DAYS = 7;

export function isBillingTerms(value: unknown): value is BillingTerms {
  return typeof value === 'string' && (BILLING_TERMS as readonly string[]).includes(value);
}

/** Invoice due date: fleet terms when the customer belongs to an active fleet account, else retail default. */
export function dueDateForTerms(terms: string | null | undefined, issuedAt: Date): Date {
  const days = isBillingTerms(terms) ? TERMS_DAYS[terms] : RETAIL_DUE_DAYS;
  return new Date(issuedAt.getTime() + days * DAY_MS);
}

export function daysOverdue(dueAt: string | null, now: Date): number {
  if (!dueAt) return 0;
  return Math.max(0, Math.floor((now.getTime() - Date.parse(dueAt)) / DAY_MS));
}

// ─── Prospect import ───────────────────────────────────────────────────────

export interface ProspectRow {
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  truckCount: number | null;
  city: string | null;
}

export const PROSPECT_COLUMNS = ['company', 'contact', 'phone', 'email', 'trucks', 'city'] as const;
export const MAX_PROSPECT_ROWS = 200;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Splits one CSV line, honouring double-quoted cells. */
export function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cell += '"'; i += 1; } else if (ch === '"') quoted = false; else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { cells.push(cell); cell = ''; } else cell += ch;
  }
  cells.push(cell);
  return cells.map((c) => c.trim());
}

function formatPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  const local = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  return local.length === 10 ? `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}` : null;
}

/**
 * `company, contact, phone, email, trucks, city` — header row optional.
 * Bad rows are reported by line number and skipped; duplicates (same company) are dropped.
 */
export function parseProspectCsv(input: string): { rows: ProspectRow[]; errors: string[] } {
  const lines = input.replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim()).filter(Boolean);
  const rows: ProspectRow[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  lines.forEach((line, index) => {
    const cells = splitCsvLine(line);
    if (index === 0 && cells[0]?.toLowerCase() === 'company') return;
    const lineNo = index + 1;
    const [name = '', contact = '', phoneRaw = '', emailRaw = '', trucksRaw = '', city = ''] = cells;
    if (name.length < 2 || name.length > 120) { errors.push(`Line ${lineNo}: company name missing.`); return; }
    const phone = phoneRaw ? formatPhone(phoneRaw) : null;
    if (phoneRaw && !phone) { errors.push(`Line ${lineNo}: bad phone.`); return; }
    const email = emailRaw ? emailRaw.toLowerCase() : null;
    if (email && (!EMAIL.test(email) || email.length > 254)) { errors.push(`Line ${lineNo}: bad email.`); return; }
    const trucks = trucksRaw ? Number(trucksRaw.replace(/,/g, '')) : null;
    if (trucks !== null && (!Number.isInteger(trucks) || trucks < 0 || trucks > 100_000)) { errors.push(`Line ${lineNo}: bad truck count.`); return; }
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    if (rows.length >= MAX_PROSPECT_ROWS) { errors.push(`Only the first ${MAX_PROSPECT_ROWS} rows were read.`); return; }
    rows.push({ name, contactName: contact.slice(0, 120) || null, phone, email, truckCount: trucks, city: city.slice(0, 80) || null });
  });
  return { rows, errors: [...new Set(errors)] };
}

/** Plain-text intro a person sends 1:1 from their own mailbox (CAN-SPAM opt-out line included). */
export function introEmail(prospect: { name: string; contactName: string | null; truckCount: number | null }, shop: { name: string; phone: string; siteUrl: string }): { subject: string; body: string } {
  const hello = prospect.contactName ? `Hi ${prospect.contactName.split(' ')[0]},` : 'Hi,';
  const units = prospect.truckCount ? `your ${prospect.truckCount} trucks` : 'your trucks';
  return {
    subject: `Diesel maintenance for ${prospect.name}`,
    body: `${hello}\n\n${shop.name} keeps work trucks on the road: PM on your schedule, priority bays for fleet units, one monthly invoice on net terms.\n\nWorth a 10-minute call about ${units}? ${shop.phone}\n\nFleet details: ${shop.siteUrl}/fleet\n\nIf this isn't useful, reply "no thanks" and we won't email again.`,
  };
}

// ─── Reports ───────────────────────────────────────────────────────────────

export interface ReportJob { vehicleId: string; createdAt: string; completedAt: string | null; status: string; totalCents: number }
export interface ReportInvoice { id: string; number: number; totalCents: number; status: string; createdAt: string; dueAt: string | null; paidAt: string | null }
export interface ReportTruck { id: string; label: string; nextDue: string | null; overdue: boolean }

export interface FleetReport {
  from: string;
  to: string;
  jobs: number;
  unitsServiced: number;
  spendCents: number;
  avgDowntimeDays: number | null;
  openBalanceCents: number;
  overdueCents: number;
  dueSoon: ReportTruck[];
}

export function monthRange(month: string): { from: Date; to: Date } | null {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  if (!match) return null;
  const year = Number(match[1]);
  const m = Number(match[2]);
  return { from: new Date(Date.UTC(year, m - 1, 1)), to: new Date(Date.UTC(year, m, 1)) };
}

export function quarterRange(at: Date): { from: Date; to: Date; label: string } {
  const q = Math.floor(at.getUTCMonth() / 3);
  const year = at.getUTCFullYear();
  return { from: new Date(Date.UTC(year, q * 3, 1)), to: new Date(Date.UTC(year, q * 3 + 3, 1)), label: `Q${q + 1} ${year}` };
}

export function previousMonth(at: Date): string {
  const d = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Units serviced, spend, downtime (check-in → done) and balance for one period. */
export function buildFleetReport(input: { jobs: ReportJob[]; invoices: ReportInvoice[]; trucks: ReportTruck[] }, from: Date, to: Date, now: Date): FleetReport {
  const inRange = (iso: string | null) => Boolean(iso) && Date.parse(iso!) >= from.getTime() && Date.parse(iso!) < to.getTime();
  const jobs = input.jobs.filter((j) => j.status !== 'cancelled' && inRange(j.completedAt ?? j.createdAt));
  const downtimes = jobs.filter((j) => j.completedAt).map((j) => (Date.parse(j.completedAt!) - Date.parse(j.createdAt)) / DAY_MS);
  const open = input.invoices.filter((i) => i.status === 'open');
  const soon = now.getTime() + 30 * DAY_MS;
  return {
    from: from.toISOString(),
    to: to.toISOString(),
    jobs: jobs.length,
    unitsServiced: new Set(jobs.map((j) => j.vehicleId)).size,
    spendCents: input.invoices.filter((i) => i.status === 'paid' && inRange(i.paidAt)).reduce((t, i) => t + i.totalCents, 0),
    avgDowntimeDays: downtimes.length ? Math.round((downtimes.reduce((a, b) => a + b, 0) / downtimes.length) * 10) / 10 : null,
    openBalanceCents: open.reduce((t, i) => t + i.totalCents, 0),
    overdueCents: open.filter((i) => i.dueAt && Date.parse(i.dueAt) < now.getTime()).reduce((t, i) => t + i.totalCents, 0),
    dueSoon: input.trucks.filter((t) => t.overdue || (t.nextDue !== null && Date.parse(t.nextDue) <= soon)),
  };
}

export function reportEmailBody(fleetName: string, periodLabel: string, report: FleetReport, money: (cents: number) => string): string {
  const due = report.dueSoon.length ? report.dueSoon.slice(0, 8).map((t) => `• ${t.label}`).join('\n') : 'Nothing due in the next 30 days.';
  return [
    `${fleetName} — ${periodLabel}`,
    '',
    `Units serviced: ${report.unitsServiced}`,
    `Jobs: ${report.jobs}`,
    `Spend: ${money(report.spendCents)}`,
    `Avg. time in shop: ${report.avgDowntimeDays === null ? '—' : `${report.avgDowntimeDays} days`}`,
    `Open balance: ${money(report.openBalanceCents)}${report.overdueCents ? ` (${money(report.overdueCents)} past due)` : ''}`,
    '',
    'Due for PM:',
    due,
  ].join('\n');
}

// ─── Proposal ──────────────────────────────────────────────────────────────

export interface ProposalInput {
  fleetName: string;
  contactName: string | null;
  truckCount: number;
  pmDays: number;
  pmMiles: number;
  terms: string;
  priority: boolean;
  slaHours: number;
  laborDiscountPct: number;
  laborRateCents: number;
}

export interface ProposalSection { heading: string; lines: string[] }

export function buildProposal(input: ProposalInput, money: (cents: number) => string): ProposalSection[] {
  const rate = Math.round(input.laborRateCents * (1 - input.laborDiscountPct / 100));
  const terms = isBillingTerms(input.terms) ? TERMS_LABEL[input.terms] : 'Due on receipt';
  const units = input.truckCount > 0 ? `${input.truckCount} unit${input.truckCount === 1 ? '' : 's'}` : 'your units';
  return [
    { heading: 'What you get', lines: [
      `Preventive maintenance on ${units} every ${input.pmDays} days or ${input.pmMiles.toLocaleString('en-US')} miles, whichever comes first.`,
      'Weekly heads-up email listing units coming due.',
      'Monthly report: units serviced, spend, time in shop, balance.',
    ] },
    { heading: 'Priority service', lines: input.priority
      ? [`Reserved fleet bays. A down unit is looked at within ${input.slaHours} business hours.`]
      : ['Standard scheduling. Priority bays available on request.'] },
    { heading: 'Pricing', lines: [
      `Labor: ${money(rate)}/hr${input.laborDiscountPct ? ` (${input.laborDiscountPct}% fleet rate)` : ''}.`,
      'Parts at list. Every estimate approved before work starts.',
    ] },
    { heading: 'Billing', lines: [`${terms}. One statement per month with every invoice listed.`] },
  ];
}

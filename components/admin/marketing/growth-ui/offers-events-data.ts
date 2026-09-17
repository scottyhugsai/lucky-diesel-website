import 'server-only';
import { money } from '@/lib/format';
import { costCentsFromSnapshot, creatorCommissionCents, promoRoi, type Roi } from '@/lib/marketing/core/promotions';
import { loadProgramSettings, type ProgramSettings } from '@/lib/marketing/core/redemption';
import { createAdminClient } from '@/lib/supabase/admin';

export interface OfferRow {
  id: string;
  code: string;
  name: string;
  valueLabel: string;
  endsAt: string | null;
  active: boolean;
  expired: boolean;
  redemptions: number;
  limit: number | null;
  perCustomer: number;
  discountCents: number;
  segment: string | null;
  terms: string | null;
  singleUse: boolean;
  isPublic: boolean;
  bundleItems: string[];
  bundlePriceCents: number | null;
  giftItem: string | null;
  creatorName: string | null;
  commissionPercent: number;
  commissionCents: number;
  codes: { total: number; used: number };
  roi: Roi;
}

/** Offers with redemption roll-ups: money given, revenue, margin and ROI. */
export async function loadOffers(now = new Date()): Promise<OfferRow[]> {
  const db = createAdminClient();
  const { data, error } = await db.from('offers').select('*, offer_redemptions(discount_cents, invoice_id), offer_codes(redeemed_at), segments(name)').order('created_at', { ascending: false });
  if (error) throw new Error(`Could not load offers: ${error.message}`);
  const offers = data ?? [];
  const invoiceIds = [...new Set(offers.flatMap((o) => o.offer_redemptions.flatMap((r) => (r.invoice_id ? [r.invoice_id] : []))))];
  const { data: invoices } = invoiceIds.length ? await db.from('invoices').select('id, subtotal_cents, line_snapshot').in('id', invoiceIds) : { data: [] };
  const invoiceById = new Map((invoices ?? []).map((i) => [i.id, { subtotal: i.subtotal_cents, cost: costCentsFromSnapshot(i.line_snapshot) }]));
  return offers.map((o) => {
    const roi = promoRoi(o.offer_redemptions.flatMap((r) => {
      const invoice = r.invoice_id ? invoiceById.get(r.invoice_id) : undefined;
      return invoice ? [{ discountCents: r.discount_cents, invoiceSubtotalCents: invoice.subtotal, invoiceCostCents: invoice.cost }] : [];
    }));
    return {
      id: o.id, code: o.code, name: o.name, endsAt: o.ends_at, active: o.active, terms: o.terms,
      valueLabel: o.bundle_price_cents !== null ? `${money(o.bundle_price_cents, { whole: true })} bundle` : o.kind === 'percent' ? `${o.value}% off` : o.kind === 'amount' ? `${money(o.value, { whole: true })} off` : o.gift_item ? `Free ${o.gift_item}` : `Free (${money(o.value, { whole: true })})`,
      expired: Boolean(o.ends_at && new Date(o.ends_at) < now),
      redemptions: o.offer_redemptions.length, limit: o.max_redemptions, perCustomer: o.per_customer_limit,
      discountCents: o.offer_redemptions.reduce((t, r) => t + r.discount_cents, 0), segment: o.segments?.name ?? null,
      singleUse: o.single_use, isPublic: o.public, bundleItems: o.bundle_items, bundlePriceCents: o.bundle_price_cents,
      giftItem: o.gift_item, creatorName: o.creator_name, commissionPercent: o.creator_commission_percent,
      commissionCents: o.creator_name ? creatorCommissionCents(roi.revenueCents, o.creator_commission_percent) : 0,
      codes: { total: o.offer_codes.length, used: o.offer_codes.filter((c) => c.redeemed_at).length },
      roi,
    };
  });
}

/** Point value, tier perks, fleet volume tiers and military percent. */
export async function loadPricingPrograms(): Promise<ProgramSettings> {
  return loadProgramSettings(createAdminClient());
}

export interface EventRow {
  id: string;
  slug: string;
  name: string;
  kind: string;
  startsAt: string;
  location: string | null;
  capacity: number | null;
  published: boolean;
  registrationOpen: boolean;
  registered: number;
  waitlist: number;
  checkedIn: number;
}

export async function loadEvents(): Promise<EventRow[]> {
  const { data, error } = await createAdminClient().from('events').select('*, event_registrations(status)').order('starts_at', { ascending: false });
  if (error) throw new Error(`Could not load events: ${error.message}`);
  return (data ?? []).map((e) => {
    const regs = e.event_registrations;
    return {
      id: e.id, slug: e.slug, name: e.name, kind: e.kind, startsAt: e.starts_at, location: e.location, capacity: e.capacity,
      published: e.published, registrationOpen: e.registration_open,
      registered: regs.filter((r) => r.status === 'registered' || r.status === 'checked_in').length,
      waitlist: regs.filter((r) => r.status === 'waitlist').length,
      checkedIn: regs.filter((r) => r.status === 'checked_in').length,
    };
  });
}

export interface FleetRow {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  billingTerms: string;
  stage: string;
  source: string | null;
  city: string | null;
  website: string | null;
  truckCount: number | null;
  priority: boolean;
  slaHours: number;
  laborDiscountPct: number;
  pmDays: number;
  pmMiles: number;
  notes: string | null;
  trucks: { id: string; label: string; owner: string; lastService: string | null; nextDue: string | null; overdue: boolean }[];
}

export async function loadFleets(now = new Date()): Promise<FleetRow[]> {
  const db = createAdminClient();
  const { data: fleets, error } = await db.from('fleet_accounts').select('*, customers!customers_fleet_account_id_fkey(id, full_name, vehicles(id, year, make, model, nickname))').order('name');
  if (error) throw new Error(`Could not load fleet accounts: ${error.message}`);
  const vehicleIds = (fleets ?? []).flatMap((f) => f.customers.flatMap((c) => c.vehicles.map((v) => v.id)));
  const { data: orders } = vehicleIds.length
    ? await db.from('work_orders').select('vehicle_id, completed_at, created_at').in('vehicle_id', vehicleIds).order('created_at', { ascending: false })
    : { data: [] };
  const lastByVehicle = new Map<string, string>();
  for (const o of orders ?? []) {
    const when = o.completed_at ?? o.created_at;
    if (!lastByVehicle.has(o.vehicle_id)) lastByVehicle.set(o.vehicle_id, when);
  }
  return (fleets ?? []).map((f) => ({
    id: f.id, name: f.name, contactName: f.contact_name, email: f.email, phone: f.phone, billingTerms: f.billing_terms,
    stage: f.stage, source: f.source, city: f.city, website: f.website, truckCount: f.truck_count,
    priority: f.priority, slaHours: f.sla_hours, laborDiscountPct: f.labor_discount_pct,
    pmDays: f.pm_interval_days, pmMiles: f.pm_interval_miles, notes: f.notes,
    trucks: f.customers.flatMap((c) => c.vehicles.map((v) => {
      const last = lastByVehicle.get(v.id) ?? null;
      const next = last ? new Date(new Date(last).getTime() + f.pm_interval_days * 86_400_000).toISOString() : null;
      const label = v.nickname || [v.year, v.make, v.model].filter(Boolean).join(' ') || 'Truck';
      return { id: v.id, label, owner: c.full_name, lastService: last, nextDue: next, overdue: !next || new Date(next) < now };
    })),
  }));
}

export interface RegistrationRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  vehicle: string | null;
  status: string;
  mediaConsent: boolean;
  createdAt: string;
}

export async function loadEventDetail(id: string): Promise<{ event: EventRow; registrations: RegistrationRow[] } | null> {
  const db = createAdminClient();
  const { data: e } = await db.from('events').select('*, event_registrations(*)').eq('id', id).maybeSingle();
  if (!e) return null;
  const regs = e.event_registrations;
  return {
    event: {
      id: e.id, slug: e.slug, name: e.name, kind: e.kind, startsAt: e.starts_at, location: e.location, capacity: e.capacity, published: e.published, registrationOpen: e.registration_open,
      registered: regs.filter((r) => r.status === 'registered' || r.status === 'checked_in').length, waitlist: regs.filter((r) => r.status === 'waitlist').length, checkedIn: regs.filter((r) => r.status === 'checked_in').length,
    },
    registrations: [...regs].sort((a, b) => a.created_at.localeCompare(b.created_at)).map((r) => ({
      id: r.id, name: r.full_name, phone: r.phone, email: r.email, vehicle: [r.platform, r.vehicle_label].filter(Boolean).join(' · ') || null, status: r.status, mediaConsent: r.media_consent, createdAt: r.created_at,
    })),
  };
}

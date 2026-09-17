import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { predictMileage, type MileageReading } from './scoring';
import { categorizeService, evaluateSegment, parseSegmentRules, type ContactFacts, type ParseResult, type SegmentRules } from './segment-rules';
import type { Db } from './settings';

const CHUNK = 500;

/**
 * Loads everything the segment rules can look at, with fixed queries. At this
 * shop's scale (hundreds to low thousands of customers) evaluating in memory is
 * simpler and safer than generating SQL.
 */
export async function loadContactFacts(db: Db, now = new Date()): Promise<ContactFacts[]> {
  const [customers, vehicles, workOrders, invoices, builds, tunes, loyalty, suppressions] = await Promise.all([
    db.from('customers').select('id, email, phone, tags, source, lifecycle_stage, is_fleet, email_marketing_status, sms_opted_out_at, sms_marketing_consent_at, sms_marketing_opted_out_at'),
    db.from('vehicles').select('id, customer_id, platform, generation, engine_code, mileage, created_at'),
    db.from('work_orders').select('customer_id, vehicle_id, title, mileage_in, status, completed_at, created_at').neq('status', 'cancelled'),
    db.from('invoices').select('customer_id, total_cents, paid_at').eq('status', 'paid'),
    db.from('build_items').select('vehicle_id, category, part_name, installed_at, created_at'),
    db.from('tune_records').select('vehicle_id, flashed_at'),
    db.from('loyalty_accounts').select('customer_id, tier'),
    db.from('suppressions').select('channel, address'),
  ]);
  for (const result of [customers, vehicles, workOrders, invoices]) {
    if (result.error) throw new Error(`segment facts query failed: ${result.error.message}`);
  }

  const vehicleOwner = new Map((vehicles.data ?? []).map((v) => [v.id, v.customer_id]));
  const suppressed = new Set((suppressions.data ?? []).map((s) => `${s.channel}:${s.address}`));
  const tierBy = new Map((loyalty.data ?? []).map((l) => [l.customer_id, l.tier]));

  return (customers.data ?? []).map((c): ContactFacts => {
    const trucks = (vehicles.data ?? []).filter((v) => v.customer_id === c.id);
    const jobs = (workOrders.data ?? []).filter((w) => w.customer_id === c.id);
    const paid = (invoices.data ?? []).filter((i) => i.customer_id === c.id && i.paid_at);
    const services = [
      ...jobs.flatMap((w) => categorizeService(w.title).map((category) => ({ category, at: new Date(w.completed_at ?? w.created_at) }))),
      ...(builds.data ?? []).filter((b) => vehicleOwner.get(b.vehicle_id) === c.id)
        .flatMap((b) => categorizeService(`${b.category} ${b.part_name}`).map((category) => ({ category, at: new Date(b.installed_at ?? b.created_at) }))),
      ...(tunes.data ?? []).filter((t) => vehicleOwner.get(t.vehicle_id) === c.id).map((t) => ({ category: 'tune' as const, at: new Date(t.flashed_at) })),
    ];
    const mileages = trucks.map((truck) => {
      const readings: MileageReading[] = jobs.filter((w) => w.vehicle_id === truck.id && w.mileage_in).map((w) => ({ at: new Date(w.created_at), miles: w.mileage_in! }));
      if (truck.mileage) readings.push({ at: new Date(truck.created_at), miles: truck.mileage });
      return predictMileage(readings, now);
    }).filter((m): m is number => m !== null);
    const lastPaid = paid.map((i) => Date.parse(i.paid_at!)).sort((a, b) => b - a)[0];
    const emailSuppressed = c.email ? suppressed.has(`email:${c.email.toLowerCase()}`) : true;

    return {
      customerId: c.id,
      platforms: [...new Set(trucks.map((t) => t.platform).filter((p): p is string => Boolean(p)))],
      generations: trucks.map((t) => [t.generation, t.engine_code].filter(Boolean).join(' ')).filter(Boolean),
      mileage: mileages.length ? Math.max(...mileages) : null,
      lastVisitAt: lastPaid ? new Date(lastPaid) : null,
      paidVisits: paid.length,
      lifetimeValueCents: paid.reduce((sum, i) => sum + i.total_cents, 0),
      tags: c.tags,
      smsMarketing: Boolean(c.phone && c.sms_marketing_consent_at && !c.sms_marketing_opted_out_at && !c.sms_opted_out_at),
      emailMarketing: Boolean(c.email && c.email_marketing_status === 'subscribed' && !emailSuppressed),
      lifecycleStage: c.lifecycle_stage,
      loyaltyTier: tierBy.get(c.id) ?? 'stock',
      source: c.source,
      isFleet: c.is_fleet,
      services,
    };
  });
}

export function validateSegmentRules(input: unknown): ParseResult {
  return parseSegmentRules(input);
}

/** Customer ids matching rules right now, without saving anything. */
export async function previewSegment(rules: SegmentRules, db: Db = createAdminClient(), now = new Date()): Promise<{ count: number; customerIds: string[] }> {
  const customerIds = evaluateSegment(rules, await loadContactFacts(db, now), now);
  return { count: customerIds.length, customerIds };
}

async function materialize(db: Db, segmentId: string, customerIds: string[]): Promise<void> {
  const { data: current, error } = await db.from('segment_members').select('customer_id').eq('segment_id', segmentId);
  if (error) throw new Error(`segment members load failed: ${error.message}`);
  const next = new Set(customerIds);
  const removed = (current ?? []).map((m) => m.customer_id).filter((id) => !next.has(id));
  const existing = new Set((current ?? []).map((m) => m.customer_id));
  const added = customerIds.filter((id) => !existing.has(id));
  for (let i = 0; i < removed.length; i += CHUNK) {
    await db.from('segment_members').delete().eq('segment_id', segmentId).in('customer_id', removed.slice(i, i + CHUNK));
  }
  for (let i = 0; i < added.length; i += CHUNK) {
    const { error: insertError } = await db.from('segment_members').upsert(
      added.slice(i, i + CHUNK).map((customer_id) => ({ segment_id: segmentId, customer_id })),
      { onConflict: 'segment_id,customer_id', ignoreDuplicates: true },
    );
    if (insertError) throw new Error(`segment members insert failed: ${insertError.message}`);
  }
}

/** Re-evaluates one segment and stores its members and count. */
export async function refreshSegment(segmentId: string, db: Db = createAdminClient(), facts?: ContactFacts[], now = new Date()): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const { data: segment } = await db.from('segments').select('id, rules').eq('id', segmentId).maybeSingle();
  if (!segment) return { ok: false, error: 'Segment not found.' };
  const parsed = parseSegmentRules(segment.rules);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const members = evaluateSegment(parsed.rules, facts ?? (await loadContactFacts(db, now)), now);
  await materialize(db, segmentId, members);
  await db.from('segments').update({ member_count: members.length, refreshed_at: now.toISOString() }).eq('id', segmentId);
  return { ok: true, count: members.length };
}

export async function refreshAllSegments(db: Db = createAdminClient(), now = new Date()): Promise<{ refreshed: number; errors: string[] }> {
  const { data: segments } = await db.from('segments').select('id, name');
  const facts = await loadContactFacts(db, now);
  const errors: string[] = [];
  for (const segment of segments ?? []) {
    const result = await refreshSegment(segment.id, db, facts, now);
    if (!result.ok) errors.push(`${segment.name}: ${result.error}`);
  }
  return { refreshed: (segments?.length ?? 0) - errors.length, errors };
}

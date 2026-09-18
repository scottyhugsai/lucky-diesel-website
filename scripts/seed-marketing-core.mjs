#!/usr/bin/env node
/**
 * Demo data for marketing core (migration 008): consent, segments, campaigns,
 * offers, referrals, loyalty, attribution, a dyno day. Fictional and relative to
 * now. Runs at the end of seed-demo.mjs, or alone (needs seeded customers):
 *   node --env-file=.env.local scripts/seed-marketing-core.mjs
 */
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { categorizeService, evaluateSegment } from '../lib/marketing/core/segment-rules.ts';
import { scoreLead } from '../lib/marketing/core/scoring.ts';

const DAY = 86_400_000;
const HOUR = 3_600_000;
const TABLES = ['marketing_call_events', 'event_registrations', 'events', 'conversion_events', 'campaign_sends', 'campaign_enrollments', 'campaign_steps', 'short_links', 'attribution_touches', 'tracking_visitors', 'campaigns', 'offer_redemptions', 'referrals', 'referral_codes', 'offers', 'segment_members', 'segments', 'loyalty_events', 'loyalty_accounts', 'suppressions', 'contact_consent_events', 'pipeline_stages', 'marketing_settings', 'fleet_accounts'];
const TIERS = [['full_build', 1_500_000], ['stage_2', 500_000], ['stage_1', 100_000]];

async function must(promise, label) {
  const { data, error } = await promise;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

const phoneE164 = (p) => `+1${p.replace(/\D/g, '').slice(-10)}`;

/** Multi-row inserts with differing keys: omitted columns take their defaults instead of null. */
function withColumnDefaults(client) {
  return { from(table) { const query = client.from(table); const insert = query.insert.bind(query); query.insert = (rows, options) => insert(rows, { defaultToNull: false, ...options }); return query; } };
}

export async function seedMarketingCore({ db: client, sql, now = Date.now() }) {
  const db = withColumnDefaults(client);
  const iso = (ms) => new Date(ms).toISOString();
  const ago = (days) => iso(now - days * DAY);
  console.log('marketing core…');
  // DELETE, not TRUNCATE … CASCADE: customers and leads reference these tables, and a cascade would wipe them.
  await sql`update customers set tags = '{}', birthday = null, is_fleet = false, fleet_account_id = null, email_marketing_status = 'subscribed', sms_marketing_consent_at = null, sms_marketing_consent_version = null, sms_marketing_opted_out_at = null, first_touch_id = null, last_touch_id = null, first_touch_source = null, last_touch_source = null`;
  await sql`update leads set pipeline_stage_id = null, first_touch_id = null, last_touch_id = null`;
  for (const table of TABLES) await sql.unsafe(`delete from ${table}`);

  const customers = await must(db.from('customers').select('*').order('created_at'), 'customers');
  if (!customers.length) throw new Error('seed customers first (scripts/seed-demo.mjs)');
  const byName = Object.fromEntries(customers.map((c) => [c.full_name.split(' ')[0], c]));
  const [vehicles, workOrders, invoices, leads, appointments] = await Promise.all([
    must(db.from('vehicles').select('*'), 'vehicles'), must(db.from('work_orders').select('*'), 'work orders'),
    must(db.from('invoices').select('*'), 'invoices'), must(db.from('leads').select('*'), 'leads'), must(db.from('appointments').select('*'), 'appointments'),
  ]);
  const paid = invoices.filter((i) => i.status === 'paid');

  // ── Settings, pipeline, fleet ──
  await must(db.from('marketing_settings').insert({ id: 1, sender_name: 'Lucky Diesel', reply_to_email: 'service@luckydiesel.com', postal_address: 'Lucky Diesel LLC · Charleston, SC (demo address)', sms_business_name: 'Lucky Diesel' }), 'settings');
  const stages = await must(db.from('pipeline_stages').insert([
    ['new', 'New', 0, 10], ['contacted', 'Contacted', 1, 20], ['quoted', 'Quoted', 2, 40], ['booked', 'Booked', 3, 70], ['in_shop', 'In shop', 4, 85], ['won', 'Won', 5, 100], ['lost', 'Lost', 6, 0],
  ].map(([key, name, sort, score_weight]) => ({ key, name, sort, score_weight, is_won: key === 'won', is_lost: key === 'lost' }))).select(), 'stages');
  for (const lead of leads) {
    const stage = stages.find((s) => s.key === lead.status);
    const lead_score = scoreLead({ serviceId: lead.service_id, platform: lead.platform, source: lead.source, status: lead.status, smsConsent: lead.sms_consent, detailsLength: lead.details?.length ?? 0, createdAt: new Date(lead.created_at), now: new Date(now) });
    await must(db.from('leads').update({ pipeline_stage_id: stage?.id ?? null, lead_score }).eq('id', lead.id), 'lead stage');
  }
  const fleet = await must(db.from('fleet_accounts').insert({ name: 'Lowcountry Marine Services', contact_customer_id: byName.Hank.id, contact_name: 'Hank Wallace', email: byName.Hank.email, phone: byName.Hank.phone, billing_terms: 'net_15', pm_interval_miles: 7500, pm_interval_days: 90, notes: 'Two tow rigs for boat deliveries. Batch PM on Mondays.' }).select().single(), 'fleet');

  // ── Contact fields & consent ledger ──
  const TAGS = { Cody: ['tows', 'camper', 'performance'], Marcus: ['tows', 'boat'], Hank: ['fleet', 'tows', 'boat'], Savannah: ['tows', 'horse trailer'], Luis: ['daily driver'], Ray: ['classic'], Kayla: ['military'], Austin: ['performance'] };
  const BIRTHDAYS = { Cody: '1991-03-14', Marcus: '1984-11-02', Kayla: '1996-07-21' };
  const ledger = [];
  const suppressions = [];
  for (const [index, c] of customers.entries()) {
    const first = c.full_name.split(' ')[0];
    const marketingSms = c.sms_consent && index % 3 !== 2;
    const patch = { tags: TAGS[first] ?? [], birthday: BIRTHDAYS[first] ?? null, is_fleet: first === 'Hank', fleet_account_id: first === 'Hank' ? fleet.id : null };
    if (c.sms_consent) ledger.push({ customer_id: c.id, channel: 'sms', purpose: 'transactional', action: 'granted', method: 'form', address: phoneE164(c.phone), consent_text_version: c.sms_consent_version, evidence: { url: '/book', ip: '203.0.113.10' }, created_at: c.sms_consent_at });
    if (marketingSms) {
      Object.assign(patch, { sms_marketing_consent_at: c.sms_consent_at, sms_marketing_consent_version: 'mkt-2026-09-16' });
      ledger.push({ customer_id: c.id, channel: 'sms', purpose: 'marketing', action: 'granted', method: 'form', address: phoneE164(c.phone), consent_text_version: 'mkt-2026-09-16', evidence: { url: '/book', text: 'Send me promos and event invites (max 2/week).' }, created_at: c.sms_consent_at });
    }
    if (first === 'Derek') {
      patch.email_marketing_status = 'unsubscribed';
      ledger.push({ customer_id: c.id, channel: 'email', purpose: 'marketing', action: 'revoked', method: 'unsubscribe_link', address: c.email, evidence: { ip: '198.51.100.7' }, created_at: ago(9) });
      suppressions.push({ channel: 'email', address: c.email, scope: 'marketing', reason: 'unsubscribe_link', customer_id: c.id, created_at: ago(9) });
    }
    await must(db.from('customers').update(patch).eq('id', c.id), 'customer marketing fields');
  }
  const trey = byName.Trey;
  ledger.push({ customer_id: trey.id, channel: 'sms', purpose: 'transactional', action: 'revoked', method: 'keyword_stop', address: phoneE164(trey.phone), evidence: { text: 'STOP' }, created_at: ago(5) });
  suppressions.push({ channel: 'sms', address: phoneE164(trey.phone), scope: 'all', reason: 'keyword_stop', customer_id: trey.id, created_at: ago(5) });
  await must(db.from('customers').update({ sms_consent: false, sms_opted_out_at: ago(5) }).eq('id', trey.id), 'trey stop');
  await must(db.from('contact_consent_events').insert(ledger), 'consent ledger');
  await must(db.from('suppressions').insert(suppressions), 'suppressions');

  // ── Attribution: touches + conversions tied to seeded customers and leads ──
  const SOURCE_OVERRIDE = { Derek: 'facebook', Austin: 'facebook', Savannah: 'google' };
  const touchFor = (source, at, extra = {}) => ({
    source, occurred_at: at, touch_type: 'first', landing_path: { google: '/duramax', facebook: '/build-planner', instagram: '/gallery', tiktok: '/', referral: '/book', direct: '/' }[source],
    medium: { google: 'cpc', facebook: 'paid_social', instagram: 'social', tiktok: 'social', referral: 'referral', direct: null }[source],
    campaign: { google: 'diesel-repair-near-me', facebook: 'fall-tune-leads', instagram: 'build-reels', tiktok: 'dyno-clips' }[source] ?? null,
    gclid: source === 'google' ? `demo-gclid-${Math.round(Date.parse(at) / 1000)}` : null, fbclid: source === 'facebook' ? `demo-fbclid-${Math.round(Date.parse(at) / 1000)}` : null, ...extra,
  });
  const touches = [];
  for (const c of customers) {
    const first = c.full_name.split(' ')[0];
    const source = SOURCE_OVERRIDE[first] ?? { website: 'direct', 'online booking': 'direct', instagram: 'instagram', referral: 'referral', tiktok: 'tiktok', google: 'google' }[c.source] ?? 'direct';
    touches.push({ customer_id: c.id, anonymous_id: `demo${c.id.replace(/-/g, '').slice(0, 20)}`, ...touchFor(source, iso(Date.parse(c.created_at) - 2 * DAY)) });
  }
  const LEAD_SOURCES = { Wyatt: 'google', Emily: 'facebook', Ben: 'instagram', Garrett: 'referral', Nate: 'tiktok' };
  for (const lead of leads) touches.push({ lead_id: lead.id, ...touchFor(LEAD_SOURCES[lead.full_name.split(' ')[0]] ?? 'direct', iso(Date.parse(lead.created_at) - 3 * HOUR)) });
  const insertedTouches = await must(db.from('attribution_touches').insert(touches).select('id, customer_id, lead_id, source, anonymous_id'), 'touches');
  await must(db.from('tracking_visitors').insert(insertedTouches.filter((t) => t.anonymous_id).map((t) => ({ anonymous_id: t.anonymous_id, customer_id: t.customer_id, first_seen_at: ago(80) }))), 'visitors');
  const touchOf = (key, id) => insertedTouches.find((t) => t[key] === id);
  for (const t of insertedTouches.filter((x) => x.customer_id)) {
    await must(db.from('customers').update({ first_touch_id: t.id, last_touch_id: t.id, first_touch_source: t.source, last_touch_source: t.source }).eq('id', t.customer_id), 'customer touch');
  }
  for (const t of insertedTouches.filter((x) => x.lead_id)) await must(db.from('leads').update({ first_touch_id: t.id, last_touch_id: t.id }).eq('id', t.lead_id), 'lead touch');

  const conversion = (kind, key, touch, fields) => ({ kind, dedupe_key: key, source: touch?.source ?? 'direct', first_source: touch?.source ?? 'direct', first_touch_id: touch?.id ?? null, last_touch_id: touch?.id ?? null, ...fields });
  const conversions = [
    ...customers.map((c) => conversion('lead', `lead:customer:${c.id}`, touchOf('customer_id', c.id), { customer_id: c.id, occurred_at: c.created_at })),
    ...leads.map((l) => conversion('lead', `lead:${l.id}`, touchOf('lead_id', l.id), { lead_id: l.id, occurred_at: l.created_at })),
    // One booking per customer (their first job); repeat visits show up as paid jobs and revenue.
    ...customers.flatMap((c) => {
      const firstJob = workOrders.filter((w) => w.customer_id === c.id && w.status !== 'cancelled').sort((x, y) => x.created_at.localeCompare(y.created_at))[0];
      const appt = appointments.find((a) => a.customer_id === c.id);
      // Same dedupe keys as syncConversions, so the cron doesn't count these twice.
      if (appt) return [conversion('booking', `booking:${appt.id}`, touchOf('customer_id', c.id), { customer_id: c.id, appointment_id: appt.id, occurred_at: appt.created_at })];
      return firstJob ? [conversion('booking', `booking:work_order:${firstJob.id}`, touchOf('customer_id', c.id), { customer_id: c.id, occurred_at: firstJob.created_at })] : [];
    }),
    ...paid.map((i) => conversion('job_paid', `job_paid:${i.id}`, touchOf('customer_id', i.customer_id), { customer_id: i.customer_id, invoice_id: i.id, value_cents: i.total_cents, occurred_at: i.paid_at })),
    ...[['Cody', 1.5], ['Kayla', 4], ['Austin', 12]].map(([name, days]) => conversion('store_checkout_click', `store_checkout_click:demo:${name}`, touchOf('customer_id', byName[name].id), { customer_id: byName[name].id, value_cents: 189_900, occurred_at: ago(days), metadata: { product: 'DDP 66mm Stage 2 turbocharger' } })),
  ];
  // Two leads booked through the lead form: bookings attributed to those leads.
  for (const l of leads.filter((x) => ['booked', 'won'].includes(x.status))) conversions.push(conversion('booking', `booking:lead:${l.id}`, touchOf('lead_id', l.id), { lead_id: l.id, occurred_at: iso(Date.parse(l.created_at) + 20 * HOUR) }));
  await must(db.from('conversion_events').insert(conversions), 'conversions');

  // ── Loyalty ──
  const spend = new Map();
  for (const i of paid) spend.set(i.customer_id, (spend.get(i.customer_id) ?? 0) + i.total_cents);
  await must(db.from('loyalty_events').insert(paid.map((i) => ({ customer_id: i.customer_id, kind: 'earn', points: Math.floor(i.total_cents / 100), invoice_id: i.id, note: 'Paid invoice', dedupe_key: `earn:invoice:${i.id}`, created_at: i.paid_at }))), 'loyalty events');
  await must(db.from('loyalty_accounts').insert([...spend].map(([customer_id, cents]) => ({
    customer_id, points_balance: Math.floor(cents / 100), lifetime_points: Math.floor(cents / 100), lifetime_spend_cents: cents,
    tier: TIERS.find(([, min]) => cents >= min)?.[0] ?? 'stock', tier_updated_at: ago(3),
  }))), 'loyalty accounts');

  // ── Offers & referrals ──
  const offers = await must(db.from('offers').insert([
    { code: 'TOWREADY', name: 'Tow-ready inspection $25 off', kind: 'amount', value: 2500, terms: 'Pre-towing inspection. One per customer.', ends_at: ago(-45), max_redemptions: 60 },
    { code: 'FALLFUEL10', name: '10% off fuel filter service', kind: 'percent', value: 10, min_spend_cents: 15000, terms: 'Fuel filter service over $150. Ends soon.', starts_at: ago(20), ends_at: ago(-30), max_redemptions: 100 },
    { code: 'FRIEND25', name: 'Referred friend: $25 off first job', kind: 'amount', value: 2500, terms: 'First visit only, via a customer referral link.' },
    { code: 'DYNO-DAY', name: 'Free dyno pull at Fall Dyno Day', kind: 'free_service', value: 7500, terms: 'Registered, street-legal trucks only.', ends_at: ago(-25) },
  ]).select(), 'offers');
  const offer = Object.fromEntries(offers.map((o) => [o.code, o]));
  const invoiceOf = (name) => paid.filter((i) => i.customer_id === byName[name].id).sort((a, b) => a.paid_at.localeCompare(b.paid_at))[0];
  await must(db.from('offer_redemptions').insert([
    { offer_id: offer.FALLFUEL10.id, customer_id: byName.Kayla.id, invoice_id: invoiceOf('Kayla')?.id, discount_cents: 3140, redeemed_at: invoiceOf('Kayla')?.paid_at },
    { offer_id: offer.FALLFUEL10.id, customer_id: byName.Hank.id, invoice_id: invoiceOf('Hank')?.id, discount_cents: 3140, redeemed_at: ago(6) },
    { offer_id: offer.FRIEND25.id, customer_id: byName.Kayla.id, invoice_id: invoiceOf('Kayla')?.id, discount_cents: 2500, redeemed_at: invoiceOf('Kayla')?.paid_at },
  ]), 'redemptions');
  const codes = await must(db.from('referral_codes').insert([['Cody', 'CODY-7KQ2', 2], ['Marcus', 'MARCUS-4HTW', 1], ['Hank', 'HANK-9PRM', 1], ['Ray', 'RAY-3XDN', 0]].map(([name, code, uses]) => ({ customer_id: byName[name].id, code, uses, referee_offer_id: offer.FRIEND25.id }))).select(), 'referral codes');
  const codeOf = (name) => codes.find((c) => c.customer_id === byName[name].id);
  const garrett = leads.find((l) => l.full_name.startsWith('Garrett'));
  const referrals = await must(db.from('referrals').insert([
    { referral_code_id: codeOf('Marcus').id, referrer_customer_id: byName.Marcus.id, referred_customer_id: byName.Kayla.id, status: 'rewarded', invoice_id: invoiceOf('Kayla')?.id, reward_cents: 5000, qualified_at: invoiceOf('Kayla')?.paid_at, rewarded_at: invoiceOf('Kayla')?.paid_at, created_at: byName.Kayla.created_at },
    { referral_code_id: codeOf('Cody').id, referrer_customer_id: byName.Cody.id, referred_customer_id: byName.Austin.id, status: 'pending', created_at: byName.Austin.created_at },
    { referral_code_id: codeOf('Cody').id, referrer_customer_id: byName.Cody.id, lead_id: garrett?.id ?? null, status: 'pending', created_at: garrett?.created_at ?? ago(2) },
  ]).select(), 'referrals');
  await must(db.from('loyalty_events').insert({ customer_id: byName.Marcus.id, kind: 'referral_bonus', points: 50, note: 'Referral reward: Kayla Bennett', dedupe_key: `referral:${referrals[0].id}` }), 'referral bonus');

  return seedCampaignsAndEvents({ db, sql, now, customers, vehicles, workOrders, paid, byName, offer, ago, iso });
}

/** Segments (materialized with the real rule engine), campaigns with sends, a dyno day and calls. */
async function seedCampaignsAndEvents({ db, sql, now, customers, vehicles, workOrders, paid, byName, offer, ago, iso }) {
  const fresh = await must(db.from('customers').select('*'), 'customers again');
  const facts = fresh.map((c) => {
    const trucks = vehicles.filter((v) => v.customer_id === c.id);
    const mine = paid.filter((i) => i.customer_id === c.id);
    return {
      customerId: c.id, platforms: [...new Set(trucks.map((t) => t.platform))], generations: trucks.map((t) => `${t.generation} ${t.engine_code}`), mileage: Math.max(0, ...trucks.map((t) => t.mileage ?? 0)) || null,
      lastVisitAt: mine.length ? new Date(Math.max(...mine.map((i) => Date.parse(i.paid_at)))) : null, paidVisits: mine.length, lifetimeValueCents: mine.reduce((s, i) => s + i.total_cents, 0),
      tags: c.tags, smsMarketing: Boolean(c.sms_marketing_consent_at && !c.sms_opted_out_at), emailMarketing: c.email_marketing_status === 'subscribed', lifecycleStage: c.lifecycle_stage,
      loyaltyTier: 'stock', source: c.source, isFleet: c.is_fleet,
      services: workOrders.filter((w) => w.customer_id === c.id && w.status !== 'cancelled').flatMap((w) => categorizeService(w.title).map((category) => ({ category, at: new Date(w.completed_at ?? w.created_at) }))),
    };
  });
  const SEGMENTS = [
    ['Tuned trucks, no turbo yet', 'Next-stage upgrade candidates.', { match: 'all', conditions: [{ field: 'service_history', op: 'has_any', values: ['tune'] }, { field: 'service_history', op: 'has_none', values: ['turbo'] }] }],
    ['Towing crowd', 'Boat, camper and trailer owners for towing season.', { match: 'any', conditions: [{ field: 'tags', op: 'has_any', values: ['tows', 'boat', 'camper', 'horse trailer'] }] }],
    ['Powerstroke owners', 'Every 6.0/6.4/6.7/7.3 in the book.', { match: 'all', conditions: [{ field: 'platform', op: 'in', values: ['powerstroke'] }] }],
    ['Active email subscribers', 'Paid visit on file and subscribed to email.', { match: 'all', conditions: [{ field: 'consent', op: 'is', value: 'email_marketing' }, { field: 'has_visited', op: 'is', value: true }] }],
  ];
  const segments = {};
  for (const [name, description, rules] of SEGMENTS) {
    const members = evaluateSegment(rules, facts, new Date(now));
    const seg = await must(db.from('segments').insert({ name, description, rules, member_count: members.length, refreshed_at: ago(0.1) }).select().single(), 'segment');
    if (members.length) await must(db.from('segment_members').insert(members.map((customer_id) => ({ segment_id: seg.id, customer_id }))), 'segment members');
    segments[name] = { ...seg, members };
  }

  const campaign = async (row, steps) => {
    const created = await must(db.from('campaigns').insert(row).select().single(), `campaign ${row.name}`);
    await must(db.from('campaign_steps').insert(steps.map((s) => ({ campaign_id: created.id, ...s }))), 'steps');
    return created;
  };
  const sentAt = now - 12 * DAY + 14 * HOUR;
  const broadcast = await campaign(
    { name: 'September fuel system special', kind: 'broadcast', channel: 'email', status: 'sent', segment_id: segments['Active email subscribers'].id, offer_id: offer.FALLFUEL10.id, scheduled_at: iso(sentAt), started_at: iso(sentAt), completed_at: iso(sentAt + 5 * HOUR), ab_test_percent: 40, ab_winner_metric: 'click', ab_winner_variant: 'B', utm_campaign: 'sept-fuel' },
    [{ step_order: 1, variant: 'A', subject: 'Fuel filters due, {{first_name}}?', body: 'Hey {{first_name}},\n\nFuel filters protect the injectors on {{vehicle}}. Use {{offer_code}} for 10% off a fuel filter service this month.\n\nBook: {{link}}\n\n— Lucky Diesel' },
     { step_order: 1, variant: 'B', subject: '10% off keeps {{vehicle}} injectors happy', body: 'Hey {{first_name}},\n\nCheap insurance for expensive injectors: code {{offer_code}} takes 10% off a fuel filter service this month.\n\nGrab a slot: {{link}}\n\n— Lucky Diesel' }],
  );
  await must(db.from('short_links').insert({ code: 'sept-fuel', target_url: '/book?service=maintenance', campaign_id: broadcast.id, utm_source: 'email', utm_medium: 'email', clicks: 5, last_clicked_at: ago(10) }), 'short link');
  const sends = segments['Active email subscribers'].members.map((customer_id, i) => {
    const variant = i % 5 < 2 ? (i % 2 ? 'B' : 'A') : 'B';
    const clicked = i % 3 === 0;
    return { campaign_id: broadcast.id, customer_id, channel: 'email', variant, dedupe_key: `campaign:${broadcast.id}:step:1:customer:${customer_id}`, status: 'sent', scheduled_for: iso(sentAt), claimed_at: iso(sentAt), sent_at: iso(sentAt + (i % 5 < 2 ? 0 : 4 * HOUR)), detail: 'sent', opened_at: i % 4 !== 3 ? iso(sentAt + 2 * HOUR) : null, clicked_at: clicked ? iso(sentAt + 3 * HOUR) : null, click_count: clicked ? 1 : 0, converted_at: i % 6 === 0 ? iso(sentAt + DAY) : null, revenue_cents: i === 0 ? 43_415 : 0 };
  });
  if (sends.length) await must(db.from('campaign_sends').insert(sends), 'broadcast sends');

  const drip = await campaign(
    { name: 'Post-tune care drip', kind: 'drip', channel: 'sms', status: 'active', segment_id: segments['Tuned trucks, no turbo yet'].id, started_at: ago(40), utm_campaign: 'tune-care' },
    [{ step_order: 1, delay_minutes: 0, body: 'Lucky Diesel: thanks for trusting us with the tune on {{vehicle}}, {{first_name}}. Questions? Just reply. Reply STOP to opt out.' },
     { step_order: 2, delay_minutes: 7 * 1440, body: 'Lucky Diesel: free datalog review for {{vehicle}} this month. Send a log or book: {{link}} Reply STOP to opt out.' },
     { step_order: 3, delay_minutes: 30 * 1440, body: 'Lucky Diesel: thinking about the next stage for {{vehicle}}? See compliant turbo options: {{link}} Reply STOP to opt out.' }],
  );
  await must(db.from('short_links').insert({ code: 'tune-care', target_url: '/build-planner', campaign_id: drip.id, utm_source: 'sms', utm_medium: 'sms', clicks: 2, last_clicked_at: ago(3) }), 'drip link');
  for (const [i, customer_id] of segments['Tuned trucks, no turbo yet'].members.entries()) {
    const enrolledAt = now - (35 - i * 12) * DAY;
    const done = Math.min(3, Math.floor((now - enrolledAt) / DAY >= 30 ? 3 : (now - enrolledAt) / DAY >= 7 ? 2 : 1));
    const exited = i === 1;
    const status = exited ? 'exited' : done === 3 ? 'completed' : 'active';
    const nextAt = status === 'active' ? enrolledAt + (done === 1 ? 7 : 30) * DAY : null;
    const enrollment = await must(db.from('campaign_enrollments').insert({ campaign_id: drip.id, customer_id, variant: 'A', status, current_step: status === 'active' ? done + 1 : done, enrolled_at: iso(enrolledAt), next_step_at: nextAt ? iso(nextAt) : null, exited_at: exited ? iso(enrolledAt + 9 * DAY) : null, exit_reason: exited ? 'booked' : null }).select().single(), 'enrollment');
    const rows = [1, 2, 3].slice(0, exited ? 2 : done).map((step) => ({ campaign_id: drip.id, step_order: step, enrollment_id: enrollment.id, customer_id, channel: 'sms', variant: 'A', dedupe_key: `campaign:${drip.id}:step:${step}:customer:${customer_id}`, status: exited && step === 2 ? 'cancelled' : 'simulated', scheduled_for: iso(enrolledAt + [0, 7, 30][step - 1] * DAY), claimed_at: iso(enrolledAt), sent_at: exited && step === 2 ? null : iso(enrolledAt + [0, 7, 30][step - 1] * DAY), detail: exited && step === 2 ? 'exited: booked' : 'simulated', clicked_at: step === 2 && i === 0 ? iso(enrolledAt + 7.2 * DAY) : null, click_count: step === 2 && i === 0 ? 1 : 0 }));
    if (nextAt) rows.push({ campaign_id: drip.id, step_order: done + 1, enrollment_id: enrollment.id, customer_id, channel: 'sms', variant: 'A', dedupe_key: `campaign:${drip.id}:step:${done + 1}:customer:${customer_id}`, status: 'scheduled', scheduled_for: iso(nextAt) });
    if (rows.length) await must(db.from('campaign_sends').insert(rows), 'drip sends');
  }

  const winterAt = new Date(now + 28 * DAY);
  winterAt.setUTCHours(14, 0, 0, 0);
  await campaign({ name: 'Winter diesel prep', kind: 'broadcast', channel: 'email', status: 'scheduled', segment_id: segments['Active email subscribers'].id, scheduled_at: iso(winterAt.getTime()), seasonal_key: 'winter_diesel', utm_campaign: 'winter-diesel' },
    [{ step_order: 1, subject: 'Cold starts, trips north and anti-gel', body: 'Hey {{first_name}},\n\nBefore winter trips we check batteries, glow plugs or grid heater and fuel filters on {{vehicle}}, and add anti-gel.\n\nBook a winter check: {{link}}\n\n— Lucky Diesel' }]);
  await campaign({ name: 'Towing season text', kind: 'broadcast', channel: 'sms', status: 'draft', segment_id: segments['Towing crowd'].id, offer_id: offer.TOWREADY.id, utm_campaign: 'towing-season' },
    [{ step_order: 1, body: 'Lucky Diesel: boat season is coming, {{first_name}}. $25 off a tow-ready inspection with {{offer_code}}: {{link}} Reply STOP to opt out.' }]);
  await campaign({ name: 'Lost lead re-engagement', kind: 'lifecycle', channel: 'email', status: 'active', trigger_event: 'lead.lost', exit_on: ['booked', 'replied', 'unsubscribed'], started_at: ago(20) },
    [{ step_order: 1, delay_minutes: 60 * 1440, subject: 'Still thinking about {{vehicle}}?', body: 'Hey {{first_name}},\n\nNo pressure, just checking in. We can stage work to fit a budget. Reply or book: {{link}}\n\n— Lucky Diesel' },
     { step_order: 2, delay_minutes: 60 * 1440, subject: 'New builds this season', body: 'Hey {{first_name}},\n\nHere is what has been rolling out of the shop lately: {{link}}\n\n— Lucky Diesel' }]);

  // ── Dyno day & missed calls ──
  const dyno = new Date(now + 24 * DAY);
  dyno.setUTCDate(dyno.getUTCDate() + ((6 - dyno.getUTCDay() + 7) % 7));
  dyno.setUTCHours(14, 0, 0, 0);
  const event = await must(db.from('events').insert({ slug: 'fall-dyno-day', name: 'Fall Dyno Day', kind: 'dyno_day', description: 'Timed pulls on the chassis dyno, food truck and a street-legal build showcase. Waiver required.', location: 'Lucky Diesel shop, Charleston SC', starts_at: iso(dyno.getTime()), ends_at: iso(dyno.getTime() + 6 * HOUR), capacity: 30, price_cents: 0, published: true, is_sample: true }).select().single(), 'event');
  await must(db.from('event_registrations').insert([
    { event_id: event.id, customer_id: byName.Cody.id, full_name: 'Cody Brooks', email: byName.Cody.email, phone: byName.Cody.phone, vehicle_label: '2021 GMC Sierra 2500HD L5P', platform: 'duramax', slot_at: iso(dyno.getTime() + HOUR), waiver_signed_at: ago(2), media_consent: true },
    { event_id: event.id, customer_id: byName.Luis.id, full_name: 'Luis Ortega', email: byName.Luis.email, phone: byName.Luis.phone, vehicle_label: '2022 Ford F-350 6.7', platform: 'powerstroke', slot_at: iso(dyno.getTime() + 1.5 * HOUR) },
    { event_id: event.id, full_name: 'Wyatt Carter', email: 'wyatt.c@example.com', phone: '(843) 555-0175', vehicle_label: '2020 L5P', platform: 'duramax', status: 'waitlist' },
  ]), 'registrations');
  await must(db.from('marketing_call_events').insert([
    { call_sid: 'CAdemo000000000000000000000000001', from_number: '+18435550175', to_number: '+18439959252', call_status: 'no-answer', texted_back_at: ago(1.9), created_at: ago(1.9) },
    { call_sid: 'CAdemo000000000000000000000000002', from_number: phoneE164(byName.Marcus.phone), to_number: '+18439959252', call_status: 'busy', customer_id: byName.Marcus.id, texted_back_at: ago(0.4), created_at: ago(0.4) },
  ]), 'calls');
  await sql`update customers c set lifecycle_stage = case when la.tier in ('stage_2','full_build') then 'vip'::mkt_lifecycle_stage when (select count(*) from invoices i where i.customer_id = c.id and i.status = 'paid') >= 2 then 'repeat'::mkt_lifecycle_stage else 'customer'::mkt_lifecycle_stage end from loyalty_accounts la where la.customer_id = c.id`;
  console.log(`  ${Object.keys(segments).length} segments, 5 campaigns, ${customers.length} contacts with touches`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const sql = postgres(process.env.POSTGRES_URL_NON_POOLING, { ssl: 'require', max: 1, onnotice: () => {} });
  seedMarketingCore({ db, sql })
    .catch((error) => { console.error('marketing core seed failed:', error.message); process.exitCode = 1; })
    .finally(() => sql.end());
}

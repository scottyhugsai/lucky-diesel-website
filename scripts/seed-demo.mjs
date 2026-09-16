#!/usr/bin/env node
/**
 * Resets and seeds realistic DEMO data. All people, phones (555-01xx) and
 * emails (@example.com / @luckydiesel.demo) are fictional. Dates are relative
 * to now so the demo always looks current.
 *
 * Usage: node --env-file=.env.local scripts/seed-demo.mjs
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { AUTOMATIONS } from '../lib/automations/catalog.ts';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const pgUrl = process.env.POSTGRES_URL_NON_POOLING;
if (!url || !serviceKey || !pgUrl) throw new Error('Supabase env vars missing — run with --env-file=.env.local');

export const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'DieselDemo2026!';
const db = createClient(url, serviceKey, { auth: { persistSession: false } });
const sql = postgres(pgUrl, { ssl: 'require', max: 1, onnotice: () => {} });

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const now = Date.now();
const iso = (ms) => new Date(ms).toISOString();
/** A weekday at a given shop hour (Eastern, UTC-4 in September), `days` from today. */
function shopTime(days, hour, minute = 0) {
  const d = new Date(now + days * DAY);
  d.setUTCHours(hour + 4, minute, 0, 0);
  const dow = d.getUTCDay();
  if (dow === 0) d.setUTCDate(d.getUTCDate() + (days >= 0 ? 1 : -2));
  if (dow === 6) d.setUTCDate(d.getUTCDate() + (days >= 0 ? 2 : -1));
  return d.getTime();
}

let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

async function must(promise, label) {
  const { data, error } = await promise;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

// ─── Reset ────────────────────────────────────────────────────────────────
async function reset() {
  await sql`truncate table audit_log, automation_runs, messages, payments, invoices, build_items, dyno_runs, tune_records,
    part_requests, work_order_notes, time_entries, acknowledgements, approvals, media, line_items, inspection_items,
    inspections, appointments, work_order_events, work_orders, leads, vehicles, customers, builds, automations, shop_settings
    restart identity cascade`;
  await sql`alter sequence work_order_number_seq restart with 1041`;
  await sql`alter sequence invoice_number_seq restart with 2201`;
  const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
  for (const user of list?.users ?? []) {
    if (user.email?.endsWith('@luckydiesel.demo') || user.email?.endsWith('@example.com')) {
      await db.auth.admin.deleteUser(user.id);
    }
  }
  const { data: objects } = await db.storage.from('media').list('demo', { limit: 1000 });
  if (objects?.length) await db.storage.from('media').remove(objects.map((o) => `demo/${o.name}`));
}

async function createUser({ email, fullName, role, phone, title, color }) {
  const data = await must(
    db.auth.admin.createUser({
      email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      app_metadata: { role },
      user_metadata: { full_name: fullName },
    }),
    `create user ${email}`,
  );
  await must(db.from('profiles').update({ phone, title, avatar_color: color ?? '#1fbf3f', full_name: fullName }).eq('id', data.user.id), 'profile');
  return data.user.id;
}

// ─── Catalog of jobs ──────────────────────────────────────────────────────
const LABOR = 16500;
const JOBS = {
  tune: { title: 'EZ-Lynk performance tune', lines: [['part', 'ASAP EZ-Lynk engine calibration', 1, 130000, 95000], ['labor', 'Tune install & datalog review', 1.5]] },
  turbo: { title: 'DDP Stage 2 turbo upgrade', lines: [['part', 'DDP 66mm Stage 2 turbocharger', 1, 289500, 231600], ['part', 'Turbo install gasket & oil line kit', 1, 18900, 11200], ['labor', 'Turbo R&R', 6]] },
  injectors: { title: 'Performance injector install', lines: [['part', 'DDP performance injector set (8)', 1, 369600, 295700], ['labor', 'Injector R&R and coding', 8]] },
  exhaust: { title: '5" stainless exhaust', lines: [['part', '5" stainless downpipe-back exhaust', 1, 70000, 48000], ['labor', 'Exhaust install', 2]] },
  maintenance: { title: 'Maintenance service', lines: [['part', 'Oil & filter service (10 qt 15W-40)', 1, 18500, 9800], ['part', 'Fuel filter set', 1, 12900, 7100], ['labor', 'Service labor', 1.5]] },
  diagnostics: { title: 'Diagnostics: low power / check engine', lines: [['labor', 'Diagnostic time & datalog analysis', 1.5]] },
  headstuds: { title: 'ARP head studs', lines: [['part', 'ARP head stud kit', 1, 64900, 47000], ['part', 'Head gaskets & coolant', 1, 38900, 26000], ['labor', 'Head stud install', 10]] },
  cp3: { title: 'CP3 pump replacement', lines: [['part', 'Reman CP3 injection pump', 1, 89995, 68000], ['labor', 'CP3 R&R and prime', 5]] },
  trans: { title: 'Transmission tuning', lines: [['part', 'EZ-Lynk transmission calibration', 1, 50000, 36000], ['labor', 'Trans tune & relearn', 1]] },
};

function lineRows(workOrderId, jobKey, approval = 'approved') {
  return JOBS[jobKey].lines.map(([kind, description, quantity, price, cost], sort) => ({
    work_order_id: workOrderId,
    kind,
    description,
    quantity,
    unit_price_cents: kind === 'labor' ? LABOR : price,
    unit_cost_cents: kind === 'labor' ? null : cost,
    taxable: kind !== 'labor',
    approval,
    sort,
  }));
}

function totals(lines, taxRate = 0.09) {
  const subtotal = lines.reduce((s, l) => s + Math.round(l.quantity * l.unit_price_cents), 0);
  const taxable = lines.filter((l) => l.taxable).reduce((s, l) => s + Math.round(l.quantity * l.unit_price_cents), 0);
  const tax = Math.round(taxable * taxRate);
  return { subtotal, tax, total: subtotal + tax };
}

async function upload(localPath, objectPath, contentType) {
  const body = await readFile(localPath);
  await must(db.storage.from('media').upload(objectPath, body, { contentType, upsert: true }), `upload ${objectPath}`);
  return objectPath;
}

// ─── Main ─────────────────────────────────────────────────────────────────
async function main() {
  console.log('resetting…');
  await reset();

  await must(db.from('automations').insert(AUTOMATIONS.map((a, sort) => ({
    key: a.key, name: a.name, description: a.description, trigger_event: a.triggerEvent, audience: a.audience,
    channels: a.channels, anchor: a.anchor, delay_minutes: a.delayMinutes, enabled: true, sort,
    sms_template: a.sms ?? null, email_subject_template: a.emailSubject ?? null, email_body_template: a.emailBody ?? null,
  }))), 'automations');

  await must(db.from('shop_settings').insert({
    id: 1, labor_rate_cents: LABOR, tax_rate: 0.09, parts_taxable: true, labor_taxable: false,
    owner_email: process.env.DEMO_EMAIL_TO || 'service@luckydiesel.com', owner_phone: '(843) 555-0100',
    google_review_url: null, bay_count: 3, open_hour: 8, close_hour: 17, open_days: [1, 2, 3, 4, 5], slot_minutes: 60,
  }), 'settings');

  console.log('users…');
  const ownerId = await createUser({ email: 'owner@luckydiesel.demo', fullName: 'Shop Owner', role: 'admin', phone: '(843) 555-0100', title: 'Owner', color: '#1fbf3f' });
  const jakeId = await createUser({ email: 'jake@luckydiesel.demo', fullName: 'Jake Morris', role: 'employee', phone: '(843) 555-0101', title: 'Lead Tech', color: '#6b2cf5' });
  const dreId = await createUser({ email: 'dre@luckydiesel.demo', fullName: 'Dre Williams', role: 'employee', phone: '(843) 555-0102', title: 'Diesel Tech', color: '#f59e0b' });
  const techs = [jakeId, dreId];
  const codyUserId = await createUser({ email: 'cody@luckydiesel.demo', fullName: 'Cody Brooks', role: 'client', phone: '(843) 555-0142', title: null });

  console.log('customers & trucks…');
  const PEOPLE = [
    ['Cody Brooks', '(843) 555-0142', 'cody@luckydiesel.demo', [[2021, 'GMC', 'Sierra 2500HD', 'duramax', '2017–Present L5P 6.6L', 'L5P', 'Allison 10L1000', 48210, 'Black Betty']]],
    ['Marcus Reed', '(843) 555-0117', 'marcus.reed@example.com', [[2019, 'Ram', '2500', 'cummins', '2019–Present 6.7L', '6.7 Cummins', '68RFE', 91300, null]]],
    ['Tanner Hughes', '(843) 555-0123', 'tanner.h@example.com', [[2016, 'Ford', 'F-250', 'powerstroke', '2011–2019 6.7L', '6.7 Powerstroke', '6R140', 132800, null]]],
    ['Brianna Cole', '(843) 555-0131', 'bcole@example.com', [[2006, 'Chevrolet', 'Silverado 2500HD', 'duramax', '2006–2007 LBZ 6.6L', 'LBZ', 'Allison 1000', 204500, 'The Grey Ghost']]],
    ['Luis Ortega', '(843) 555-0156', 'lortega@example.com', [[2022, 'Ford', 'F-350', 'powerstroke', '2020–2022 6.7L', '6.7 Powerstroke', '10R140', 38900, null]]],
    ['Hank Wallace', '(843) 555-0164', 'hank.w@example.com', [[2004, 'Dodge', 'Ram 2500', 'cummins', '2003–2007 5.9L Common Rail', '5.9 Cummins', '48RE', 238100, null], [2017, 'Chevrolet', 'Silverado 3500HD', 'duramax', '2011–2016 LML 6.6L', 'LML', 'Allison 1000', 156000, null]]],
    ['Savannah Price', '(843) 555-0172', 'savannah.p@example.com', [[2020, 'Ram', '3500', 'cummins', '2019–Present 6.7L', 'HO 6.7 Cummins', 'Aisin AS69RC', 61200, null]]],
    ['Derek Johnson', '(843) 555-0188', 'djohnson@example.com', [[2012, 'Ford', 'F-250', 'powerstroke', '2011–2019 6.7L', '6.7 Powerstroke', '6R140', 176400, null]]],
    ['Trey Simmons', '(843) 555-0193', 'trey.simmons@example.com', [[2008, 'Ford', 'F-350', 'powerstroke', '2008–2010 6.4L', '6.4 Powerstroke', '5R110', 188300, null]]],
    ['Kayla Bennett', '(843) 555-0105', 'kayla.b@example.com', [[2023, 'GMC', 'Sierra 3500HD', 'duramax', '2017–Present L5P 6.6L', 'L5P', 'Allison 10L1000', 22400, null]]],
    ['Ray Dawson', '(843) 555-0111', 'ray.dawson@example.com', [[2002, 'Ford', 'F-250', 'powerstroke', '1994.5–2003 7.3L', '7.3 Powerstroke', '4R100', 281000, 'Old Faithful']]],
    ['Chris Nolan', '(843) 555-0126', 'cnolan@example.com', [[2015, 'Ram', '2500', 'cummins', '2013–2018 6.7L', '6.7 Cummins', '68RFE', 144900, null]]],
    ['Austin Pierce', '(843) 555-0138', 'apierce@example.com', [[2018, 'Chevrolet', 'Silverado 2500HD', 'duramax', '2017–Present L5P 6.6L', 'L5P', 'Allison 1000', 87600, null]]],
    ['Jordan Mills', '(843) 555-0149', 'jmills@example.com', [[2011, 'Chevrolet', 'Silverado 2500HD', 'duramax', '2011–2016 LML 6.6L', 'LML', 'Allison 1000', 198700, null]]],
  ];

  const customers = [];
  for (const [index, [fullName, phone, email, trucks]] of PEOPLE.entries()) {
    const consent = index % 5 !== 3;
    const customer = await must(db.from('customers').insert({
      full_name: fullName, phone, email, profile_id: index === 0 ? codyUserId : null,
      sms_consent: consent, sms_consent_at: consent ? iso(now - (60 - index) * DAY) : null, sms_consent_version: consent ? '2026-09-16' : null,
      source: ['website', 'instagram', 'referral', 'tiktok', 'google'][index % 5], created_at: iso(now - (70 - index * 3) * DAY),
    }).select().single(), `customer ${fullName}`);
    const vehicles = [];
    for (const [year, make, model, platform, generation, engine, transmission, mileage, nickname] of trucks) {
      vehicles.push(await must(db.from('vehicles').insert({
        customer_id: customer.id, year, make, model, platform, generation, engine_code: engine, transmission, mileage, nickname,
        vin: `1GT${String(index).padStart(2, '0')}${year}DEMO${Math.floor(rand() * 90000 + 10000)}`.slice(0, 17),
      }).select().single(), 'vehicle'));
    }
    customers.push({ ...customer, vehicles });
  }
  const [cody] = customers;
  const codyTruck = cody.vehicles[0];

  console.log('history…');
  const PAID_JOBS = [
    [1, 'tune', -54], [2, 'maintenance', -51], [3, 'exhaust', -47], [4, 'cp3', -44], [5, 'headstuds', -40], [6, 'trans', -37],
    [7, 'diagnostics', -33], [8, 'turbo', -29], [9, 'tune', -26], [10, 'maintenance', -22], [11, 'injectors', -18],
    [12, 'exhaust', -15], [0, 'tune', -12], [2, 'diagnostics', -9], [5, 'maintenance', -6], [13, 'tune', -4],
  ];

  const invoicesForReview = [];
  for (const [i, [customerIndex, jobKey, daysAgo]] of PAID_JOBS.entries()) {
    const customer = customers[customerIndex];
    const vehicle = customer.vehicles[0];
    const tech = techs[i % 2];
    const openedAt = shopTime(daysAgo, 8, 30);
    const completedAt = openedAt + (JOBS[jobKey].lines.find((l) => l[0] === 'labor')[2] + 2) * HOUR;
    const wo = await must(db.from('work_orders').insert({
      customer_id: customer.id, vehicle_id: vehicle.id, status: 'paid', title: JOBS[jobKey].title, assigned_tech_id: tech,
      mileage_in: vehicle.mileage - Math.floor(rand() * 3000), started_at: iso(openedAt), completed_at: iso(completedAt),
      created_at: iso(openedAt - DAY), bay: `Bay ${(i % 3) + 1}`,
    }).select().single(), 'paid work order');
    const lines = lineRows(wo.id, jobKey);
    await must(db.from('line_items').insert(lines), 'lines');
    const laborHours = lines.filter((l) => l.kind === 'labor').reduce((s, l) => s + l.quantity, 0);
    const clocked = laborHours * (0.8 + rand() * 0.35);
    await must(db.from('time_entries').insert({ work_order_id: wo.id, tech_id: tech, started_at: iso(openedAt), ended_at: iso(openedAt + clocked * HOUR) }), 'time');
    const t = totals(lines);
    const invoice = await must(db.from('invoices').insert({
      work_order_id: wo.id, customer_id: customer.id, subtotal_cents: t.subtotal, tax_cents: t.tax, total_cents: t.total,
      status: 'paid', line_snapshot: lines, created_at: iso(completedAt), due_at: iso(completedAt + 7 * DAY), paid_at: iso(completedAt + 3 * HOUR),
    }).select().single(), 'invoice');
    await must(db.from('payments').insert({ invoice_id: invoice.id, amount_cents: t.total, method: i % 4 === 0 ? 'cash' : 'card', created_at: iso(completedAt + 3 * HOUR) }), 'payment');
    await sql`update work_order_events set created_at = ${iso(openedAt)} where work_order_id = ${wo.id}`;
    if (daysAgo > -8) invoicesForReview.push(invoice);

    if (jobKey === 'tune' || jobKey === 'trans') {
      const tune = await must(db.from('tune_records').insert({
        vehicle_id: vehicle.id, work_order_id: wo.id, tuner_platform: 'EZ-Lynk AutoAgent 3', device_serial: `EZL-${Math.floor(rand() * 900000 + 100000)}`,
        ecu: vehicle.platform === 'duramax' ? 'E41' : vehicle.platform === 'cummins' ? 'CM2350' : 'Bosch EDC17', calibrator: i % 2 ? 'AMDP' : 'ASAP Calibrations',
        file_name: `${vehicle.engine_code.replace(/\s/g, '_')}_${jobKey === 'trans' ? 'TCM' : 'ECM'}_v${1 + (i % 3)}.ezl`, revision: `v${1 + (i % 3)}.${i % 5}`,
        emissions_compliant: true, stock_file_backed_up: true, flashed_by: tech, flashed_at: iso(completedAt - HOUR),
        notes: 'Stock file saved to customer record. Datalog reviewed, no codes.',
      }).select().single(), 'tune');
      if (jobKey === 'tune') {
        const baseHp = vehicle.platform === 'duramax' ? 445 : vehicle.platform === 'cummins' ? 370 : 440;
        const baseTq = vehicle.platform === 'duramax' ? 910 : vehicle.platform === 'cummins' ? 850 : 900;
        await must(db.from('dyno_runs').insert([
          { vehicle_id: vehicle.id, work_order_id: wo.id, label: 'Baseline (stock)', is_baseline: true, horsepower: baseHp, torque: baseTq, boost_psi: 26, egt_f: 1180, run_at: iso(openedAt + HOUR) },
          { vehicle_id: vehicle.id, work_order_id: wo.id, tune_record_id: tune.id, label: `After tune ${tune.revision}`, is_baseline: false, horsepower: baseHp + 95 + Math.floor(rand() * 30), torque: baseTq + 180 + Math.floor(rand() * 40), boost_psi: 31.5, egt_f: 1240, run_at: iso(completedAt - 0.5 * HOUR) },
        ]), 'dyno');
      }
    }
    const buildCategory = { tune: 'Tuning', turbo: 'Turbo', injectors: 'Fuel', exhaust: 'Exhaust', cp3: 'Fuel', headstuds: 'Engine', trans: 'Transmission' }[jobKey];
    if (buildCategory) {
      const [, part] = JOBS[jobKey].lines[0];
      await must(db.from('build_items').insert({
        vehicle_id: vehicle.id, work_order_id: wo.id, category: buildCategory, part_name: part, brand: part.startsWith('DDP') ? 'Dan’s Diesel Performance' : part.includes('ARP') ? 'ARP' : part.includes('EZ-Lynk') ? 'EZ-Lynk' : null,
        installed_at: iso(completedAt).slice(0, 10), warranty_until: iso(completedAt + 365 * DAY).slice(0, 10),
      }), 'build item');
    }
  }

  // Cody's L5P gets extra history so the client portal shines.
  await must(db.from('build_items').insert([
    { vehicle_id: codyTruck.id, category: 'Intake', part_name: 'Cold air intake & coated charge pipes', brand: null, installed_at: iso(now - 90 * DAY).slice(0, 10), warranty_until: null },
  ]), 'cody build');

  console.log('active jobs…');
  const ACTIVE = [
    // [customerIndex, jobKey, status, techIndex|null, dayOffset]
    [0, 'turbo', 'awaiting_approval', 0, 0],
    [2, 'injectors', 'in_progress', 0, -1],
    [6, 'exhaust', 'in_progress', 1, 0],
    [3, 'headstuds', 'waiting_parts', 1, -3],
    [8, 'diagnostics', 'quality_check', 1, 0],
    [4, 'trans', 'ready', 0, -1],
    [11, 'maintenance', 'approved', null, 0],
    [12, 'tune', 'estimate', null, 0],
    [9, 'cp3', 'awaiting_approval', 1, -1],
  ];
  let codyJob = null;
  for (const [customerIndex, jobKey, status, techIndex, dayOffset] of ACTIVE) {
    const customer = customers[customerIndex];
    const vehicle = customer.vehicles[customer.vehicles.length - 1];
    const createdAt = shopTime(dayOffset, 8, 15);
    const wo = await must(db.from('work_orders').insert({
      customer_id: customer.id, vehicle_id: vehicle.id, status, title: JOBS[jobKey].title,
      complaint: jobKey === 'turbo' ? 'Wants more power for towing the camper. Some turbo whistle on decel.' : jobKey === 'diagnostics' ? 'Low power under load, intermittent P0299.' : null,
      assigned_tech_id: techIndex === null ? null : techs[techIndex], mileage_in: vehicle.mileage, bay: techIndex === null ? null : `Bay ${techIndex + 1}`,
      started_at: ['in_progress', 'waiting_parts', 'quality_check', 'ready'].includes(status) ? iso(createdAt + HOUR) : null,
      promised_at: iso(shopTime(dayOffset + 2, 16)), created_at: iso(createdAt),
    }).select().single(), 'active work order');
    const approval = ['awaiting_approval', 'estimate'].includes(status) ? 'pending' : 'approved';
    const lines = lineRows(wo.id, jobKey, approval).map((l) => ({ ...l, recommended: approval === 'pending' }));
    await must(db.from('line_items').insert(lines), 'active lines');
    if (status === 'in_progress') {
      await must(db.from('time_entries').insert({ work_order_id: wo.id, tech_id: techs[techIndex], started_at: iso(now - 1.5 * HOUR), ended_at: techIndex === 1 ? null : iso(now - 0.25 * HOUR) }), 'open time');
    }
    if (status === 'waiting_parts') {
      await must(db.from('part_requests').insert({ work_order_id: wo.id, requested_by: techs[techIndex], description: 'ARP head stud kit — backordered at supplier, ETA Thursday', status: 'ordered' }), 'part req');
    }
    if (status === 'ready') {
      const t = totals(lines);
      await must(db.from('invoices').insert({ work_order_id: wo.id, customer_id: customer.id, subtotal_cents: t.subtotal, tax_cents: t.tax, total_cents: t.total, status: 'open', line_snapshot: lines, due_at: iso(now + 7 * DAY) }), 'open invoice');
      await must(db.from('work_orders').update({ status: 'invoiced', completed_at: iso(now - 2 * HOUR) }).eq('id', wo.id), 'invoiced');
    }
    if (customerIndex === 0) codyJob = wo;
  }

  console.log('Cody’s inspection…');
  const inspection = await must(db.from('inspections').insert({
    work_order_id: codyJob.id, tech_id: jakeId, status: 'sent', sent_at: iso(now - 40 * 60_000),
    summary: 'Truck is in great shape overall. Stock turbo shows shaft play and oil seepage at the compressor outlet. With the tune already on, the DDP Stage 2 is the right move before you tow the camper.',
  }).select().single(), 'inspection');
  const INSPECTION_ITEMS = [
    ['Turbo & boost', 'Turbocharger shaft play', 'red', 'Noticeable radial play and oil film at the compressor outlet. Recommend replacement.'],
    ['Turbo & boost', 'Charge pipes & boots', 'green', 'Coated pipes and clamps tight, no leaks under boost test.'],
    ['Fuel system', 'Fuel filter condition', 'yellow', 'Due within 5,000 miles. Can be done with this visit.'],
    ['Engine', 'Oil leaks', 'green', 'Dry.'],
    ['Engine', 'Coolant level & condition', 'green', 'Full, tests good.'],
    ['Electrical', 'Batteries', 'green', 'Both 12.6V, passed load test.'],
    ['Tuning', 'Datalog: boost, EGT, rail pressure', 'green', 'All within target on current tune.'],
  ];
  const insertedItems = await must(db.from('inspection_items').insert(INSPECTION_ITEMS.map(([category, label, rating, notes], sort) => ({ inspection_id: inspection.id, category, label, rating, notes, sort }))).select(), 'inspection items');
  const turboItem = insertedItems.find((i) => i.label.startsWith('Turbocharger'));
  const pipeItem = insertedItems.find((i) => i.label.startsWith('Charge pipes'));
  await must(db.from('line_items').update({ inspection_item_id: turboItem.id }).eq('work_order_id', codyJob.id).eq('kind', 'part').ilike('description', '%turbocharger%'), 'link turbo');
  await must(db.from('line_items').insert({ work_order_id: codyJob.id, inspection_item_id: insertedItems[2].id, kind: 'part', description: 'Fuel filter set (while we’re in there)', quantity: 1, unit_price_cents: 12900, unit_cost_cents: 7100, taxable: true, approval: 'pending', recommended: true, sort: 9 }), 'filter line');

  const turboPhoto = await upload('public/images/part-turbo.png', `work-orders/${codyJob.id}/ddp-stage2-turbo.png`, 'image/png');
  const pipesPhoto = await upload('public/images/build-l5p-purple.jpg', `work-orders/${codyJob.id}/charge-pipes.jpg`, 'image/jpeg');
  await must(db.from('media').insert([
    { work_order_id: codyJob.id, inspection_item_id: turboItem.id, vehicle_id: codyTruck.id, path: turboPhoto, kind: 'photo', caption: 'Recommended replacement: DDP 66mm Stage 2', uploaded_by: jakeId },
    { work_order_id: codyJob.id, inspection_item_id: pipeItem.id, vehicle_id: codyTruck.id, path: pipesPhoto, kind: 'photo', caption: 'Charge pipes checked under boost, no leaks', uploaded_by: jakeId },
  ]), 'media');
  await must(db.from('work_order_notes').insert([
    { work_order_id: codyJob.id, author_id: jakeId, body: 'Customer tows a 32ft camper most weekends. Keep EGT targets conservative on the new turbo.', internal: true },
    { work_order_id: codyJob.id, author_id: jakeId, body: 'Inspection is up in your portal with photos. Call with any questions!', internal: false },
  ]), 'notes');

  console.log('appointments & leads…');
  const APPTS = [
    [1, 'Performance tuning', 0, 13], [7, 'Diagnostics', 1, 9], [10, 'Maintenance', 1, 13], [0, 'Turbocharger', 2, 8],
    [13, 'Exhaust system', 3, 10], [5, 'Fuel system', 4, 9], [2, 'Transmission', 6, 14],
  ];
  for (const [customerIndex, service, day, hour] of APPTS) {
    const customer = customers[customerIndex];
    const start = shopTime(day, hour);
    await must(db.from('appointments').insert({
      customer_id: customer.id, vehicle_id: customer.vehicles[0].id, service_label: service, starts_at: iso(start), ends_at: iso(start + 2 * HOUR),
      status: day === 0 ? 'confirmed' : 'scheduled', work_order_id: customerIndex === 0 ? codyJob.id : null,
    }), 'appointment');
  }

  const LEADS = [
    ['Wyatt Carter', '(843) 555-0175', 'wyatt.c@example.com', 'duramax', 'Duramax — 2017–Present L5P 6.6L', 'tuning', 'Performance tuning', 'Looking for a tune and 5" exhaust on my 2020 L5P. Mostly highway, some towing.', 'new', 2],
    ['Emily Grant', '(843) 555-0181', 'egrant@example.com', 'powerstroke', 'Powerstroke — 2020–2022 6.7L', 'transmission', 'Transmission', 'Harsh 2-3 shift on the 10R140 when cold.', 'new', 7],
    ['Ben Foster', '(843) 555-0194', 'bfoster@example.com', 'cummins', 'Cummins — 2007.5–2012 6.7L', 'diagnostics', 'Diagnostics', 'Smoke on startup and rough idle for a minute.', 'contacted', 30],
    ['Garrett Lane', '(843) 555-0107', 'glane@example.com', 'duramax', 'Duramax — 2006–2007 LBZ 6.6L', 'turbo', 'Turbocharger', 'Want a drop-in turbo upgrade for towing.', 'booked', 52],
    ['Nate Harper', '(843) 555-0119', 'nharper@example.com', 'powerstroke', 'Powerstroke — 2011–2019 6.7L', 'exhaust', 'Exhaust system', 'Stainless 5" system install.', 'won', 120],
  ];
  for (const [full_name, phone, email, platform, platform_label, service_id, service_label, details, status, hoursAgo] of LEADS) {
    await must(db.from('leads').insert({
      full_name, phone, email, platform, platform_label, service_id, service_label, details, status, sms_consent: true,
      mileage: `${Math.floor(rand() * 150 + 20)},000`, created_at: iso(now - hoursAgo * HOUR),
      contacted_at: status === 'new' ? null : iso(now - (hoursAgo - 1) * HOUR),
    }), 'lead');
  }

  console.log('message history & showcase…');
  const MSGS = [
    [0, 'sms', 'Your 2021 GMC Sierra 2500HD L5P is in the bay, Cody. Follow progress live: https://lucky-diesel.vercel.app/portal', 'job_checked_in', 3],
    [0, 'sms', 'Cody, your inspection for the 2021 GMC Sierra 2500HD L5P is ready: 3 items with photos. Review & approve in your portal.', 'inspection_ready', 0.7],
    [4, 'sms', 'Your 2022 Ford F-350 6.7 Powerstroke is ready, Luis! Pay online to skip the counter.', 'job_ready', 2],
    [13, 'sms', 'Thanks for trusting us with the 2011 Chevrolet Silverado 2500HD LML, Jordan. Mind sharing how it went?', 'review_request', 20],
  ];
  for (const [customerIndex, channel, body, automation_key, hoursAgo] of MSGS) {
    const customer = customers[customerIndex];
    await must(db.from('messages').insert({ customer_id: customer.id, channel, to_address: customer.phone, body, status: 'simulated', automation_key, created_at: iso(now - hoursAgo * HOUR) }), 'message');
  }

  await must(db.from('builds').insert([
    {
      slug: 'l5p-duramax-purple-intake', title: 'Purple-piped L5P', vehicle_label: 'GMC Sierra 2500HD · L5P Duramax', platform: 'duramax',
      summary: 'Coated intake and charge pipes, EZ-Lynk tune and a clean install that looks as good as it pulls.',
      story: 'The owner wanted a daily that could tow and still turn heads with the hood up. We matched coated intake and charge pipes to an EZ-Lynk calibration and verified everything on the datalog.',
      hero_image: '/images/build-l5p-purple.jpg', before_hp: 445, after_hp: 548, before_torque: 910, after_torque: 1105,
      parts: ['Coated intake & charge pipes', 'EZ-Lynk AutoAgent 3', 'ASAP engine calibration', 'Allison shift tuning'], published: true, is_sample: true,
    },
    {
      slug: 'cummins-cp3-fuel-upgrade', title: 'Cummins fuel system refresh', vehicle_label: 'Ram 2500 · 5.9 Common Rail', platform: 'cummins',
      summary: 'Reman CP3 and fresh fuel filtration brought a tired 5.9 back to full rail pressure.',
      story: 'Hard starts and low rail pressure on a high-mile 5.9. A reman CP3 and new filtration had it idling smooth and pulling hard again.',
      hero_image: '/images/part-cp3.png', before_hp: 305, after_hp: 362, before_torque: 610, after_torque: 690,
      parts: ['Reman CP3 injection pump', 'Fuel filter set', 'Rail pressure datalog'], published: true, is_sample: true,
    },
  ]), 'builds');

  await sql`insert into audit_log (actor_id, entity, action, data) values (${ownerId}, 'demo', 'seeded', ${sql.json({ at: iso(now) })})`;
  const hash = createHash('sha256').update(String(now)).digest('hex').slice(0, 8);
  console.log(`\ndemo seeded (${hash}).\n  owner  owner@luckydiesel.demo\n  tech   jake@luckydiesel.demo\n  client cody@luckydiesel.demo\n  password: ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error('seed failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => sql.end());

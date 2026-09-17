#!/usr/bin/env node
/**
 * Demo data for the marketing content engine (migration 009). Everything is
 * fictional and labelled: is_sample = true, reviews use source 'sample' (never
 * shown publicly), ad metrics are simulated. Called at the end of seed-demo.mjs,
 * or on its own: node --env-file=.env.local scripts/seed-marketing-content.mjs
 */
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';

const DAY = 86_400_000;
const TABLES = 'ad_metrics_daily, ad_publications, marketing_approvals, ad_creative_variants, ad_creatives, ad_campaigns, budget_guards, channel_connections, social_post_targets, social_posts, content_calendar_items, review_replies, reviews, nps_responses, seo_content, listings, landing_pages, lead_magnets, creative_assets, ai_generation_jobs, ai_prompt_templates, brand_voice';

// ── Same algorithms as lib/marketing/content (approvals.ts, demo-generator.ts, channels/demo.ts) ──
const stable = (v) => v === null || typeof v !== 'object' ? JSON.stringify(v) ?? 'null'
  : Array.isArray(v) ? `[${v.map(stable).join(',')}]`
  : `{${Object.entries(v).filter(([, x]) => x !== undefined).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, x]) => `${JSON.stringify(k)}:${stable(x)}`).join(',')}}`;
const hash = (payload) => createHash('sha256').update(stable(payload)).digest('hex');
const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; };
const mulberry = (seed) => { let t0 = seed >>> 0; return () => { t0 = (t0 + 0x6d2b79f5) >>> 0; let t = t0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
function simulate(key, date, budget) {
  const r = mulberry(fnv(`${key}|${date}`));
  const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
  const spend = Math.round(budget * (0.82 + r() * 0.18) * (dow === 0 || dow === 6 ? 0.8 : 1));
  const impressions = Math.round((spend / (900 + Math.round(r() * 900))) * 1000);
  const clicks = Math.round(impressions * (0.008 + r() * 0.017));
  const expected = spend / (1800 + Math.round(r() * 2700));
  const leads = Math.floor(expected) + (r() < expected % 1 ? 1 : 0);
  const conversions = leads > 0 && r() < 0.35 ? 1 : 0;
  return { date, impressions, clicks, spend_cents: spend, leads, conversions, conversion_value_cents: conversions * 85000 };
}

async function must(promise, label) {
  const { data, error } = await promise;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

async function approve(db, type, id, ownerId, at, decision = 'approved') {
  let payload;
  if (type === 'ad_creative') {
    const c = await must(db.from('ad_creatives').select('*, ad_creative_variants(*)').eq('id', id).single(), 'reload creative');
    const usable = [...c.ad_creative_variants].sort((a, b) => a.label.localeCompare(b.label)).filter((v) => v.compliance_status !== 'block');
    payload = { platform: c.platform, landing_url: c.landing_url, variants: usable.map((v) => ({ id: v.id, headline: v.headline, long_headline: v.long_headline, primary_text: v.primary_text, description: v.description, cta: v.cta, format: v.format, image_template: v.image_template, image_params: v.image_params })) };
  } else if (type === 'ad_campaign') {
    const c = await must(db.from('ad_campaigns').select('*').eq('id', id).single(), 'reload campaign');
    payload = { platform: c.platform, objective: c.objective, audience: c.audience, daily_budget_cents: c.daily_budget_cents, starts_on: c.starts_on, ends_on: c.ends_on, landing_page_id: c.landing_page_id };
  } else {
    const p = await must(db.from('social_posts').select('*, social_post_targets(platform, caption_override, platform_options)').eq('id', id).single(), 'reload post');
    payload = { caption: p.caption, hashtags: p.hashtags, link_url: p.link_url, asset_ids: p.asset_ids, image_template: p.image_template, image_params: p.image_params, scheduled_for: p.scheduled_for, targets: [...p.social_post_targets].sort((a, b) => a.platform.localeCompare(b.platform)) };
  }
  const pending = decision === 'pending';
  const row = await must(db.from('marketing_approvals').insert({
    subject_type: type, subject_id: id, payload_hash: hash(payload), decision, requested_by: ownerId, requested_at: new Date(at - DAY).toISOString(),
    decided_by: pending ? null : ownerId, decided_at: pending ? null : new Date(at).toISOString(), warnings_acknowledged: !pending, notes: pending ? null : 'Sample approval (demo data).',
  }).select('id').single(), 'approval');
  return row.id;
}

/** Multi-row inserts with differing keys: let omitted columns take their defaults instead of null. */
function withColumnDefaults(client) {
  return { storage: client.storage, from(table) { const query = client.from(table); const insert = query.insert.bind(query); query.insert = (rows, options) => insert(rows, { defaultToNull: false, ...options }); return query; } };
}

export async function seedMarketingContent({ db: client, sql, now = Date.now(), site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000' }) {
  const db = withColumnDefaults(client);
  const day = (offset) => new Date(now + offset * DAY).toISOString().slice(0, 10);
  const at = (offset, hourUtc) => { const d = new Date(now + offset * DAY); d.setUTCHours(hourUtc, 0, 0, 0); return d.toISOString(); };
  console.log('marketing content…');
  await sql.unsafe(`truncate table ${TABLES} restart identity cascade`);
  const owner = await must(db.from('profiles').select('id').eq('email', 'owner@luckydiesel.demo').maybeSingle(), 'owner');
  const ownerId = owner?.id ?? null;
  const builds = await must(db.from('builds').select('*').eq('published', true), 'builds');
  const l5p = builds.find((b) => b.slug === 'l5p-duramax-purple-intake');
  const cp3 = builds.find((b) => b.slug === 'cummins-cp3-fuel-upgrade');

  await must(db.from('brand_voice').insert({ id: 1, do_rules: ['Lead with the truck and the job.', 'Real numbers only.', 'Say results vary with power numbers.'], dont_rules: ['No emissions deletes or off-road-only parts.', 'No invented reviews.', 'No review incentives.'], banned_phrases: ['delete', 'straight pipe', 'off-road only'], approved_claims: ['Diesel-only shop', 'Parts supplied and installed'], hashtags: ['#LuckyDiesel', '#CharlestonSC', '#DieselTrucks'] }), 'brand voice');
  await must(db.from('ai_prompt_templates').insert([
    { key: 'ad_copy', kind: 'ad_copy', system_prompt: 'Write ad variants for Lucky Diesel using only supplied facts. Never mention emissions deletes.', user_template: 'Platform {{platform}}, goal {{goal}}, facts {{facts}}. JSON {"variants":[...]}' },
    { key: 'social_caption', kind: 'social_caption', system_prompt: 'Write a short, plain-spoken caption for a diesel shop post.', user_template: 'Post about {{subject}}. Facts {{facts}}.' },
    { key: 'review_reply', kind: 'review_reply', system_prompt: 'Reply to a review as the owner. Thank them, no job details, no incentives.', user_template: 'Rating {{rating}}: "{{text}}"' },
  ]), 'prompt templates');

  await must(db.from('channel_connections').insert(['meta_ads', 'google_ads', 'tiktok_ads', 'lsa', 'instagram', 'facebook', 'gbp', 'tiktok'].map((platform) => ({
    platform, status: platform === 'meta_ads' ? 'demo' : 'not_connected', account_name: platform === 'meta_ads' ? 'Demo ad account (simulated)' : null,
  }))), 'connections');
  await must(db.from('budget_guards').insert([
    { platform: 'all', max_daily_cents: 12000, max_monthly_cents: 250000, max_campaign_days: 45 },
    { platform: 'meta', max_daily_cents: 5000, max_monthly_cents: 120000, max_campaign_days: 30, auto_pause_cpl_cents: 4500 },
    { platform: 'google', max_daily_cents: 4000, max_monthly_cents: 100000, max_campaign_days: 30, auto_pause_cpl_cents: 5000 },
    { platform: 'tiktok', max_daily_cents: 2000, max_monthly_cents: 40000, max_campaign_days: 14, auto_pause_cpl_cents: 4000 },
  ]), 'budget guards');

  // ── Lead magnets + landing pages ──
  const magnets = await must(db.from('lead_magnets').insert([
    { slug: 'diesel-maintenance-checklist', title: 'Diesel maintenance checklist', description: 'The service intervals and quick checks that keep a working diesel working.', email_subject: 'Your diesel maintenance checklist', published: true, is_sample: true,
      sections: [{ heading: 'Every fill-up', items: ['Check for fuel or coolant leaks under the truck', 'Drain the water separator if your truck has a light for it', 'Watch for new warning lights'] }, { heading: 'Every oil change', items: ['Oil and filter with a diesel-rated oil', 'Fuel filters at the interval in your owner’s manual', 'Air filter restriction check', 'Scan for stored codes'] }, { heading: 'Every year', items: ['Coolant condition and concentration test', 'Batteries load-tested before winter', 'Transmission fluid condition'] }] },
    { slug: 'tow-ready-inspection', title: 'Tow-ready inspection checklist', description: 'What to check before a long pull with a camper, boat or gooseneck.', email_subject: 'Your tow-ready inspection checklist', published: true, is_sample: true,
      sections: [{ heading: 'Before you hook up', items: ['Tire pressure set for the load, including the trailer', 'Hitch, pins and safety chains inspected', 'Brake controller gain set with the trailer loaded'] }, { heading: 'Under the hood', items: ['Coolant level and hoses', 'Fresh fuel filters', 'Transmission fluid level and condition'] }, { heading: 'On the road', items: ['Watch coolant and transmission temps on long grades', 'Use exhaust brake or tow/haul mode on descents'] }] },
  ]).select('id, slug'), 'lead magnets');
  const magnetId = (slug) => magnets.find((m) => m.slug === slug).id;
  const tow = { code: 'TOWREADY', headline: 'Tow-ready inspection', valueLabel: '$89 flat', terms: 'Sample offer for the demo. One per truck; parts and repairs quoted separately.', endsAt: day(30) };
  const pages = await must(db.from('landing_pages').insert([
    { slug: 'tow-season-tune-special', title: 'Tow season special', template: 'offer', published: true, published_at: new Date(now - 14 * DAY).toISOString(), is_sample: true, offer: tow, lead_magnet_id: magnetId('tow-ready-inspection'),
      seo_description: 'Tow-ready inspection for Duramax, Powerstroke and Cummins trucks in Charleston.', utm_default: { utm_campaign: 'tow-season' },
      blocks: [
        { type: 'hero', kicker: 'Tow season', headline: 'Tow-ready before the trip', subhead: 'Cooling, brakes, fuel and transmission checked by diesel-only techs before you hook up.', image: '/images/build-l5p-purple.jpg', ctaLabel: 'Claim your spot' },
        { type: 'offer', ...tow },
        { type: 'bullets', heading: 'What we check', items: ['Cooling system and hoses', 'Fuel filters and water separator', 'Transmission fluid and temps', 'Brakes, tires and hitch'] },
        { type: 'proof', heading: 'Recent builds', source: 'builds', limit: 2 },
        { type: 'form', heading: 'Claim the tow-ready inspection', service: 'maintenance', offerTag: 'tow-season-tune', submitLabel: 'Claim it' },
        { type: 'faq', heading: 'Questions', items: [{ q: 'How long does it take?', a: 'Most inspections take about an hour. We’ll call before doing any extra work.' }, { q: 'Which trucks?', a: 'Duramax, Powerstroke and Cummins, all generations.' }] },
      ] },
    { slug: 'dyno-day', title: 'Dyno day', template: 'event', published: true, published_at: new Date(now - 3 * DAY).toISOString(), is_sample: true,
      offer: { code: null, headline: 'Dyno day sign-up', valueLabel: 'Free to watch', terms: 'Sample event for the demo. Pull slots are limited and confirmed by phone.', endsAt: day(24) },
      seo_description: 'Dyno day at Lucky Diesel in Charleston: see what your truck really makes.', utm_default: { utm_campaign: 'dyno-day' },
      blocks: [
        { type: 'hero', kicker: 'Dyno day', headline: 'See what your truck really makes', subhead: 'Strap it down, get a real dyno sheet and talk shop with other diesel owners.', image: '/images/shop-card.jpg', ctaLabel: 'Save a pull slot' },
        { type: 'offer', headline: 'Dyno day sign-up', valueLabel: 'Free to watch', terms: 'Pull slots are limited and confirmed by phone.', code: null, endsAt: day(24) },
        { type: 'proof', heading: 'Numbers from our dyno', source: 'builds', limit: 2 },
        { type: 'form', heading: 'Save a pull slot', service: 'tuning', offerTag: 'dyno-day', submitLabel: 'Save my slot' },
      ] },
  ]).select('id, slug'), 'landing pages');
  const pageId = (slug) => pages.find((p) => p.slug === slug).id;

  // ── Campaigns, creatives, approvals, simulated publications ──
  const campaigns = await must(db.from('ad_campaigns').insert([
    { name: 'Tow season special', platform: 'meta', objective: 'leads', daily_budget_cents: 2500, starts_on: day(-14), ends_on: day(16), status: 'live', landing_page_id: pageId('tow-season-tune-special'), utm_campaign: 'tow-season', audience: { radiusMiles: 30, interests: ['Towing', 'RVs', 'Boating'], ageMin: 25 }, is_sample: true, created_by: ownerId },
    { name: 'Diesel repair Charleston (PMax)', platform: 'google', objective: 'leads', daily_budget_cents: 2000, starts_on: day(-14), ends_on: day(14), status: 'live', utm_campaign: 'diesel-repair', audience: { radiusMiles: 35, signals: ['diesel repair', 'duramax', 'cummins'] }, is_sample: true, created_by: ownerId },
    { name: 'Hurricane prep (TikTok)', platform: 'tiktok', objective: 'traffic', daily_budget_cents: 1500, starts_on: day(2), ends_on: day(12), status: 'pending_approval', utm_campaign: 'hurricane-prep', audience: { radiusMiles: 40, ageMin: 21 }, is_sample: true, created_by: ownerId },
  ]).select('id, name, platform, daily_budget_cents'), 'campaigns');
  const [metaCampaign, googleCampaign, tiktokCampaign] = campaigns;

  const utm = (path, source, medium, campaign) => `${site}${path}?utm_source=${source}&utm_medium=${medium}&utm_campaign=${campaign}&utm_content=creative`;
  const V = (label, angle, headline, primary_text, description, cta, extra = {}) => ({ label, angle, hook: angle, headline, primary_text, description, cta, compliance_status: 'pass', compliance_issues: [], generator: 'demo', ...extra });
  const tuneWarn = { compliance_status: 'warn', compliance_issues: [{ term: 'tune', reason: 'Tuning claims need the owner to confirm the tune is emissions-compliant (CARB EO / EPA).', severity: 'warn' }] };
  const CREATIVES = [
    { status: 'live', campaign: metaCampaign, name: 'Tow season offer · Meta', platform: 'meta', goal: 'leads', subject_kind: 'offer', subject_ref: 'tow-season-tune-special', landing: utm('/l/tow-season-tune-special', 'facebook', 'paid_social', 'tow-season'), format: '4:5', template: 'offer',
      params: { offer: tow.headline, value: tow.valueLabel, code: tow.code, ends: null, terms: tow.terms, image: '/images/build-l5p-purple.jpg', imageSource: 'gallery', city: 'Charleston' },
      variants: [V('V1 · offer', 'offer', 'Tow-ready inspection', 'For a limited time. Tow-ready inspection: $89 flat. One per truck.', 'Limited bays', 'GET_QUOTE'), V('V2 · towing', 'towing', 'Tow heavy, stay cool', 'Pulling a camper or a gooseneck? Get cooling, fuel and transmission checked first.', 'Tow-ready checks', 'BOOK_NOW'), V('V3 · local', 'local', 'Charleston’s diesel-only shop', 'Duramax, Powerstroke and Cummins. Parts, installs and diagnostics under one roof in Charleston.', 'Serving the Lowcountry', 'LEARN_MORE')] },
    { status: 'live', campaign: googleCampaign, name: 'L5P dyno proof · PMax', platform: 'google_pmax', goal: 'leads', subject_kind: 'build', subject_ref: l5p?.id, landing: utm(`/builds/${l5p?.slug}`, 'google', 'cpc', 'diesel-repair'), format: '1.91:1', template: 'dyno',
      params: { truck: l5p?.vehicle_label, title: l5p?.title, buildId: l5p?.id, image: l5p?.hero_image, beforeHp: l5p?.before_hp, afterHp: l5p?.after_hp, beforeTq: l5p?.before_torque, afterTq: l5p?.after_torque, city: 'Charleston' },
      variants: [V('V1 · proof', 'proof', `${l5p?.after_hp} HP on our dyno`, 'Fresh off the dyno. This L5P made real numbers on our dyno sheet. Results vary.', 'Real dyno numbers', 'GET_QUOTE', { long_headline: `This ${l5p?.vehicle_label} made ${l5p?.after_hp} hp on our dyno` }), V('V2 · build', 'build', 'Built right in Charleston', 'Parts, install and a dyno check on this L5P. Want yours next?', 'Parts and install, one shop', 'BOOK_NOW', { long_headline: 'Purple-piped L5P: parts, install and dyno sheet from one shop' }), V('V3 · local', 'local', 'Local diesel techs', 'Duramax, Powerstroke and Cummins. Parts, installs and diagnostics in Charleston.', 'Duramax, Powerstroke, Cummins', 'LEARN_MORE', { long_headline: 'Duramax, Powerstroke and Cummins: parts, installs and diagnostics in Charleston' })] },
    { status: 'approved', campaign: null, name: 'DDP turbo spotlight · Meta', platform: 'meta', goal: 'sales', subject_kind: 'product', subject_ref: 'ddp-stage-2-turbo', landing: utm('/store/products?category=turbo', 'facebook', 'paid_social', 'turbo-spotlight'), format: '1:1', template: 'product',
      params: { product: 'Stage 2 turbocharger', vendor: 'Dan’s Diesel Performance', price: '$1,695', image: '/images/part-turbo.png', handle: null, city: 'Charleston' },
      variants: [V('V1 · product', 'product', 'Turbos from $1,695', 'Stage 2 turbos from Dan’s Diesel Performance. Buy the part, or let us install it so it’s done once.', 'From $1,695, parts only', 'SHOP_NOW'), V('V2 · reliability', 'reliability', 'Fixed once, fixed right', 'Turbo noise or low boost? Get a real diagnosis from techs who only work on diesels.', 'Diesel-only diagnostics', 'LEARN_MORE')] },
    { status: 'approved', campaign: tiktokCampaign, name: 'Hurricane prep · TikTok', platform: 'tiktok', goal: 'traffic', subject_kind: 'season', subject_ref: 'hurricane_prep', landing: utm('/book', 'tiktok', 'paid_social', 'hurricane-prep'), format: '9:16', template: 'seasonal',
      params: { season: 'hurricane_prep', title: 'Storm-season ready', service: 'storm-prep check', image: '/images/shop-card.jpg', imageSource: 'gallery', city: 'Charleston' },
      variants: [V('V1 · season', 'season', 'Storm-season ready', 'When the Lowcountry evacuates, your truck is the plan. Book a storm-prep check.', null, 'BOOK_NOW'), V('V2 · reliability', 'reliability', 'Cold starts, no drama', 'Batteries, fuel filters and cooling checked before the season peaks.', null, 'LEARN_MORE')] },
    { status: 'pending_approval', campaign: null, name: 'Cummins CP3 refresh · Meta', platform: 'meta', goal: 'leads', subject_kind: 'build', subject_ref: cp3?.id, landing: utm(`/builds/${cp3?.slug}`, 'facebook', 'paid_social', 'cp3-refresh'), format: '1:1', template: 'before_after',
      params: { truck: cp3?.vehicle_label, title: cp3?.title, buildId: cp3?.id, image: '/images/shop-card.jpg', beforeHp: cp3?.before_hp, afterHp: cp3?.after_hp, beforeTq: cp3?.before_torque, afterTq: cp3?.after_torque, needsPrivacyReview: true, city: 'Charleston' },
      variants: [V('V1 · build', 'build', 'Cummins fuel system refresh', 'Hard starts on a high-mile 5.9? A reman CP3 and fresh filters had this one pulling hard again.', 'See the full build', 'GET_QUOTE'), V('V2 · proof', 'proof', `${cp3?.after_hp} HP after the refresh`, 'Real numbers, not promises. Results vary by truck.', 'Results vary by truck', 'BOOK_NOW'),
        V('V3 · power', 'power', 'Off-road only power', 'Sample of a blocked variant: this wording is caught by the compliance check and can’t be approved.', 'Blocked example', 'LEARN_MORE', { compliance_status: 'block', compliance_issues: [{ term: 'off-road only', reason: 'Off-road-only products cannot be promoted for street trucks.', severity: 'block' }] })] },
    { status: 'pending_approval', campaign: null, name: 'Tuning consult · Google Search', platform: 'google_search', goal: 'leads', subject_kind: 'general', subject_ref: 'tuning', landing: utm('/l/dyno-day', 'google', 'cpc', 'dyno-day'), format: '1.91:1', template: 'photo',
      params: { truck: 'Dyno day', title: 'See what your truck really makes', image: '/images/shop-card.jpg', imageSource: 'gallery', city: 'Charleston' },
      variants: [V('V1 · dyno', 'proof', 'Dyno day in Charleston', 'Get a real dyno sheet for your truck and ask our techs about compliant tuning options.', 'Real dyno numbers', 'LEARN_MORE', tuneWarn), V('V2 · local', 'local', 'Diesel-only shop', 'Duramax, Powerstroke and Cummins. Parts, installs and diagnostics under one roof in Charleston.', 'Serving the Lowcountry', 'LEARN_MORE')] },
  ];

  for (const [i, c] of CREATIVES.entries()) {
    const creative = await must(db.from('ad_creatives').insert({ name: c.name, platform: c.platform, goal: c.goal, subject_kind: c.subject_kind, subject_ref: c.subject_ref ?? null, status: c.status, campaign_id: c.campaign?.id ?? null, landing_url: c.landing, generator: 'demo', is_sample: true, created_by: ownerId, created_at: new Date(now - (20 - i) * DAY).toISOString() }).select('id').single(), 'creative');
    const variants = await must(db.from('ad_creative_variants').insert(c.variants.map((v) => ({ ...v, creative_id: creative.id, format: c.format, image_template: c.template, image_params: { ...c.params, headline: v.headline } }))).select('id, compliance_status'), 'variants');
    const decidedAt = now - (16 - i) * DAY;
    await approve(db, 'ad_creative', creative.id, ownerId, decidedAt, c.status === 'pending_approval' ? 'pending' : 'approved');
    if (c.status !== 'live') continue;
    const approvalId = await approve(db, 'ad_campaign', c.campaign.id, ownerId, decidedAt);
    const usable = variants.filter((v) => v.compliance_status !== 'block');
    for (const v of usable) {
      const key = `${v.id}:${c.campaign.id}:seed`;
      const pub = await must(db.from('ad_publications').insert({ variant_id: v.id, campaign_id: c.campaign.id, approval_id: approvalId, platform: c.campaign.platform, mode: 'demo', simulated: true, status_on_platform: 'SIMULATED_ACTIVE', publish_attempt_key: key, external_ids: { campaign: `demo_${c.campaign.platform}_campaign_${c.campaign.id.slice(0, 8)}`, ad: `demo_${c.campaign.platform}_ad_${v.id.slice(0, 8)}` }, request_preview: { note: 'Demo mode: nothing was sent.' }, last_synced_at: new Date(now).toISOString() }).select('id, external_ids').single(), 'publication');
      const share = Math.round(c.campaign.daily_budget_cents / usable.length);
      await must(db.from('ad_metrics_daily').insert(Array.from({ length: 14 }, (_, d) => ({ publication_id: pub.id, simulated: true, ...simulate(pub.external_ids.ad, day(-14 + d), share) }))), 'metrics');
    }
  }
  await approve(db, 'ad_campaign', tiktokCampaign.id, ownerId, now, 'pending');

  // ── Social posts across the next two weeks ──
  const dynoCard = { truck: l5p?.vehicle_label, title: l5p?.title, beforeHp: l5p?.before_hp, afterHp: l5p?.after_hp, beforeTq: l5p?.before_torque, afterTq: l5p?.after_torque, image: l5p?.hero_image };
  const tags = ['#LuckyDiesel', '#CharlestonSC', '#DieselTrucks'];
  const POSTS = [
    ['Build of the month: purple-piped L5P', `${l5p?.after_hp} hp and ${l5p?.after_torque} lb-ft on our dyno. Coated intake and charge pipes with a clean install. Results vary by truck.`, 'dyno', dynoCard, 'build', l5p?.id, 'build_of_the_month', 'scheduled', 1, 16, ['instagram', 'facebook', 'gbp']],
    ['Tip Tuesday: drain your water separator', 'Water in diesel fuel kills injectors. If your truck has a water-in-fuel light, don’t ignore it. Drain the separator and change filters on schedule.', 'photo', { truck: 'Tip Tuesday', image: '/images/part-injectors.png' }, 'pillar', null, 'tip_tuesday', 'scheduled', 5, 16, ['instagram', 'facebook']],
    ['Product spotlight: Stage 2 turbo', 'Stage 2 turbos from Dan’s Diesel Performance, from $1,695 parts only. We supply and install.', 'product', { product: 'Stage 2 turbocharger', vendor: 'Dan’s Diesel Performance', price: '$1,695', image: '/images/part-turbo.png' }, 'product', 'ddp-stage-2-turbo', 'product_spotlight', 'approved', 7, 21, ['instagram', 'facebook']],
    ['Tow season special is live', 'Tow-ready inspection, $89 flat (sample offer). Cooling, fuel, transmission and brakes checked before you hook up.', 'offer', { offer: 'Tow-ready inspection', value: '$89 flat', code: 'TOWREADY', image: '/images/build-l5p-purple.jpg' }, 'manual', null, null, 'scheduled', 2, 14, ['facebook', 'gbp']],
    ['Cummins CP3 refresh', `High-mile 5.9 with hard starts. Reman CP3 and fresh filtration: ${cp3?.before_hp} → ${cp3?.after_hp} hp on the dyno. Results vary.`, 'before_after', { truck: cp3?.vehicle_label, title: cp3?.title, beforeHp: cp3?.before_hp, afterHp: cp3?.after_hp, beforeTq: cp3?.before_torque, afterTq: cp3?.after_torque, image: '/images/shop-card.jpg' }, 'build', cp3?.id, null, 'pending_approval', 3, 21, ['instagram', 'tiktok']],
    ['Dyno day is coming', 'Bring your truck, get a real dyno sheet. Pull slots are limited (sample event).', 'seasonal', { title: 'See what your truck really makes', service: 'dyno day', image: '/images/shop-card.jpg' }, 'manual', null, null, 'pending_approval', 6, 22, ['instagram', 'facebook', 'tiktok']],
    ['Tip Tuesday: tow/haul mode on grades', 'Heading to the mountains with a trailer? Use tow/haul mode and your exhaust brake on descents, and watch transmission temps.', 'photo', { truck: 'Tip Tuesday', image: '/images/build-l5p-purple.jpg' }, 'pillar', null, 'tip_tuesday', 'pending_approval', 12, 16, ['instagram', 'facebook']],
    ['Fresh dyno pull', 'Sample dyno result from a customer tune job. Confirm the tune’s compliance status before posting.', 'dyno', { truck: 'Customer L5P', title: 'After tune', beforeHp: 445, afterHp: 551, beforeTq: 910, afterTq: 1102 }, 'dyno_run', 'sample-dyno-1', null, 'pending_approval', 8, 21, ['instagram', 'tiktok'], { compliance_status: 'warn', compliance_issues: [{ term: 'tune', reason: 'Tuning claims need the owner to confirm the tune is emissions-compliant (CARB EO / EPA).', severity: 'warn' }] }],
    ['Product spotlight: CP3 pumps', 'Reman and upgraded CP3 pumps, installed with fresh filtration. Ask what fits your truck.', 'product', { product: 'CP3 pumps & kits', vendor: 'Dan’s Diesel Performance', image: '/images/part-cp3.png' }, 'pillar', null, 'product_spotlight', 'draft', 14, 21, ['instagram', 'facebook']],
    ['Shop photo: late night in the bay', 'Draft: owner photo from the bay. Check for plates and faces before posting.', 'photo', { truck: 'In the shop', image: '/images/shop-card.jpg' }, 'manual', null, null, 'draft', 10, 23, ['instagram'], { needs_privacy_review: true, privacy_note: 'Owner photo: blur plates, VINs and faces without a release.' }],
  ];
  for (const [title, caption, template, params, sourceType, sourceId, pillar, status, offset, hour, platforms, extra = {}] of POSTS) {
    const post = await must(db.from('social_posts').insert({ title, caption, hashtags: tags, link_url: `${site}/book`, image_template: template, image_params: params, pillar, source_type: sourceType, source_id: sourceId ? `${sourceId}` : null, status, scheduled_for: at(offset, hour), generator: 'demo', is_sample: true, created_by: ownerId, ...extra }).select('id').single(), 'social post');
    await must(db.from('social_post_targets').insert(platforms.map((platform) => ({ post_id: post.id, platform, status: platform === 'tiktok' ? 'pending' : status === 'scheduled' ? 'scheduled' : 'pending', platform_options: platform === 'tiktok' ? { mode: 'inbox_draft' } : {} }))), 'targets');
    if (status === 'scheduled' || status === 'approved') await approve(db, 'social_post', post.id, ownerId, now - DAY);
    if (status === 'pending_approval') await approve(db, 'social_post', post.id, ownerId, now, 'pending');
    await must(db.from('content_calendar_items').insert({ scheduled_for: at(offset, hour), kind: 'social_post', title, pillar, ref_type: 'social_post', ref_id: post.id, status: status === 'draft' ? 'drafted' : status === 'pending_approval' ? 'drafted' : 'approved', generator: 'demo', is_sample: true }), 'calendar');
  }
  await must(db.from('content_calendar_items').insert([
    { scheduled_for: at(-14, 12), kind: 'ad_campaign', title: 'Tow season special (Meta) live', ref_type: 'ad_campaign', ref_id: metaCampaign.id, status: 'done', is_sample: true },
    { scheduled_for: at(2, 12), kind: 'ad_campaign', title: 'Hurricane prep (TikTok) starts', ref_type: 'ad_campaign', ref_id: tiktokCampaign.id, status: 'planned', is_sample: true },
    { scheduled_for: at(24, 14), kind: 'event', title: 'Dyno day', ref_type: 'landing_page', ref_id: pageId('dyno-day'), status: 'planned', is_sample: true },
  ]), 'calendar extras');

  await seedReputationAndSeo(db, { now, ownerId, l5p });
  console.log('marketing content seeded (all sample data).');
}

async function seedReputationAndSeo(db, { now, ownerId, l5p }) {
  const ago = (days) => new Date(now - days * DAY).toISOString();
  const reviews = await must(db.from('reviews').insert([
    { source: 'sample', rating: 5, author_name: 'Sample — Travis M.', body: 'Sample review for the demo: found the real cause of my hard start and didn’t upsell me.', reviewed_at: ago(2) },
    { source: 'sample', rating: 5, author_name: 'Sample — Dana R.', body: 'Sample review for the demo: turbo install done on time and they showed me the old parts.', reviewed_at: ago(6), replied: true },
    { source: 'sample', rating: 4, author_name: 'Sample — Chris L.', body: 'Sample review for the demo: good work on my Cummins, took a day longer than planned.', reviewed_at: ago(11) },
    { source: 'sample', rating: 5, author_name: 'Sample — Marcus J.', body: 'Sample review for the demo: they explained the dyno sheet line by line.', reviewed_at: ago(15), replied: true },
    { source: 'sample', rating: 2, author_name: 'Sample — Kelly P.', body: 'Sample review for the demo: waited on parts for a week and had to call for updates.', reviewed_at: ago(1), owner_alerted_at: ago(1) },
    { source: 'internal', rating: 3, author_name: 'Sample — internal NPS note', body: 'Sample internal feedback: price was higher than expected.', reviewed_at: ago(4) },
  ]).select('id, rating'), 'reviews');
  const negative = reviews.find((r) => r.rating === 2);
  await must(db.from('review_replies').insert([
    { review_id: negative.id, draft_text: 'Kelly, thanks for telling us, and I’m sorry about the wait and the chasing. That’s on us to keep you updated. Please call me directly at (843) 995-9252 so I can make it right.', status: 'pending_approval', generator: 'demo' },
    { review_id: reviews[0].id, draft_text: 'Thanks, Travis. Finding the real fault first is how we like to work. See you next service.', status: 'pending_approval', generator: 'demo' },
  ]), 'review replies');
  await must(db.from('nps_responses').insert([
    { token_hash: createHash('sha256').update(`sample-nps-1-${now}`).digest('hex'), score: 9, comment: 'Sample: great communication.', channel: 'sms', requested_at: ago(5), responded_at: ago(4), is_sample: true },
    { token_hash: createHash('sha256').update(`sample-nps-2-${now}`).digest('hex'), score: 4, comment: 'Sample: took longer than quoted.', channel: 'email', requested_at: ago(3), responded_at: ago(2), owner_alerted_at: ago(2), is_sample: true },
  ]), 'nps');

  await must(db.from('seo_content').insert([
    { kind: 'build_page', title: `${l5p?.title}: ${l5p?.vehicle_label}`, slug: 'purple-piped-l5p-build', summary: 'Coated intake and charge pipes with a clean install, verified on our dyno.', meta_description: `Purple-piped L5P Duramax build in Charleston: ${l5p?.before_hp} → ${l5p?.after_hp} hp on our dyno. Results vary.`, source_type: 'build', source_id: l5p?.id, status: 'draft', is_sample: true,
      body: [{ heading: 'The goal', text: 'A daily driver that tows and looks as good with the hood up.' }, { heading: 'The work', text: (l5p?.parts ?? []).join(', ') }, { heading: 'The numbers', text: `${l5p?.before_hp} → ${l5p?.after_hp} hp and ${l5p?.before_torque} → ${l5p?.after_torque} lb-ft on our dyno. Results vary by truck, fuel and conditions.` }],
      faq: [{ q: 'Is this tune emissions-compliant?', a: 'Ask us which calibrations carry a CARB EO number or EPA-compliant status for your truck.' }], compliance_status: 'warn', compliance_issues: [{ term: 'tune', reason: 'Tuning claims need the owner to confirm the tune is emissions-compliant (CARB EO / EPA).', severity: 'warn' }] },
    { kind: 'blog_post', title: 'Tow-ready checklist for Lowcountry diesel owners', slug: 'tow-ready-checklist-charleston', summary: 'What to check before hauling a boat or camper out of Charleston.', meta_description: 'Tow-ready checklist for Duramax, Powerstroke and Cummins owners in Charleston, SC.', source_type: 'manual', status: 'pending_approval', is_sample: true,
      body: [{ heading: 'Tires and hitch', text: 'Set pressures for the load and inspect pins and chains.' }, { heading: 'Cooling and fuel', text: 'Fresh fuel filters and a coolant test before long summer pulls.' }], faq: [] },
    { kind: 'faq', title: 'Diesel service FAQ', slug: 'diesel-service-faq', summary: 'Straight answers to the questions we hear every week.', source_type: 'manual', status: 'draft', is_sample: true, body: [],
      faq: [{ q: 'Do you work on all diesel trucks?', a: 'We work on Duramax, Powerstroke and Cummins pickups.' }, { q: 'Can I bring my own parts?', a: 'Yes. We’ll install parts you bought; labor is quoted up front.' }, { q: 'Do you do emissions deletes?', a: 'No. We only do work that keeps your truck street-legal.' }] },
  ]), 'seo content');

  const nap = { name: 'Lucky Diesel', phone: '(843) 995-9252', website: 'https://luckydiesel.com', address: 'Pending from owner' };
  await must(db.from('listings').insert([
    ['Google Business Profile', 'core', 'https://business.google.com', 'not_started', 'Verify the profile first; unlocks reviews and local posts.'],
    ['Apple Business Connect', 'maps', 'https://businessconnect.apple.com', 'not_started', 'Apple Maps listing.'],
    ['Bing Places', 'maps', 'https://www.bingplaces.com', 'not_started', 'Can import from Google once verified.'],
    ['Facebook Page', 'social', 'https://www.facebook.com/people/Lucky-Diesel/61588373641534/', 'claimed', 'Add address and hours when available.'],
    ['Instagram', 'social', 'https://www.instagram.com/luckydieselllc/', 'claimed', 'Bio has phone; add website link.'],
    ['Yelp', 'directory', 'https://biz.yelp.com', 'not_started', 'Claim only. Yelp forbids asking for reviews.'],
    ['Nextdoor', 'directory', 'https://business.nextdoor.com', 'not_started', null],
    ['Better Business Bureau', 'directory', 'https://www.bbb.org', 'not_applicable', 'Optional.'],
    ['Data aggregators (Data Axle, Foursquare)', 'directory', null, 'not_started', 'Feeds many smaller directories.'],
    ['Diesel owner forums and brand dealer locators', 'diesel', null, 'not_started', 'Ask part brands you install (e.g. DDP, EZ-Lynk) about installer listings.'],
  ].map(([directory, category, url, status, notes], sort) => ({ directory, category, url, status, notes, sort, nap, nap_consistent: status === 'claimed' ? false : null }))), 'listings');
  await must(db.from('ai_generation_jobs').insert({ kind: 'plan', status: 'succeeded', generator: 'demo', model_id: 'demo/templates', input: { week: 'sample' }, output: { note: 'Sample weekly plan' }, requested_by: ownerId, finished_at: ago(1) }), 'ai job');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const sql = postgres(process.env.POSTGRES_URL_NON_POOLING, { ssl: 'require', max: 1, onnotice: () => {} });
  seedMarketingContent({ db, sql })
    .catch((error) => { console.error('marketing seed failed:', error.message); process.exitCode = 1; })
    .finally(() => sql.end());
}

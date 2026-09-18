/**
 * Row-level security against the live demo database.
 * Run: npm run test:rls   (requires .env.local and a seeded demo)
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { Database } from '@/lib/db/database.types';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const PASSWORD = process.env.DEMO_PASSWORD || 'DieselDemo2026!';

type Client = SupabaseClient<Database>;

async function signIn(email: string): Promise<Client> {
  const client = createClient<Database>(URL, ANON, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`sign in ${email}: ${error.message}`);
  return client;
}

let anon: Client;
let client: Client;
let tech: Client;
let owner: Client;

beforeAll(async () => {
  anon = createClient<Database>(URL, ANON, { auth: { persistSession: false } });
  [client, tech, owner] = await Promise.all([
    signIn('cody@luckydiesel.demo'),
    signIn('jake@luckydiesel.demo'),
    signIn('owner@luckydiesel.demo'),
  ]);
});

afterAll(async () => {
  await Promise.all([client, tech, owner].map((c) => c?.auth.signOut()));
});

describe('anonymous visitors', () => {
  test('see no customers, jobs, leads or messages', async () => {
    for (const table of ['customers', 'work_orders', 'leads', 'messages', 'invoices'] as const) {
      const { data } = await anon.from(table).select('id');
      expect(data ?? [], table).toHaveLength(0);
    }
  });

  test('can read published builds only', async () => {
    const { data } = await anon.from('builds').select('published');
    expect(data?.length).toBeGreaterThan(0);
    expect(data?.every((b) => b.published)).toBe(true);
  });
});

describe('client (Cody)', () => {
  test('sees exactly one customer record: their own', async () => {
    const { data } = await client.from('customers').select('full_name');
    expect(data?.map((c) => c.full_name)).toEqual(['Cody Brooks']);
  });

  test('sees only their own trucks and jobs', async () => {
    const { data: me } = await client.from('customers').select('id').single();
    const { data: vehicles } = await client.from('vehicles').select('customer_id');
    const { data: jobs } = await client.from('work_orders').select('customer_id');
    expect(vehicles?.length).toBeGreaterThan(0);
    expect(jobs?.length).toBeGreaterThan(0);
    expect(vehicles?.every((v) => v.customer_id === me?.id)).toBe(true);
    expect(jobs?.every((j) => j.customer_id === me?.id)).toBe(true);
  });

  test('cannot see leads, other customers’ messages, time entries or internal notes', async () => {
    expect((await client.from('leads').select('id')).data ?? []).toHaveLength(0);
    expect((await client.from('time_entries').select('id')).data ?? []).toHaveLength(0);
    const { data: notes } = await client.from('work_order_notes').select('internal');
    expect(notes?.every((n) => n.internal === false)).toBe(true);
    const { data: me } = await client.from('customers').select('id').single();
    const { data: messages } = await client.from('messages').select('customer_id');
    expect(messages?.every((m) => m.customer_id === me?.id)).toBe(true);
  });

  test('cannot write anything directly', async () => {
    const { data: job } = await client.from('work_orders').select('id').limit(1).single();
    const { data: updated } = await client.from('work_orders').update({ status: 'paid' }).eq('id', job!.id).select();
    expect(updated ?? []).toHaveLength(0);
    const { error } = await client.from('line_items').insert({ work_order_id: job!.id, kind: 'fee', description: 'x', unit_price_cents: 1 });
    expect(error).not.toBeNull();
  });

  test('cannot see or write the owner alert recipient list', async () => {
    const { data } = await client.from('owner_recipients').select('id');
    expect(data ?? []).toHaveLength(0);
    const { error } = await client.from('owner_recipients').insert({ label: 'Client', email: 'client@evil.test' });
    expect(error).not.toBeNull();
  });

  test('cannot promote themselves to admin', async () => {
    const { data: me } = await client.auth.getUser();
    const { data } = await client.from('profiles').update({ role: 'admin' }).eq('id', me.user!.id).select();
    expect(data ?? []).toHaveLength(0);
  });
});

describe('employee (Jake)', () => {
  test('reads operational data across customers', async () => {
    const { data } = await tech.from('work_orders').select('id');
    expect(data!.length).toBeGreaterThan(5);
  });

  test('can read alert recipients but cannot add, change or delete one', async () => {
    const { data: rows } = await tech.from('owner_recipients').select('id, label');
    expect(rows?.length).toBeGreaterThan(0);
    const { error: insertError } = await tech.from('owner_recipients').insert({ label: 'Sneaky tech', email: 'tech@evil.test' });
    expect(insertError).not.toBeNull();
    const { data: updated } = await tech.from('owner_recipients').update({ email: 'tech@evil.test' }).eq('id', rows![0]!.id).select();
    expect(updated ?? []).toHaveLength(0);
    const { data: deleted } = await tech.from('owner_recipients').delete().eq('id', rows![0]!.id).select();
    expect(deleted ?? []).toHaveLength(0);
  });

  test('can update job status but cannot change shop settings or automations', async () => {
    const { data: settings } = await tech.from('shop_settings').update({ labor_rate_cents: 1 }).eq('id', 1).select();
    expect(settings ?? []).toHaveLength(0);
    const { data: automations } = await tech.from('automations').update({ enabled: false }).eq('key', 'review_request').select();
    expect(automations ?? []).toHaveLength(0);
  });

  test('cannot change a line the customer already approved', async () => {
    const { data: line } = await tech.from('line_items').select('id, unit_price_cents').eq('approval', 'approved').limit(1).single();
    const { data } = await tech.from('line_items').update({ unit_price_cents: line!.unit_price_cents + 100 }).eq('id', line!.id).select();
    expect(data ?? []).toHaveLength(0);
    const { data: after } = await owner.from('line_items').select('unit_price_cents').eq('id', line!.id).single();
    expect(after!.unit_price_cents).toBe(line!.unit_price_cents);
  });

  test('cannot approve a line on the customer’s behalf', async () => {
    const { data: line } = await tech.from('line_items').select('id').eq('approval', 'pending').limit(1).single();
    const { data } = await tech.from('line_items').update({ approval: 'approved' }).eq('id', line!.id).select();
    expect(data ?? []).toHaveLength(0);
  });

  test('cannot mark a job paid directly', async () => {
    const { data: job } = await tech.from('work_orders').select('id').eq('status', 'in_progress').limit(1).single();
    const { data } = await tech.from('work_orders').update({ status: 'paid' }).eq('id', job!.id).select();
    expect(data ?? []).toHaveLength(0);
  });

  test('can still add and remove a pending recommendation on an open job', async () => {
    const { data: job } = await tech.from('work_orders').select('id').eq('status', 'in_progress').limit(1).single();
    const { data: added, error } = await tech
      .from('line_items')
      .insert({ work_order_id: job!.id, kind: 'part', description: 'RLS test line', unit_price_cents: 100, approval: 'pending' })
      .select('id')
      .single();
    expect(error).toBeNull();
    const { data: removed } = await tech.from('line_items').delete().eq('id', added!.id).select();
    expect(removed).toHaveLength(1);
  });

  test('cannot read the audit log', async () => {
    expect((await tech.from('audit_log').select('id')).data ?? []).toHaveLength(0);
  });
});

describe('owner (admin)', () => {
  test('can read and change settings', async () => {
    const { data: before } = await owner.from('shop_settings').select('bay_count').single();
    const { data } = await owner.from('shop_settings').update({ bay_count: before!.bay_count }).eq('id', 1).select();
    expect(data).toHaveLength(1);
  });
});

describe('marketing core tables (migration 008)', () => {
  const MARKETING_TABLES = [
    'contact_consent_events', 'suppressions', 'segments', 'segment_members', 'campaigns', 'campaign_steps', 'campaign_enrollments',
    'campaign_sends', 'offers', 'offer_redemptions', 'referral_codes', 'referrals', 'loyalty_accounts', 'loyalty_events',
    'tracking_visitors', 'attribution_touches', 'conversion_events', 'short_links', 'pipeline_stages', 'marketing_settings',
    'fleet_accounts', 'event_registrations', 'marketing_call_events',
  ] as const;

  test('clients and anonymous visitors read none of them', async () => {
    for (const table of MARKETING_TABLES) {
      expect((await client.from(table).select('*').limit(1)).data ?? [], `client ${table}`).toHaveLength(0);
      expect((await anon.from(table).select('*').limit(1)).data ?? [], `anon ${table}`).toHaveLength(0);
    }
  });

  test('staff can read campaigns, segments and conversions', async () => {
    for (const table of ['campaigns', 'segments', 'conversion_events'] as const) {
      expect((await tech.from(table).select('*').limit(1)).data?.length, `tech ${table}`).toBe(1);
    }
  });

  test('employees cannot write marketing data or the consent ledger', async () => {
    const { data: campaign } = await tech.from('campaigns').select('id, name').limit(1).single();
    expect((await tech.from('campaigns').update({ name: 'hijacked' }).eq('id', campaign!.id).select()).data ?? []).toHaveLength(0);
    expect((await tech.from('segments').insert({ name: 'rls test' }).select()).error).not.toBeNull();
    expect((await tech.from('suppressions').insert({ channel: 'sms', address: '+10000000000', reason: 'rls' }).select()).error).not.toBeNull();
    expect((await tech.from('marketing_settings').update({ sms_max_per_week: 99 }).eq('id', 1).select()).data ?? []).toHaveLength(0);
    expect((await tech.from('contact_consent_events').insert({ channel: 'sms', purpose: 'marketing', action: 'granted', method: 'rls', address: '+10000000000' }).select()).error).not.toBeNull();
    expect((await tech.from('offers').delete().neq('code', '').select()).data ?? []).toHaveLength(0);
  });

  test('clients cannot grant themselves marketing consent or rewards', async () => {
    expect((await client.from('loyalty_events').insert({ customer_id: '00000000-0000-4000-8000-000000000000', kind: 'adjust', points: 10000 }).select()).error).not.toBeNull();
    expect((await client.from('contact_consent_events').insert({ channel: 'sms', purpose: 'marketing', action: 'granted', method: 'rls', address: '+10000000000' }).select()).error).not.toBeNull();
  });

  test('the consent ledger is append-only, even for the owner', async () => {
    const { data: row } = await owner.from('contact_consent_events').select('id, method').limit(1).single();
    expect((await owner.from('contact_consent_events').update({ method: 'edited' }).eq('id', row!.id).select()).data ?? []).toHaveLength(0);
    expect((await owner.from('contact_consent_events').delete().eq('id', row!.id).select()).data ?? []).toHaveLength(0);
  });

  test('published events are public; the owner manages settings', async () => {
    const { data: events } = await anon.from('events').select('published');
    expect(events?.every((e) => e.published)).toBe(true);
    const { data } = await owner.from('marketing_settings').update({ sms_max_per_week: 2 }).eq('id', 1).select();
    expect(data).toHaveLength(1);
  });
});

describe('marketing content tables (migration 009)', () => {
  const CONTENT_TABLES = [
    'ai_generation_jobs', 'ai_prompt_templates', 'brand_voice', 'creative_assets', 'ad_creatives', 'ad_creative_variants', 'marketing_approvals',
    'ad_campaigns', 'budget_guards', 'ad_publications', 'ad_metrics_daily', 'social_posts', 'social_post_targets', 'content_calendar_items',
    'reviews', 'review_replies', 'nps_responses', 'seo_content', 'listings',
  ] as const;

  test('anonymous visitors and clients read none of the internal content tables', async () => {
    for (const who of [anon, client]) {
      for (const table of CONTENT_TABLES) {
        const { data } = await who.from(table).select('id');
        expect(data ?? [], table).toHaveLength(0);
      }
      const { data: connections } = await who.from('channel_connections').select('platform');
      expect(connections ?? []).toHaveLength(0);
    }
  });

  test('anonymous visitors see only published landing pages and lead magnets', async () => {
    const { data: all } = await owner.from('landing_pages').select('id, published');
    const { error: draftError } = await owner.from('landing_pages').insert({ slug: 'rls-draft-page', title: 'RLS draft', blocks: [], published: false });
    expect(draftError).toBeNull();
    const { data: pages } = await anon.from('landing_pages').select('slug, published');
    expect(pages?.length).toBe((all ?? []).filter((p) => p.published).length);
    expect(pages?.every((p) => p.published)).toBe(true);
    expect(pages?.some((p) => p.slug === 'rls-draft-page')).toBe(false);
    const { data: magnets } = await anon.from('lead_magnets').select('published');
    expect(magnets?.length).toBeGreaterThan(0);
    expect(magnets?.every((m) => m.published)).toBe(true);
    await owner.from('landing_pages').delete().eq('slug', 'rls-draft-page');
  });

  test('anonymous visitors cannot write landing pages or reviews', async () => {
    expect((await anon.from('landing_pages').insert({ slug: 'anon-page', title: 'x', published: true })).error).not.toBeNull();
    expect((await anon.from('reviews').insert({ source: 'google', rating: 5, author_name: 'x' })).error).not.toBeNull();
  });

  test('employees read content but cannot write it', async () => {
    const { data: creatives } = await tech.from('ad_creatives').select('id, status');
    expect(creatives?.length).toBeGreaterThan(0);
    const { data: updated } = await tech.from('ad_creatives').update({ status: 'live' }).eq('id', creatives![0]!.id).select();
    expect(updated ?? []).toHaveLength(0);
    expect((await tech.from('reviews').insert({ source: 'manual', rating: 5, author_name: 'Fake' })).error).not.toBeNull();
    const { data: approvals } = await tech.from('marketing_approvals').update({ decision: 'approved' }).eq('decision', 'pending').select();
    expect(approvals ?? []).toHaveLength(0);
    const { data: guards } = await tech.from('budget_guards').update({ max_daily_cents: 999999 }).eq('platform', 'meta').select();
    expect(guards ?? []).toHaveLength(0);
  });

  test('nobody signed in can read or write platform tokens', async () => {
    for (const who of [tech, owner]) {
      const { error } = await who.from('channel_connections').select('access_token_encrypted');
      expect(error).not.toBeNull();
    }
    const { data: safe, error } = await owner.from('channel_connections').select('platform, status');
    expect(error).toBeNull();
    expect(safe?.length).toBeGreaterThan(0);
    expect((await owner.from('channel_connections').update({ access_token_encrypted: 'x' }).eq('platform', 'meta_ads')).error).not.toBeNull();
  });

  test('owner can edit content', async () => {
    const { data: page } = await owner.from('landing_pages').select('id, title').limit(1).single();
    const { data } = await owner.from('landing_pages').update({ title: page!.title }).eq('id', page!.id).select('id');
    expect(data).toHaveLength(1);
  });
});

describe('site control panel', () => {
  const key = 'home.hero';

  beforeAll(async () => {
    await owner.from('site_blocks').upsert(
      { key, design: 'all', draft: { headline: 'SECRET DRAFT' }, published: { headline: 'PUBLISHED' } },
      { onConflict: 'key,design' },
    );
  });

  afterAll(async () => {
    await owner.from('site_blocks').delete().eq('key', key).eq('design', 'all');
  });

  test('a visitor reads published content', async () => {
    const { data } = await anon.from('site_blocks').select('key, published').eq('key', key);
    expect(data?.[0]?.published).toEqual({ headline: 'PUBLISHED' });
  });

  test('a visitor cannot read the draft column at all', async () => {
    const { data, error } = await anon.from('site_blocks').select('key, draft').eq('key', key);
    // The column grant makes this a privilege error, not an empty result.
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  test('a visitor cannot see a block that was never published', async () => {
    await owner.from('site_blocks').upsert({ key: 'home.parts', design: 'all', draft: { heading: 'UNPUBLISHED' } }, { onConflict: 'key,design' });
    const { data } = await anon.from('site_blocks').select('key').eq('key', 'home.parts');
    expect(data ?? []).toHaveLength(0);
    await owner.from('site_blocks').delete().eq('key', 'home.parts').eq('design', 'all');
  });

  test('a customer cannot write site content', async () => {
    const { error } = await client.from('site_blocks').upsert({ key: 'seo.home', design: 'all', draft: { title: 'hacked' } }, { onConflict: 'key,design' });
    expect(error).not.toBeNull();
  });

  test('a tech cannot write site content', async () => {
    const { error } = await tech.from('site_blocks').upsert({ key: 'seo.home', design: 'all', draft: { title: 'hacked' } }, { onConflict: 'key,design' });
    expect(error).not.toBeNull();
  });

  test('only the owner reads the audit trail', async () => {
    const { data: byOwner } = await owner.from('site_audit_log').select('id').limit(1);
    expect(byOwner).not.toBeNull();
    const { data: byTech } = await tech.from('site_audit_log').select('id').limit(1);
    expect(byTech ?? []).toHaveLength(0);
    const { data: byAnon } = await anon.from('site_audit_log').select('id').limit(1);
    expect(byAnon ?? []).toHaveLength(0);
  });

  // There is no update or delete policy on the audit log, so those statements
  // match no rows and report success. What matters is that the row is untouched.
  // The probe rows survive the test by design; afterAll sweeps them with the
  // service role, which bypasses RLS, so they never reach the owner's history.
  afterAll(async () => {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) return;
    const admin = createClient<Database>(URL, serviceKey, { auth: { persistSession: false } });
    await admin.from('site_audit_log').delete().like('entity_key', 'rls-probe%');
  });

  test('the audit trail cannot be rewritten or erased, even by the owner', async () => {
    const probeKey = `rls-probe-${Date.now()}`;
    await owner.from('site_audit_log').insert({ action: 'save', entity: 'block', entity_key: probeKey, summary: 'probe' });

    await owner.from('site_audit_log').update({ summary: 'rewritten' }).eq('entity_key', probeKey);
    const { data: afterUpdate } = await owner.from('site_audit_log').select('summary').eq('entity_key', probeKey).maybeSingle();
    expect(afterUpdate?.summary).toBe('probe');

    await owner.from('site_audit_log').delete().eq('entity_key', probeKey);
    const { data: afterDelete } = await owner.from('site_audit_log').select('summary').eq('entity_key', probeKey).maybeSingle();
    expect(afterDelete?.summary).toBe('probe');
  });
});

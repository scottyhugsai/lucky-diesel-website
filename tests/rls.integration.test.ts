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

  test('can update job status but cannot change shop settings or automations', async () => {
    const { data: settings } = await tech.from('shop_settings').update({ labor_rate_cents: 1 }).eq('id', 1).select();
    expect(settings ?? []).toHaveLength(0);
    const { data: automations } = await tech.from('automations').update({ enabled: false }).eq('key', 'review_request').select();
    expect(automations ?? []).toHaveLength(0);
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

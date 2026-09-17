'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';

export interface RegisterState {
  error?: string;
  status?: 'registered' | 'waitlist';
  name?: string;
}

const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 5;
const recent = new Map<string, number[]>();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PLATFORMS = ['duramax', 'powerstroke', 'cummins', 'other'] as const;

function field(form: FormData, key: string, max: number): string {
  const value = form.get(key);
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function throttled(ip: string): boolean {
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.set(ip, [...hits, now]);
  return hits.length >= MAX_PER_WINDOW;
}

/** Public dyno-day sign-up. Over capacity goes to the waitlist; never overbooks. */
export async function registerForEvent(_prev: RegisterState, form: FormData): Promise<RegisterState> {
  if (field(form, 'company', 100)) return { status: 'registered', name: 'there' };
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (throttled(ip)) return { error: 'Too many tries. Call us instead.' };

  const eventId = field(form, 'event_id', 36);
  const name = field(form, 'name', 80);
  const email = field(form, 'email', 200).toLowerCase();
  const digits = field(form, 'phone', 30).replace(/\D/g, '');
  const national = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  const platform = field(form, 'platform', 20);
  const vehicle = field(form, 'vehicle', 120);
  if (name.length < 2) return { error: 'Enter your name.' };
  if (national.length !== 10) return { error: 'Enter a 10-digit phone number.' };
  if (email && !EMAIL.test(email)) return { error: 'Enter a valid email.' };
  if (!(PLATFORMS as readonly string[]).includes(platform)) return { error: 'Pick your truck.' };

  const db = createAdminClient();
  const { data: event } = await db.from('events').select('id, slug, capacity, registration_open, published, ends_at').eq('id', eventId).maybeSingle();
  if (!event || !event.published) return { error: 'This event isn’t available.' };
  if (!event.registration_open || new Date(event.ends_at) < new Date()) return { error: 'Sign-ups are closed.' };

  const phone = `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`;
  const { data: existing } = await db.from('event_registrations').select('status').eq('event_id', event.id).eq('phone', phone).neq('status', 'cancelled').maybeSingle();
  if (existing) return { status: existing.status === 'waitlist' ? 'waitlist' : 'registered', name: name.split(' ')[0] };

  const { count } = await db.from('event_registrations').select('id', { count: 'exact', head: true }).eq('event_id', event.id).in('status', ['registered', 'checked_in']);
  const status = event.capacity && (count ?? 0) >= event.capacity ? 'waitlist' : 'registered';
  const { data: customer } = await db.from('customers').select('id').eq('phone', phone).limit(1).maybeSingle();
  const { error } = await db.from('event_registrations').insert({
    event_id: event.id, full_name: name, email: email || null, phone, platform, vehicle_label: vehicle || null, status,
    media_consent: form.get('media') === 'on', customer_id: customer?.id ?? null,
  });
  if (error) {
    console.error(`[events] registration failed for ${event.slug}: ${error.message}`);
    return { error: 'That didn’t save. Call us to sign up.' };
  }
  revalidatePath(`/events/${event.slug}`);
  return { status, name: name.split(' ')[0] };
}

'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { checkbox, guard, number, oneOf, requiredText, requiredUuid, shopDateTime, text, type ActionState } from '@/components/admin/core/parse';
import { requireRole } from '@/lib/auth';
import { createShortLink } from '@/lib/marketing/core/links';
import { createAdminClient } from '@/lib/supabase/admin';

const PATH = '/admin/marketing/growth';
const KINDS = ['dyno_day', 'open_house', 'tech_clinic', 'meet'] as const;
const REG_STATUSES = ['registered', 'waitlist', 'checked_in', 'cancelled', 'no_show'] as const;

function slugify(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'event';
  return base.length >= 3 ? base : `${base}-day`;
}

export async function createEvent(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const name = requiredText(form, 'name', 'Name', 120);
    const kind = oneOf(form, 'kind', KINDS, 'type');
    const startsAt = shopDateTime(form, 'starts_at', 'Start');
    if (!startsAt) return { error: 'Start is required.' };
    const hours = number(form, 'hours', { min: 1, max: 12, integer: true, label: 'Hours' }) ?? 4;
    const capacity = number(form, 'capacity', { min: 1, max: 1000, integer: true, label: 'Capacity' });
    const location = text(form, 'location', { max: 200, label: 'Location' });
    const description = text(form, 'description', { max: 1000, label: 'Details' });
    const endsAt = new Date(new Date(startsAt).getTime() + hours * 3_600_000).toISOString();
    const db = createAdminClient();
    let slug = slugify(name);
    const { data: taken } = await db.from('events').select('id').eq('slug', slug).maybeSingle();
    if (taken) slug = `${slug.slice(0, 70)}-${randomBytes(2).toString('hex')}`;
    const { error } = await db.from('events').insert({ name, kind, starts_at: startsAt, ends_at: endsAt, capacity, location, description, slug, published: checkbox(form, 'published') });
    if (error) return { error: 'Couldn’t save the event.' };
    revalidatePath(PATH);
    return { notice: `Created. Public page: /events/${slug}` };
  });
}

export async function setEventFlags(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const id = requiredUuid(form, 'event_id', 'Event');
    const field = oneOf(form, 'field', ['published', 'registration_open'] as const, 'setting');
    const value = checkbox(form, 'value');
    const { error } = await createAdminClient().from('events').update(field === 'published' ? { published: value } : { registration_open: value }).eq('id', id);
    if (error) return { error: 'Couldn’t update the event.' };
    revalidatePath(PATH, 'layout');
    return { notice: 'Saved.' };
  });
}

export async function setRegistrationStatus(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const id = requiredUuid(form, 'registration_id', 'Registration');
    const status = oneOf(form, 'status', REG_STATUSES, 'status');
    const db = createAdminClient();
    const { data, error } = await db.from('event_registrations').update({ status }).eq('id', id).select('event_id').single();
    if (error || !data) return { error: 'Couldn’t update.' };
    revalidatePath(`${PATH}/events/${data.event_id}`);
    return { notice: status === 'checked_in' ? 'Checked in.' : 'Updated.' };
  });
}

/** Makes a tracked short link and a draft SMS campaign aimed at a segment. Sending happens in Campaigns. */
export async function inviteSegment(_prev: ActionState, form: FormData): Promise<ActionState> {
  const viewer = await requireRole('admin');
  return guard(async () => {
    const eventId = requiredUuid(form, 'event_id', 'Event');
    const segmentId = requiredUuid(form, 'segment_id', 'Segment');
    const db = createAdminClient();
    const [{ data: event }, { data: segment }] = await Promise.all([
      db.from('events').select('id, slug, name, starts_at, published').eq('id', eventId).maybeSingle(),
      db.from('segments').select('id, name').eq('id', segmentId).maybeSingle(),
    ]);
    if (!event || !segment) return { error: 'Event or segment not found.' };
    if (!event.published) return { error: 'Publish the event first.' };

    const target = `/events/${event.slug}?utm_source=sms&utm_medium=sms&utm_campaign=${event.slug}`;
    const link = await createShortLink({ targetUrl: target, utmSource: 'sms', utmMedium: 'sms' });
    if (!link.ok) return { error: link.error };
    const day = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' }).format(new Date(event.starts_at));
    const { data: campaign, error } = await db.from('campaigns').insert({
      name: `Invite: ${event.name} → ${segment.name}`, kind: 'broadcast', channel: 'sms', status: 'draft', segment_id: segment.id, utm_campaign: event.slug, created_by: viewer.userId,
    }).select('id').single();
    if (error || !campaign) return { error: 'Couldn’t create the campaign.' };
    const body = `{{first_name}}, ${event.name} is ${day} at Lucky Diesel. Save your spot: ${link.url}`;
    const { error: stepError } = await db.from('campaign_steps').insert({ campaign_id: campaign.id, step_order: 1, body });
    if (stepError) return { error: 'Campaign made, but the message didn’t save.' };
    revalidatePath(PATH);
    return { notice: `Draft ready in Campaigns. Link: ${link.url}` };
  });
}

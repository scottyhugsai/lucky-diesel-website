'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { checkbox, dollarsToCents, guard, number, oneOf, requiredText, requiredUuid, shopDateTime, text, type ActionState } from '@/components/admin/core/parse';
import { requireRole } from '@/lib/auth';
import { buildContestRules, validateContest, type ContestParams } from '@/lib/marketing/community/contest-rules';
import { DEFAULT_WAIVER, eventPostDraft } from '@/lib/marketing/community/event-rules';
import { createShortLink } from '@/lib/marketing/core/links';
import { siteUrl } from '@/lib/site-url';
import { createAdminClient } from '@/lib/supabase/admin';

const PATH = '/admin/marketing/growth';
const KINDS = ['dyno_day', 'open_house', 'tech_clinic', 'meet'] as const;
const REG_STATUSES = ['registered', 'waitlist', 'checked_in', 'cancelled', 'no_show'] as const;
const SPONSOR_KINDS = ['sponsor', 'vendor', 'charity'] as const;
const SPONSOR_STATUSES = ['asked', 'confirmed', 'declined'] as const;
const SELECTIONS = ['vote', 'random', 'judged'] as const;

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
    const charity = text(form, 'charity', { max: 120, label: 'Charity' });
    // Dyno days book one truck per slot; other kinds just take sign-ups.
    const slotMinutes = kind === 'dyno_day' ? number(form, 'slot_minutes', { min: 5, max: 120, integer: true, label: 'Slot minutes' }) : null;
    const endsAt = new Date(new Date(startsAt).getTime() + hours * 3_600_000).toISOString();
    const db = createAdminClient();
    let slug = slugify(name);
    const { data: taken } = await db.from('events').select('id').eq('slug', slug).maybeSingle();
    if (taken) slug = `${slug.slice(0, 70)}-${randomBytes(2).toString('hex')}`;
    const { error } = await db.from('events').insert({
      name, kind, starts_at: startsAt, ends_at: endsAt, capacity, location, description, slug, charity,
      slot_minutes: slotMinutes, waiver_text: slotMinutes ? DEFAULT_WAIVER : null, published: checkbox(form, 'published'),
    });
    if (error) return { error: 'Couldn’t save the event.' };
    revalidatePath(PATH);
    return { notice: `Created. Public page: /events/${slug}` };
  });
}

export async function setEventFlags(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const id = requiredUuid(form, 'event_id', 'Event');
    const field = oneOf(form, 'field', ['published', 'registration_open', 'leaderboard_public'] as const, 'setting');
    const value = checkbox(form, 'value');
    const patch = field === 'published' ? { published: value } : field === 'registration_open' ? { registration_open: value } : { leaderboard_public: value };
    const { error } = await createAdminClient().from('events').update(patch).eq('id', id);
    if (error) return { error: 'Couldn’t update the event.' };
    revalidatePath(PATH, 'layout');
    return { notice: 'Saved.' };
  });
}

/**
 * Dyno numbers for one run. `result_verified` is the shop confirming the truck
 * was street-legal and the pull was clean — only verified runs reach the public
 * leaderboard.
 */
export async function setRegistrationResult(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const id = requiredUuid(form, 'registration_id', 'Registration');
    const horsepower = number(form, 'horsepower', { min: 0, max: 3000, integer: true, label: 'Horsepower' });
    const torque = number(form, 'torque', { min: 0, max: 4000, integer: true, label: 'Torque' });
    const db = createAdminClient();
    const { data, error } = await db
      .from('event_registrations')
      .update({ horsepower, torque, result_verified: checkbox(form, 'result_verified') })
      .eq('id', id)
      .select('event_id, events(slug)')
      .single();
    if (error || !data) return { error: 'Couldn’t save the run.' };
    revalidatePath(`${PATH}/events/${data.event_id}`);
    if (data.events?.slug) revalidatePath(`/events/${data.events.slug}/leaderboard`);
    return { notice: 'Run saved.' };
  });
}

export async function addSponsor(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const eventId = requiredUuid(form, 'event_id', 'Event');
    const { error } = await createAdminClient().from('event_sponsors').insert({
      event_id: eventId,
      name: requiredText(form, 'name', 'Name', 120),
      kind: oneOf(form, 'kind', SPONSOR_KINDS, 'type'),
      contact: text(form, 'contact', { max: 200, label: 'Contact' }),
      giveaway: text(form, 'giveaway', { max: 200, label: 'Giveaway' }),
      ask: text(form, 'ask', { max: 200, label: 'Ask' }),
    });
    if (error) return { error: 'Couldn’t add them.' };
    revalidatePath(`${PATH}/events/${eventId}`);
    return { notice: 'Added.' };
  });
}

export async function setSponsorStatus(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const id = requiredUuid(form, 'sponsor_id', 'Sponsor');
    const { data, error } = await createAdminClient().from('event_sponsors')
      .update({ status: oneOf(form, 'status', SPONSOR_STATUSES, 'status') }).eq('id', id).select('event_id').single();
    if (error || !data) return { error: 'Couldn’t update.' };
    revalidatePath(`${PATH}/events/${data.event_id}`);
    return { notice: 'Updated.' };
  });
}

/** Syndication: drafts a Facebook / Google Business Profile post. Publishing happens in Social. */
export async function draftEventPost(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const eventId = requiredUuid(form, 'event_id', 'Event');
    const db = createAdminClient();
    const { data: event } = await db.from('events').select('id, slug, name, starts_at, location, charity, kind, published').eq('id', eventId).maybeSingle();
    if (!event) return { error: 'Event not found.' };
    if (!event.published) return { error: 'Publish the event first.' };
    const url = `${siteUrl()}/events/${event.slug}`;
    const draft = eventPostDraft({ name: event.name, startsAt: event.starts_at, location: event.location, charity: event.charity, kind: event.kind }, url);
    const { error } = await db.from('social_posts').insert({
      title: draft.title, caption: draft.caption, hashtags: draft.hashtags, link_url: url,
      source_type: 'manual', source_id: event.id, status: 'draft', generator: 'demo', pillar: 'event',
    });
    if (error) return { error: 'Couldn’t save the draft.' };
    revalidatePath(`${PATH}/events/${eventId}`);
    return { notice: 'Draft ready in Social.' };
  });
}

/** Saves official rules for a giveaway or build of the month. Template only — have counsel review. */
export async function saveContestRules(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const key = (text(form, 'key', { max: 60, label: 'Key' }) ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (!/^[a-z0-9-]{3,60}$/.test(key)) return { error: 'Key needs 3–60 letters, numbers or dashes.' };
    const params: ContestParams = {
      title: requiredText(form, 'title', 'Name', 120),
      sponsor: requiredText(form, 'sponsor', 'Sponsor', 120),
      sponsorAddress: requiredText(form, 'sponsor_address', 'Address', 200),
      startDate: text(form, 'start_date', { max: 10, label: 'Start' }) ?? '',
      endDate: text(form, 'end_date', { max: 10, label: 'End' }) ?? '',
      eligibility: text(form, 'eligibility', { max: 200, label: 'Eligibility' }) ?? '',
      howToEnter: requiredText(form, 'how_to_enter', 'How to enter', 400),
      prize: requiredText(form, 'prize', 'Prize', 200),
      prizeValueCents: dollarsToCents(form, 'prize_value', { required: true, label: 'Prize value', max: 50_000 }) as number,
      winnerSelection: oneOf(form, 'winner_selection', SELECTIONS, 'selection'),
      winnerNotice: text(form, 'winner_notice', { max: 120, label: 'Notice' }) ?? '',
    };
    const issues = validateContest(params);
    if (issues.length) return { error: issues.join(' ') };
    const { error } = await createAdminClient().from('contest_rules')
      .upsert({ key, title: params.title, body: buildContestRules(params), params: { ...params }, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) return { error: 'Couldn’t save the rules.' };
    revalidatePath(PATH);
    revalidatePath('/events/build-of-the-month');
    return { notice: 'Rules saved.' };
  });
}

/** Approves, rejects or crowns a build-of-the-month nomination. */
export async function setNominationStatus(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const id = requiredUuid(form, 'nomination_id', 'Nomination');
    const status = oneOf(form, 'status', ['pending', 'approved', 'rejected', 'winner'] as const, 'status');
    const db = createAdminClient();
    const { data: nomination } = await db.from('botm_nominations').select('month').eq('id', id).maybeSingle();
    if (!nomination) return { error: 'Nomination not found.' };
    // One winner per month.
    if (status === 'winner') {
      await db.from('botm_nominations').update({ status: 'approved' }).eq('month', nomination.month).eq('status', 'winner');
    }
    const { error } = await db.from('botm_nominations').update({ status }).eq('id', id);
    if (error) return { error: 'Couldn’t update.' };
    revalidatePath(PATH);
    revalidatePath('/events/build-of-the-month');
    return { notice: status === 'winner' ? 'Winner set.' : 'Updated.' };
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

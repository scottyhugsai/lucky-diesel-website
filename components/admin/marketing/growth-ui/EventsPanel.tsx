import Link from 'next/link';
import { createEvent, inviteSegment, setEventFlags } from '@/app/admin/marketing/growth/event-actions';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import { Badge, Card, EmptyState, buttonClass, fieldClass } from '@/components/app/ui';
import { CopyButton } from './CopyButton';
import { SegmentSelect, ToggleButton } from './forms';
import { Field, areaClass, shortDate } from './kit';
import type { EventRow } from './offers-events-data';

const KIND_LABEL: Record<string, string> = { dyno_day: 'Dyno day', open_house: 'Open house', tech_clinic: 'Tech clinic', meet: 'Meet' };

function EventCard({ event, segments, baseUrl }: { event: EventRow; segments: { id: string; name: string; count: number }[]; baseUrl: string }) {
  const fill = event.capacity ? Math.min(100, Math.round((event.registered / event.capacity) * 100)) : null;
  const isPast = new Date(event.startsAt) < new Date();
  return (
    <li className="grid gap-4 rounded-md border border-line bg-carbon-2 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="kicker">{KIND_LABEL[event.kind] ?? event.kind} · {shortDate(event.startsAt, true)}</p>
          <h3 className="display mt-1 text-2xl not-italic">{event.name}</h3>
          {event.location && <p className="text-sm text-steel">{event.location}</p>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {isPast ? <Badge>Past</Badge> : event.published ? <Badge tone="good">Public</Badge> : <Badge tone="warn">Hidden</Badge>}
          {!event.registrationOpen && <Badge tone="bad">Sign-ups closed</Badge>}
        </div>
      </div>
      <div>
        <p className="flex justify-between text-sm"><span><b className="font-mono">{event.registered}</b>{event.capacity ? ` / ${event.capacity}` : ''} signed up</span><span className="text-steel">{event.waitlist} waitlist · {event.checkedIn} here</span></p>
        {fill !== null && <div className="mt-1.5 h-2 rounded-full bg-gunmetal"><div className={`h-full rounded-full ${fill >= 100 ? 'bg-amber-300' : 'bg-clover'}`} style={{ width: `${fill}%` }} /></div>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/admin/marketing/growth/events/${event.id}`} className={buttonClass('primary', 'sm')}>Check in</Link>
        <CopyButton value={`${baseUrl}/events/${event.slug}`} label="Copy page link" />
        <ToggleButton action={setEventFlags} name="value" hidden={{ event_id: event.id, field: 'published' }} next={!event.published} onLabel="Publish" offLabel="Hide" />
        <ToggleButton action={setEventFlags} name="value" hidden={{ event_id: event.id, field: 'registration_open' }} next={!event.registrationOpen} onLabel="Open sign-ups" offLabel="Close sign-ups" />
      </div>
      {!isPast && (
        <ActionForm action={inviteSegment} className="flex flex-wrap items-end gap-2 border-t border-line pt-4" aria-label={`Invite a segment to ${event.name}`}>
          <input type="hidden" name="event_id" value={event.id} />
          <Field label="Invite a segment" htmlFor={`inv-${event.id}`} className="min-w-0 flex-1 sm:max-w-xs">
            <SegmentSelect segments={segments} id={`inv-${event.id}`} required emptyLabel="Pick a segment" />
          </Field>
          <PendingButton size="md" variant="secondary">Make invite</PendingButton>
        </ActionForm>
      )}
    </li>
  );
}

export function EventsPanel({ events, segments, baseUrl }: { events: EventRow[]; segments: { id: string; name: string; count: number }[]; baseUrl: string }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section aria-label="Events" className="min-w-0">
        {events.length === 0 ? <EmptyState title="No events yet">Plan a dyno day on the right.</EmptyState> : (
          <ul className="grid gap-3">{events.map((e) => <EventCard key={e.id} event={e} segments={segments} baseUrl={baseUrl} />)}</ul>
        )}
      </section>
      <Card title="New event">
        <ActionForm action={createEvent} resetOnSuccess className="grid grid-cols-2 gap-3" aria-label="New event">
          <Field label="Name" htmlFor="ev-name" className="col-span-2">
            <input id="ev-name" name="name" required maxLength={120} placeholder="Winter Dyno Day" className={fieldClass} />
          </Field>
          <Field label="Type" htmlFor="ev-kind" className="col-span-2">
            <select id="ev-kind" name="kind" defaultValue="dyno_day" className={fieldClass}>
              {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Starts" htmlFor="ev-start" className="col-span-2">
            <input id="ev-start" name="starts_at" type="datetime-local" required className={fieldClass} />
          </Field>
          <Field label="Hours" htmlFor="ev-hours">
            <input id="ev-hours" name="hours" type="number" min={1} max={12} defaultValue={4} className={fieldClass} />
          </Field>
          <Field label="Spots" htmlFor="ev-cap">
            <input id="ev-cap" name="capacity" type="number" min={1} placeholder="30" className={fieldClass} />
          </Field>
          <Field label="Where" htmlFor="ev-loc" className="col-span-2">
            <input id="ev-loc" name="location" maxLength={200} placeholder="Lucky Diesel shop" className={fieldClass} />
          </Field>
          <Field label="Details" htmlFor="ev-desc" className="col-span-2">
            <textarea id="ev-desc" name="description" rows={3} maxLength={1000} className={areaClass} />
          </Field>
          <label className="col-span-2 flex items-center gap-2 text-sm text-chalk/75">
            <input type="checkbox" name="published" defaultChecked className="size-4 accent-clover" /> Show on the website
          </label>
          <div className="col-span-2"><PendingButton>Create event</PendingButton></div>
        </ActionForm>
      </Card>
    </div>
  );
}

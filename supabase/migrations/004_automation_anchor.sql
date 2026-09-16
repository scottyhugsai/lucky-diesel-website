-- Reminders are timed relative to the appointment, everything else relative to the event.
alter table automations
  add column anchor text not null default 'event' check (anchor in ('event', 'before_appointment'));

-- Lets the owner see which automations a message came from without a join.
alter table automation_runs add column audience text;

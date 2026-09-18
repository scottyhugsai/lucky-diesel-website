-- Events seeded for the demo were indistinguishable from real ones.
--
-- `events` had no is_sample column, unlike the twelve tables that do, and
-- seed-marketing-core.mjs inserts a "Fall Dyno Day" with a real date, a
-- capacity of 30 and published = true. /events selected published rows with no
-- filter, so the public page advertised a dyno day that does not exist, with a
-- working "Save a spot" button. The same fictional day is described as a sample
-- on /offers, so the site contradicted itself about whether it was real.
--
-- This is the third instance of one failure: an aggregate or a list derived
-- from seeded rows in a table that carries no sample flag.
alter table events add column if not exists is_sample boolean not null default false;

comment on column events.is_sample is
  'Seeded demo content. Public surfaces must either exclude these or mark them, never present them as scheduled.';

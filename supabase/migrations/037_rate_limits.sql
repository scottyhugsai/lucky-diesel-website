-- Rate limiting counted in one process's memory, which on serverless is no
-- limit at all.
--
-- `createThrottle` kept its counters in a module-level Map. Every cold instance
-- starts with an empty one and instances scale with load, so "5 lead
-- submissions per 10 minutes" was five *per instance* — an attacker spreading
-- requests got as many as they wanted, and the limit was weakest exactly when
-- traffic was highest. It guarded the lead form, the partial-save endpoint,
-- the waitlist, referrals, the report feed and the preference centre.
--
-- The counter has to live somewhere every instance shares. Postgres is already
-- here, so this needs no new service, no new key and no new bill.

create table if not exists rate_limits (
  -- Which limit: 'lead', 'lead-partial', 'waitlist'...
  bucket text not null,
  -- Who: an IP, or a session key where that is the better subject.
  subject text not null,
  window_started_at timestamptz not null default now(),
  count int not null default 0,
  primary key (bucket, subject)
);

comment on table rate_limits is
  'Shared request counters. Replaces per-instance in-memory throttles, which counted nothing on serverless.';

-- Only the service role touches this. No policy is granted, so with RLS on,
-- the anon and authenticated keys cannot read one visitor''s rate state from
-- another''s, nor clear their own counter.
alter table rate_limits enable row level security;

/**
 * Consumes one request against a limit and says whether it was allowed.
 *
 * Atomic on purpose: read-then-write from the application races itself under
 * exactly the burst a rate limiter exists to stop. The insert-on-conflict does
 * the compare and the increment in a single statement under a row lock.
 *
 * The window is fixed rather than sliding. A fixed window can admit up to 2x
 * the limit across a boundary, which is an acceptable trade for one statement
 * and no background sweep.
 */
create or replace function consume_rate_limit(
  p_bucket text,
  p_subject text,
  p_window_seconds int,
  p_max int
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  insert into rate_limits as r (bucket, subject, window_started_at, count)
  values (p_bucket, p_subject, now(), 1)
  on conflict (bucket, subject) do update
    set
      -- Expired window: start a new one at 1 rather than adding to a stale count.
      count = case
        when r.window_started_at < now() - make_interval(secs => p_window_seconds) then 1
        else r.count + 1
      end,
      window_started_at = case
        when r.window_started_at < now() - make_interval(secs => p_window_seconds) then now()
        else r.window_started_at
      end
  returning r.count into v_count;

  return v_count <= p_max;
end;
$$;

comment on function consume_rate_limit is
  'Counts one request against (bucket, subject) and returns true when it is within the limit.';

-- Rows for subjects that stopped calling are dead weight; nothing reads a
-- window older than the longest one in use (an hour).
create index if not exists rate_limits_window_idx on rate_limits (window_started_at);

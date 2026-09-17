-- Marketing analytics: monthly goals, channel budgets, weekly digests, anomaly
-- alerts, call tracking numbers and report feed tokens (Looker Studio CSV).
-- Additive only. Admin-only RLS; cron and feed routes use the service role.

create table marketing_goals (
  id uuid primary key default gen_random_uuid(),
  month date not null check (extract(day from month) = 1),
  metric text not null check (metric in ('leads', 'bookings', 'revenue', 'max_cpl')),
  target int not null check (target >= 0),
  updated_at timestamptz not null default now(),
  unique (month, metric)
);

create table marketing_budgets (
  id uuid primary key default gen_random_uuid(),
  month date not null check (extract(day from month) = 1),
  channel text not null check (channel in ('google', 'facebook', 'instagram', 'tiktok', 'bing', 'print', 'events', 'sponsorship', 'other')),
  budget_cents int not null default 0 check (budget_cents >= 0),
  -- Offline spend (print, events) the ad platforms can't report.
  manual_spend_cents int not null default 0 check (manual_spend_cents >= 0),
  updated_at timestamptz not null default now(),
  unique (month, channel)
);

create table marketing_digests (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique,
  summary jsonb not null default '{}',
  body text not null,
  sent_count int not null default 0,
  send_detail text,
  created_at timestamptz not null default now()
);

create table marketing_anomalies (
  id uuid primary key default gen_random_uuid(),
  metric text not null check (metric in ('leads', 'bookings', 'spend', 'cpl')),
  direction text not null check (direction in ('up', 'down')),
  current_value numeric(14, 2) not null,
  baseline_value numeric(14, 2) not null,
  change_ratio numeric(8, 3) not null,
  message text not null,
  dedupe_key text not null unique,
  alerted boolean not null default false,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);
create index marketing_anomalies_open_idx on marketing_anomalies (created_at desc) where acknowledged_at is null;

create table marketing_tracking_numbers (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique check (phone ~ '^\+1[0-9]{10}$'),
  source text not null check (source in ('google', 'facebook', 'instagram', 'tiktok', 'bing', 'youtube', 'referral', 'email', 'sms', 'direct', 'other')),
  label text not null default '',
  created_at timestamptz not null default now()
);

create table marketing_report_feeds (
  id uuid primary key default gen_random_uuid(),
  label text not null default 'Looker Studio',
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create trigger marketing_goals_touch before update on marketing_goals for each row execute function touch_updated_at();
create trigger marketing_budgets_touch before update on marketing_budgets for each row execute function touch_updated_at();

do $$
declare t text;
begin
  foreach t in array array[
    'marketing_goals', 'marketing_budgets', 'marketing_digests', 'marketing_anomalies', 'marketing_tracking_numbers', 'marketing_report_feeds'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy admin_all on %I for all to authenticated using (app.is_admin()) with check (app.is_admin())', t);
  end loop;
end $$;

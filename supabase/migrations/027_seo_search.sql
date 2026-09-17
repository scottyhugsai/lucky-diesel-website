-- Search performance (Search Console + Google Business Profile) and the
-- Business Profile record the owner keeps in the app (M13).
-- Additive only. Demo rows are flagged is_sample and never shown publicly.

-- ─── Daily search performance, one row per source/day/page ─────────────────
create table search_metrics_daily (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('gsc', 'gbp')),
  day date not null,
  -- Site path for Search Console; 'profile' for the Business Profile itself.
  page text not null check (char_length(page) between 1 and 300),
  clicks int not null default 0 check (clicks >= 0),
  impressions int not null default 0 check (impressions >= 0),
  position numeric(6,2) check (position is null or position > 0),
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  unique (source, day, page)
);
create index search_metrics_daily_day_idx on search_metrics_daily (source, day desc);

-- ─── Google Business Profile record (single row) ───────────────────────────
create table gbp_profile (
  id int primary key default 1 check (id = 1),
  description text check (description is null or char_length(description) <= 750),
  primary_category text check (primary_category is null or char_length(primary_category) <= 80),
  -- One service per line.
  services text check (services is null or char_length(services) <= 1000),
  hours_note text check (hours_note is null or char_length(hours_note) <= 200),
  last_push_at timestamptz,
  last_push_note text check (last_push_note is null or char_length(last_push_note) <= 300),
  updated_at timestamptz not null default now()
);
create trigger touch_gbp_profile before update on gbp_profile for each row execute function touch_updated_at();

insert into gbp_profile (id, primary_category, services) values (
  1,
  'Diesel engine repair service',
  E'Diesel diagnostics\nTurbo and injector work\nDPF and emissions service\nPerformance tuning\nSuspension and brakes\nFleet maintenance'
) on conflict (id) do nothing;

-- ─── RLS ───────────────────────────────────────────────────────────────────
alter table search_metrics_daily enable row level security;
create policy staff_read on search_metrics_daily for select to authenticated using (app.is_staff());
create policy admin_write on search_metrics_daily for all to authenticated using (app.is_admin()) with check (app.is_admin());

alter table gbp_profile enable row level security;
create policy staff_read on gbp_profile for select to authenticated using (app.is_staff());
create policy admin_write on gbp_profile for all to authenticated using (app.is_admin()) with check (app.is_admin());

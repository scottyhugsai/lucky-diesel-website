-- 014: lifecycle, seasonal and reputation gap-fill (B4).
-- Additive only: new tables and defaulted columns. RLS: staff read, admin write.

-- ─── Lifecycle ──────────────────────────────────────────────────────────────
-- Holdout control group per automation (0 = everyone gets it).
alter table automations add column if not exists holdout_percent int not null default 0 check (holdout_percent between 0 and 50);

-- When the mileage on a truck was last reported (portal odometer form, SMS reply).
alter table vehicles add column if not exists mileage_updated_at timestamptz;
alter table vehicles add column if not exists recalls_checked_at timestamptz;

-- Open NHTSA recalls matched by year/make/model (free API, no key).
create table vehicle_recalls (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles (id) on delete cascade,
  campaign_number text not null check (length(campaign_number) between 3 and 40),
  component text,
  summary text,
  remedy text,
  report_date date,
  found_at timestamptz not null default now(),
  unique (vehicle_id, campaign_number)
);
create index vehicle_recalls_vehicle_idx on vehicle_recalls (vehicle_id);

-- A calibrator's new tune revision; owners of older revisions get a note.
create table tune_revision_releases (
  id uuid primary key default gen_random_uuid(),
  calibrator text not null check (length(calibrator) between 1 and 80),
  revision text not null check (length(revision) between 1 and 40),
  notes text check (length(notes) <= 300),
  notified int not null default 0,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ─── Seasonal ───────────────────────────────────────────────────────────────
-- Outside Charleston events (boat show, truck meets) that get a draft campaign 14 days out.
create table local_events (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 120),
  starts_on date not null,
  pitch text check (length(pitch) <= 300),
  draft_campaign_id uuid references campaigns (id) on delete set null,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index local_events_date_idx on local_events (starts_on);

-- ─── Reputation ─────────────────────────────────────────────────────────────
alter table reviews add column if not exists themes text[] not null default '{}';
alter table reviews add column if not exists flag_reason text check (flag_reason in ('spam', 'off_topic', 'conflict', 'not_customer', 'offensive', 'other'));
alter table reviews add column if not exists flagged_at timestamptz;
alter table reviews add column if not exists social_post_id uuid references social_posts (id) on delete set null;
alter table nps_responses add column if not exists themes text[] not null default '{}';
alter table marketing_settings add column if not exists auto_post_positive_replies boolean not null default false;

-- Manual review asks, for the staff leaderboard.
create table review_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers (id) on delete set null,
  requested_by uuid references profiles (id) on delete set null,
  channel text not null check (channel in ('sms', 'email', 'both')),
  sent boolean not null default false,
  created_at timestamptz not null default now()
);
create index review_requests_created_idx on review_requests (created_at desc);

create table competitor_ratings (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 120),
  place_id text check (length(place_id) <= 200),
  rating numeric(2, 1) check (rating between 1 and 5),
  review_count int check (review_count >= 0),
  source text not null default 'manual' check (source in ('manual', 'places')),
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Tokenized video testimonial requests. Files live in the private `testimonials` bucket.
create table video_testimonials (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers (id) on delete set null,
  token_hash text not null unique,
  status text not null default 'requested' check (status in ('requested', 'uploaded', 'approved', 'rejected')),
  storage_path text,
  release_accepted_at timestamptz,
  release_text text,
  requested_by uuid references profiles (id) on delete set null,
  requested_at timestamptz not null default now(),
  uploaded_at timestamptz,
  expires_at timestamptz not null default (now() + interval '30 days')
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('testimonials', 'testimonials', false, 209715200, array['video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do nothing;

create policy testimonials_staff_read on storage.objects for select to authenticated
  using (bucket_id = 'testimonials' and app.is_staff());

do $$
declare t text;
begin
  foreach t in array array['vehicle_recalls', 'tune_revision_releases', 'local_events', 'review_requests', 'competitor_ratings', 'video_testimonials'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy staff_read on %I for select to authenticated using (app.is_staff())', t);
    execute format('create policy admin_write on %I for all to authenticated using (app.is_admin()) with check (app.is_admin())', t);
  end loop;
end $$;

-- Social, paid ads and creative gap-fill: media consent + release ledger,
-- customer photo submissions (moderated, never auto-public), community task
-- log, seasonal budget proposals, ad alerts and stock photo licenses.
-- Additive only.

-- ─── Media consent ─────────────────────────────────────────────────────────
alter table work_orders
  add column media_consent boolean not null default false,
  add column media_consent_at timestamptz;

-- One row per permission a person gave us to show their truck, plate, face,
-- name or words. Revoked rows stay for the record.
create table media_releases (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers (id) on delete set null,
  work_order_id uuid references work_orders (id) on delete set null,
  person_name text not null check (char_length(person_name) between 1 and 120),
  allow_truck boolean not null default true,
  allow_plate boolean not null default false,
  allow_face boolean not null default false,
  allow_name boolean not null default false,
  allow_testimonial boolean not null default false,
  -- They got something for it (discount, gift, free work): posts need a clear #ad disclosure.
  incentivized boolean not null default false,
  method text not null check (method in ('signed_form','web_form','email','text','verbal')),
  evidence text check (evidence is null or char_length(evidence) <= 500),
  source text not null default 'owner' check (source in ('owner','ugc')),
  signed_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index media_releases_customer_idx on media_releases (customer_id);
create index media_releases_work_order_idx on media_releases (work_order_id);

-- ─── Customer photo submissions ────────────────────────────────────────────
create table ugc_submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  email text not null check (char_length(email) <= 200),
  handle text check (handle is null or char_length(handle) <= 60),
  truck text check (truck is null or char_length(truck) <= 80),
  caption text check (caption is null or char_length(caption) <= 500),
  storage_path text not null,
  mime text not null check (mime in ('image/jpeg','image/png')),
  bytes int not null check (bytes > 0),
  credit_ok boolean not null default false,
  rights_confirmed boolean not null check (rights_confirmed),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  post_id uuid references social_posts (id) on delete set null,
  release_id uuid references media_releases (id) on delete set null,
  reviewed_by uuid references profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index ugc_submissions_status_idx on ugc_submissions (status, created_at desc);

-- Private bucket: submissions are only ever read by the owner (signed URLs).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ugc', 'ugc', false, 8388608, array['image/jpeg','image/png'])
on conflict (id) do nothing;
create policy ugc_admin_read on storage.objects for select to authenticated
  using (bucket_id = 'ugc' and app.is_admin());

-- ─── Community tasks / Nextdoor reminders ──────────────────────────────────
create table social_task_log (
  id uuid primary key default gen_random_uuid(),
  task_key text not null check (task_key ~ '^[a-z0-9_]{1,60}$'),
  period text not null check (period ~ '^\d{4}-(W\d{2}|\d{2})$'),
  done_by uuid references profiles (id) on delete set null,
  done_at timestamptz not null default now(),
  unique (task_key, period)
);

-- ─── Paid ads ──────────────────────────────────────────────────────────────
-- Month (1–12) → multiplier, e.g. {"4": 1.2, "12": 0.8}.
alter table budget_guards add column season_multipliers jsonb not null default '{}';

create table budget_change_proposals (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references ad_campaigns (id) on delete cascade,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  from_cents int not null check (from_cents >= 0),
  to_cents int not null check (to_cents > 0),
  multiplier numeric(4, 2) not null check (multiplier > 0),
  status text not null default 'pending' check (status in ('pending','approved','rejected','superseded')),
  error text,
  created_by uuid references profiles (id) on delete set null,
  decided_by uuid references profiles (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index budget_change_proposals_pending_idx on budget_change_proposals (campaign_id, month) where status = 'pending';

create table ad_alerts (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references ad_campaigns (id) on delete cascade,
  kind text not null check (kind in ('cpl_spike','zero_leads','fatigue','paused')),
  alert_date date not null,
  message text not null,
  simulated boolean not null default true,
  sent boolean not null default false,
  created_at timestamptz not null default now(),
  unique (campaign_id, kind, alert_date)
);
create index ad_alerts_recent_idx on ad_alerts (created_at desc);

-- ─── Stock photo licenses ──────────────────────────────────────────────────
alter table creative_assets
  add column title text check (title is null or char_length(title) <= 120),
  add column license_type text check (license_type is null or license_type in ('owned','royalty_free','rights_managed','editorial','creative_commons')),
  add column license_source text check (license_source is null or char_length(license_source) <= 120),
  add column license_url text check (license_url is null or char_length(license_url) <= 500),
  add column license_expires_at date,
  add column attribution text check (attribution is null or char_length(attribution) <= 200);

-- ─── RLS ───────────────────────────────────────────────────────────────────
-- Releases and submissions hold names and emails: owner only.
do $$
declare t text;
begin
  foreach t in array array['media_releases','ugc_submissions'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy admin_all on %I for all to authenticated using (app.is_admin()) with check (app.is_admin())', t);
  end loop;
  foreach t in array array['social_task_log','budget_change_proposals','ad_alerts'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy staff_read on %I for select to authenticated using (app.is_staff())', t);
    execute format('create policy admin_write on %I for all to authenticated using (app.is_admin()) with check (app.is_admin())', t);
  end loop;
end $$;

-- Lucky Diesel shop system — core schema.
-- Money is stored in integer cents. Every table has created_at.

create extension if not exists pgcrypto;

-- ─── Enums ──────────────────────────────────────────────────────────────────
create type app_role as enum ('admin', 'employee', 'client');
create type lead_status as enum ('new', 'contacted', 'booked', 'won', 'lost');
create type appointment_status as enum ('scheduled', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show');
create type work_order_status as enum (
  'estimate', 'awaiting_approval', 'approved', 'in_progress', 'waiting_parts',
  'quality_check', 'ready', 'invoiced', 'paid', 'cancelled'
);
create type line_item_kind as enum ('labor', 'part', 'fee');
create type approval_state as enum ('pending', 'approved', 'declined');
create type inspection_status as enum ('draft', 'sent');
create type inspection_rating as enum ('green', 'yellow', 'red', 'na');
create type media_kind as enum ('photo', 'video', 'document');
create type invoice_status as enum ('open', 'paid', 'void');
create type message_channel as enum ('sms', 'email');
create type message_direction as enum ('outbound', 'inbound');
create type message_status as enum ('queued', 'sent', 'simulated', 'failed', 'skipped');
create type automation_run_status as enum ('scheduled', 'sent', 'skipped', 'failed', 'cancelled');
create type part_request_status as enum ('requested', 'ordered', 'received');

-- ─── People ─────────────────────────────────────────────────────────────────
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role app_role not null default 'client',
  full_name text not null default '',
  email text,
  phone text,
  title text,
  avatar_color text not null default '#1fbf3f',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references profiles (id) on delete set null,
  full_name text not null,
  email text,
  phone text,
  sms_consent boolean not null default false,
  sms_consent_at timestamptz,
  sms_consent_version text,
  sms_opted_out_at timestamptz,
  source text not null default 'website',
  notes text,
  created_at timestamptz not null default now()
);
create index customers_email_idx on customers (lower(email));
create index customers_phone_idx on customers (phone);

create table vehicles (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers (id) on delete cascade,
  vin text,
  year int,
  make text,
  model text,
  platform text,            -- duramax | powerstroke | cummins | other
  generation text,          -- e.g. '2017–Present L5P 6.6L'
  engine_code text,         -- e.g. L5P
  transmission text,
  mileage int,
  nickname text,
  color text,
  photo_path text,
  created_at timestamptz not null default now()
);
create index vehicles_customer_idx on vehicles (customer_id);

-- ─── Pipeline ───────────────────────────────────────────────────────────────
create table leads (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers (id) on delete set null,
  full_name text not null,
  email text not null,
  phone text not null,
  platform text,
  platform_label text,
  mileage text,
  service_id text,
  service_label text,
  details text,
  sms_consent boolean not null default false,
  consent_ip text,
  status lead_status not null default 'new',
  source text not null default 'website',
  contacted_at timestamptz,
  converted_at timestamptz,
  created_at timestamptz not null default now()
);
create index leads_status_idx on leads (status, created_at desc);

create sequence work_order_number_seq start 1041;

create table work_orders (
  id uuid primary key default gen_random_uuid(),
  number int not null unique default nextval('work_order_number_seq'),
  customer_id uuid not null references customers (id) on delete restrict,
  vehicle_id uuid not null references vehicles (id) on delete restrict,
  lead_id uuid references leads (id) on delete set null,
  status work_order_status not null default 'estimate',
  title text not null,
  complaint text,
  assigned_tech_id uuid references profiles (id) on delete set null,
  bay text,
  mileage_in int,
  promised_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  review_requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index work_orders_status_idx on work_orders (status);
create index work_orders_customer_idx on work_orders (customer_id);
create index work_orders_tech_idx on work_orders (assigned_tech_id);

create table work_order_events (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references work_orders (id) on delete cascade,
  from_status work_order_status,
  to_status work_order_status not null,
  actor_id uuid references profiles (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
create index work_order_events_wo_idx on work_order_events (work_order_id, created_at);

create table appointments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers (id) on delete cascade,
  vehicle_id uuid references vehicles (id) on delete set null,
  work_order_id uuid references work_orders (id) on delete set null,
  service_id text,
  service_label text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status appointment_status not null default 'scheduled',
  notes text,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index appointments_starts_idx on appointments (starts_at);

-- ─── Work details ───────────────────────────────────────────────────────────
create table inspections (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null unique references work_orders (id) on delete cascade,
  tech_id uuid references profiles (id) on delete set null,
  status inspection_status not null default 'draft',
  summary text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table inspection_items (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references inspections (id) on delete cascade,
  category text not null,
  label text not null,
  rating inspection_rating not null default 'na',
  notes text,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index inspection_items_insp_idx on inspection_items (inspection_id, sort);

create table line_items (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references work_orders (id) on delete cascade,
  inspection_item_id uuid references inspection_items (id) on delete set null,
  kind line_item_kind not null,
  description text not null,
  quantity numeric(10, 2) not null default 1 check (quantity > 0),
  unit_price_cents int not null check (unit_price_cents >= 0),
  unit_cost_cents int check (unit_cost_cents >= 0),
  taxable boolean not null default true,
  approval approval_state not null default 'pending',
  recommended boolean not null default false,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index line_items_wo_idx on line_items (work_order_id, sort);

create table media (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid references work_orders (id) on delete cascade,
  inspection_item_id uuid references inspection_items (id) on delete set null,
  vehicle_id uuid references vehicles (id) on delete cascade,
  bucket text not null default 'media',
  path text not null,
  kind media_kind not null default 'photo',
  caption text,
  uploaded_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index media_wo_idx on media (work_order_id);

create table approvals (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references work_orders (id) on delete cascade,
  signer_name text not null,
  signed_by uuid references profiles (id) on delete set null,
  approved_item_ids uuid[] not null default '{}',
  declined_item_ids uuid[] not null default '{}',
  approved_total_cents int not null,
  snapshot jsonb not null,
  snapshot_sha256 text not null,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create table acknowledgements (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references work_orders (id) on delete cascade,
  vehicle_id uuid not null references vehicles (id) on delete cascade,
  template_version text not null,
  body text not null,
  signer_name text not null,
  signed_by uuid references profiles (id) on delete set null,
  ip text,
  created_at timestamptz not null default now()
);

create table time_entries (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references work_orders (id) on delete cascade,
  tech_id uuid not null references profiles (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  check (ended_at is null or ended_at > started_at)
);
create unique index time_entries_one_open_per_tech on time_entries (tech_id) where ended_at is null;

create table work_order_notes (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references work_orders (id) on delete cascade,
  author_id uuid references profiles (id) on delete set null,
  body text not null,
  internal boolean not null default true,
  created_at timestamptz not null default now()
);

create table part_requests (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references work_orders (id) on delete cascade,
  requested_by uuid references profiles (id) on delete set null,
  description text not null,
  status part_request_status not null default 'requested',
  created_at timestamptz not null default now()
);

-- ─── Diesel performance records ─────────────────────────────────────────────
create table tune_records (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles (id) on delete cascade,
  work_order_id uuid references work_orders (id) on delete set null,
  tuner_platform text not null,   -- EZ-Lynk, HP Tuners, EFILive
  device_serial text,
  ecu text,
  calibrator text,                -- ASAP Calibrations, AMDP
  file_name text,
  revision text,
  emissions_compliant boolean,
  stock_file_backed_up boolean not null default false,
  notes text,
  flashed_by uuid references profiles (id) on delete set null,
  flashed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index tune_records_vehicle_idx on tune_records (vehicle_id, flashed_at desc);

create table dyno_runs (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles (id) on delete cascade,
  tune_record_id uuid references tune_records (id) on delete set null,
  work_order_id uuid references work_orders (id) on delete set null,
  label text not null,
  is_baseline boolean not null default false,
  horsepower int check (horsepower > 0),
  torque int check (torque > 0),
  boost_psi numeric(5, 1),
  egt_f int,
  notes text,
  sheet_path text,
  run_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index dyno_runs_vehicle_idx on dyno_runs (vehicle_id, run_at);

create table build_items (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles (id) on delete cascade,
  work_order_id uuid references work_orders (id) on delete set null,
  category text not null,         -- Turbo, Fuel, Tuning, Exhaust, Transmission…
  part_name text not null,
  brand text,
  installed_at date,
  warranty_until date,
  created_at timestamptz not null default now()
);
create index build_items_vehicle_idx on build_items (vehicle_id);

-- ─── Money ──────────────────────────────────────────────────────────────────
create sequence invoice_number_seq start 2201;

create table invoices (
  id uuid primary key default gen_random_uuid(),
  number int not null unique default nextval('invoice_number_seq'),
  work_order_id uuid not null unique references work_orders (id) on delete restrict,
  customer_id uuid not null references customers (id) on delete restrict,
  subtotal_cents int not null,
  tax_cents int not null,
  total_cents int not null,
  status invoice_status not null default 'open',
  line_snapshot jsonb not null default '[]',
  stripe_checkout_session_id text,
  due_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices (id) on delete restrict,
  amount_cents int not null check (amount_cents > 0),
  method text not null,           -- card, cash, check, demo
  stripe_payment_intent_id text,
  created_at timestamptz not null default now()
);

-- ─── Communication & automation ─────────────────────────────────────────────
create table messages (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers (id) on delete set null,
  work_order_id uuid references work_orders (id) on delete set null,
  channel message_channel not null,
  direction message_direction not null default 'outbound',
  to_address text not null,
  subject text,
  body text not null,
  status message_status not null,
  provider_id text,
  error text,
  automation_key text,
  created_at timestamptz not null default now()
);
create index messages_created_idx on messages (created_at desc);
create index messages_customer_idx on messages (customer_id, created_at desc);

create table automations (
  key text primary key,
  name text not null,
  description text not null,
  trigger_event text not null,
  audience text not null,         -- customer | owner | tech
  channels message_channel[] not null,
  delay_minutes int not null default 0 check (delay_minutes >= 0),
  enabled boolean not null default true,
  sms_template text,
  email_subject_template text,
  email_body_template text,
  sort int not null default 0,
  updated_at timestamptz not null default now()
);

create table automation_runs (
  id uuid primary key default gen_random_uuid(),
  automation_key text not null references automations (key) on delete cascade,
  subject_type text not null,     -- lead | work_order | appointment | invoice | customer | shop
  subject_id uuid,
  dedupe_key text unique,
  context jsonb not null default '{}',
  status automation_run_status not null default 'scheduled',
  scheduled_for timestamptz not null default now(),
  executed_at timestamptz,
  detail text,
  created_at timestamptz not null default now()
);
create index automation_runs_due_idx on automation_runs (scheduled_for) where status = 'scheduled';

-- ─── Showcase & settings ────────────────────────────────────────────────────
create table builds (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  vehicle_label text not null,
  platform text not null,
  summary text not null,
  story text,
  hero_image text not null,
  before_hp int,
  after_hp int,
  before_torque int,
  after_torque int,
  parts text[] not null default '{}',
  published boolean not null default false,
  is_sample boolean not null default false,
  created_at timestamptz not null default now()
);

create table shop_settings (
  id int primary key default 1 check (id = 1),
  labor_rate_cents int not null default 16500,
  tax_rate numeric(5, 4) not null default 0.0900,
  parts_taxable boolean not null default true,
  labor_taxable boolean not null default false,
  owner_email text,
  owner_phone text,
  google_review_url text,
  bay_count int not null default 3,
  open_hour int not null default 8,
  close_hour int not null default 17,
  open_days int[] not null default '{1,2,3,4,5}',
  slot_minutes int not null default 60,
  updated_at timestamptz not null default now()
);

create table audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references profiles (id) on delete set null,
  entity text not null,
  entity_id uuid,
  action text not null,
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ─── Triggers ───────────────────────────────────────────────────────────────
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger work_orders_touch before update on work_orders
  for each row execute function touch_updated_at();

create or replace function log_work_order_status() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into work_order_events (work_order_id, from_status, to_status, actor_id)
    values (new.id, null, new.status, auth.uid());
  elsif new.status is distinct from old.status then
    insert into work_order_events (work_order_id, from_status, to_status, actor_id)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end $$;

create trigger work_orders_status_log after insert or update of status on work_orders
  for each row execute function log_work_order_status();

-- New auth users get a profile. Role is taken from app metadata set by the server, never user metadata.
create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, role, full_name, email, phone)
  values (
    new.id,
    coalesce((new.raw_app_meta_data ->> 'role')::app_role, 'client'),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    new.phone
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

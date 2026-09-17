-- Fleet & B2B, events & community, and the Shopify bridge.
-- Additive only. Public forms write through the service role after validation;
-- RLS below is staff read / admin write, like 008.

-- ─── Fleet ──────────────────────────────────────────────────────────────────
alter table fleet_accounts
  add column stage text not null default 'active' check (stage in ('prospect', 'active', 'lost')),
  add column source text,
  add column truck_count int check (truck_count is null or truck_count between 0 and 100000),
  add column city text,
  add column website text,
  add column priority boolean not null default false,
  add column sla_hours int not null default 48 check (sla_hours between 4 and 336),
  add column labor_discount_pct int not null default 0 check (labor_discount_pct between 0 and 50),
  add column last_report_sent_at timestamptz;
create index fleet_accounts_stage_idx on fleet_accounts (stage);

-- Bays held for priority fleet accounts until `fleet_release_hours` before the slot.
alter table shop_settings
  add column fleet_reserved_bays int not null default 0 check (fleet_reserved_bays >= 0),
  add column fleet_release_hours int not null default 24 check (fleet_release_hours between 0 and 336);

-- ─── Events ─────────────────────────────────────────────────────────────────
alter table events
  add column slot_minutes int check (slot_minutes is null or slot_minutes between 5 and 120),
  add column waiver_text text,
  add column charity text,
  add column leaderboard_public boolean not null default false;

alter table event_registrations
  add column waiver_name text,
  add column show_name boolean not null default false,
  add column result_verified boolean not null default false;
create unique index event_registrations_slot_idx on event_registrations (event_id, slot_at)
  where slot_at is not null and status in ('registered', 'checked_in');

create table event_sponsors (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  name text not null,
  kind text not null default 'sponsor' check (kind in ('sponsor', 'vendor', 'charity')),
  contact text,
  giveaway text,
  ask text,
  status text not null default 'asked' check (status in ('asked', 'confirmed', 'declined')),
  created_at timestamptz not null default now()
);
create index event_sponsors_event_idx on event_sponsors (event_id);

-- ─── Build of the month & contest rules ─────────────────────────────────────
create table contest_rules (
  key text primary key check (key ~ '^[a-z0-9-]{3,60}$'),
  title text not null,
  body text not null,
  params jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

create table botm_nominations (
  id uuid primary key default gen_random_uuid(),
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  build_id uuid references builds (id) on delete set null,
  truck text not null,
  owner_name text not null,
  why text,
  nominator_email text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'winner')),
  created_at timestamptz not null default now()
);
create index botm_nominations_month_idx on botm_nominations (month, status);

create table botm_votes (
  id uuid primary key default gen_random_uuid(),
  month text not null,
  nomination_id uuid not null references botm_nominations (id) on delete cascade,
  email_hash text not null,
  device_hash text not null,
  created_at timestamptz not null default now(),
  unique (month, email_hash),
  unique (month, device_hash)
);
create index botm_votes_nomination_idx on botm_votes (nomination_id);

-- ─── Shopify bridge ─────────────────────────────────────────────────────────
create table sku_compliance (
  handle text primary key check (handle ~ '^[a-z0-9][a-z0-9-]{0,254}$'),
  status text not null default 'unverified' check (status in ('carb_eo', 'sema_verified', 'unverified', 'not_applicable')),
  eo_number text,
  note text,
  updated_by uuid references profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table stock_alerts (
  id uuid primary key default gen_random_uuid(),
  handle text not null,
  product_title text not null,
  email text not null,
  customer_id uuid references customers (id) on delete set null,
  consent_text text not null,
  consent_ip text,
  status text not null default 'pending' check (status in ('pending', 'notified', 'cancelled')),
  notified_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index stock_alerts_pending_idx on stock_alerts (handle, email) where status = 'pending';

create table store_orders (
  id uuid primary key default gen_random_uuid(),
  shopify_order_id text not null unique,
  order_name text,
  customer_id uuid references customers (id) on delete set null,
  email text,
  total_cents int not null default 0 check (total_cents >= 0),
  currency text not null default 'USD',
  financial_status text,
  line_count int not null default 0,
  is_demo boolean not null default false,
  ordered_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index store_orders_ordered_idx on store_orders (ordered_at desc);
create index store_orders_customer_idx on store_orders (customer_id);

-- ─── RLS ────────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['event_sponsors','contest_rules','botm_nominations','botm_votes','sku_compliance','stock_alerts','store_orders'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy staff_read on %I for select to authenticated using (app.is_staff())', t);
    execute format('create policy admin_write on %I for all to authenticated using (app.is_admin()) with check (app.is_admin())', t);
  end loop;
end $$;

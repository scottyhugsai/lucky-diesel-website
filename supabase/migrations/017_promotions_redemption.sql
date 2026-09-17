-- Promotions & loyalty redemption (M14/M15): discounts on invoices, single-use
-- codes, bundles, gifts, creator codes, pricing programs (tier perks, fleet
-- volume, military/first responder), referral partners and a public, opt-in
-- referral leaderboard. Additive only. Money in integer cents.

-- ─── Offers ─────────────────────────────────────────────────────────────────
alter table offers
  add column single_use boolean not null default false,          -- only per-customer codes redeem
  add column public boolean not null default false,              -- listed on /offers
  add column bundle_items text[] not null default '{}',
  add column bundle_price_cents int check (bundle_price_cents >= 0),
  add column gift_item text,
  add column creator_name text,
  add column creator_commission_percent int not null default 0 check (creator_commission_percent between 0 and 50);

create table offer_codes (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references offers (id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z0-9-]{6,32}$'),
  customer_id uuid references customers (id) on delete set null,
  campaign_send_id uuid unique references campaign_sends (id) on delete set null,
  invoice_id uuid references invoices (id) on delete set null,
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);
create index offer_codes_offer_idx on offer_codes (offer_id, redeemed_at);
create index offer_codes_customer_idx on offer_codes (customer_id);

alter table offer_redemptions add column offer_code_id uuid references offer_codes (id) on delete set null;

-- ─── Invoice discounts ──────────────────────────────────────────────────────
alter table invoices
  add column discount_cents int not null default 0 check (discount_cents >= 0),
  add column pre_discount_tax_cents int check (pre_discount_tax_cents >= 0);

create table invoice_discounts (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices (id) on delete cascade,
  kind text not null check (kind in ('offer', 'points', 'referral', 'military', 'fleet', 'tier')),
  label text not null,
  amount_cents int not null default 0 check (amount_cents >= 0),
  offer_id uuid references offers (id) on delete set null,
  offer_code_id uuid references offer_codes (id) on delete set null,
  redemption_id uuid references offer_redemptions (id) on delete set null,
  points int not null default 0 check (points >= 0),
  note text,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (invoice_id, kind)
);

-- ─── Customers ──────────────────────────────────────────────────────────────
alter table customers
  add column referral_leaderboard_opt_in boolean not null default false,
  add column military_verified_at timestamptz,
  add column military_verified_note text;   -- what staff saw; never an ID image

-- ─── Program settings ───────────────────────────────────────────────────────
alter table marketing_settings
  add column point_value_cents int not null default 5 check (point_value_cents between 1 and 100),
  add column tier_perks jsonb not null default '{"stage_1":{"perk":"Priority booking","labor_percent":0},"stage_2":{"perk":"5% off labor","labor_percent":5},"full_build":{"perk":"10% off labor + dyno re-check","labor_percent":10}}',
  add column fleet_volume_tiers jsonb not null default '[{"min_trucks":3,"labor_percent":5},{"min_trucks":10,"labor_percent":10}]',
  add column military_labor_percent int not null default 10 check (military_labor_percent between 0 and 50);

-- ─── Referral partners (dealers) ────────────────────────────────────────────
create table referral_partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'other' check (kind in ('boat_dealer', 'rv_dealer', 'trailer_dealer', 'other')),
  contact_name text,
  email text,
  phone text,
  code text not null unique check (code ~ '^[A-Z0-9-]{4,32}$'),
  reward_cents int not null default 2500 check (reward_cents >= 0),
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

create table partner_referrals (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references referral_partners (id) on delete cascade,
  lead_id uuid references leads (id) on delete set null,
  customer_id uuid references customers (id) on delete set null,
  status mkt_referral_status not null default 'pending',
  invoice_id uuid references invoices (id) on delete set null,
  reward_cents int not null default 0,
  rewarded_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index partner_referrals_one_per_customer on partner_referrals (customer_id) where customer_id is not null;
create index partner_referrals_partner_idx on partner_referrals (partner_id, created_at desc);

-- ─── RLS ────────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['offer_codes', 'invoice_discounts', 'referral_partners', 'partner_referrals'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy staff_read on %I for select to authenticated using (app.is_staff())', t);
    execute format('create policy admin_write on %I for all to authenticated using (app.is_admin()) with check (app.is_admin())', t);
  end loop;
end $$;

-- Customers see the discount lines on their own invoices.
create policy client_invoice_discounts on invoice_discounts for select to authenticated
  using (exists (select 1 from invoices i where i.id = invoice_id and i.customer_id = app.my_customer_id()));

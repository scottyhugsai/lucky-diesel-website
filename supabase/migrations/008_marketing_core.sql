-- Marketing core: contacts, consent, suppressions, segments, campaigns, offers,
-- referrals, loyalty, attribution, short links, pipeline, settings, fleet, events.
-- Money in integer cents. Public endpoints write through the service role after
-- validating input; RLS here is for signed-in app users.

-- ─── Enums ──────────────────────────────────────────────────────────────────
create type mkt_consent_purpose as enum ('transactional', 'marketing');
create type mkt_consent_action as enum ('granted', 'revoked');
create type mkt_lifecycle_stage as enum ('subscriber', 'lead', 'customer', 'repeat', 'vip', 'lapsed', 'lost');
create type mkt_email_status as enum ('subscribed', 'unsubscribed', 'bounced', 'complained');
create type mkt_campaign_kind as enum ('broadcast', 'drip', 'lifecycle');
create type mkt_campaign_status as enum ('draft', 'scheduled', 'sending', 'sent', 'active', 'paused', 'archived');
create type mkt_enrollment_status as enum ('active', 'completed', 'exited');
create type mkt_send_status as enum ('scheduled', 'sent', 'simulated', 'skipped', 'failed', 'cancelled');
create type mkt_offer_kind as enum ('percent', 'amount', 'free_service');
create type mkt_referral_status as enum ('pending', 'qualified', 'rewarded', 'void');
create type mkt_conversion_kind as enum ('lead', 'booking', 'job_paid', 'store_checkout_click');
create type mkt_loyalty_tier as enum ('stock', 'stage_1', 'stage_2', 'full_build');

-- ─── Fleet (needed by customers) ────────────────────────────────────────────
create table fleet_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_customer_id uuid references customers (id) on delete set null,
  contact_name text,
  email text,
  phone text,
  billing_terms text not null default 'due_on_receipt',
  pm_interval_miles int not null default 10000 check (pm_interval_miles > 0),
  pm_interval_days int not null default 90 check (pm_interval_days > 0),
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ─── Pipeline ───────────────────────────────────────────────────────────────
create table pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  pipeline text not null default 'leads',
  key text not null,
  name text not null,
  sort int not null default 0,
  score_weight int not null default 0,
  is_won boolean not null default false,
  is_lost boolean not null default false,
  created_at timestamptz not null default now(),
  unique (pipeline, key)
);

-- ─── Attribution ────────────────────────────────────────────────────────────
create table tracking_visitors (
  anonymous_id text primary key check (anonymous_id ~ '^[A-Za-z0-9_-]{8,64}$'),
  customer_id uuid references customers (id) on delete set null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ga_client_id text,
  fbp text,
  fbc text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index tracking_visitors_customer_idx on tracking_visitors (customer_id);

create table attribution_touches (
  id uuid primary key default gen_random_uuid(),
  anonymous_id text,
  customer_id uuid references customers (id) on delete set null,
  lead_id uuid references leads (id) on delete set null,
  touch_type text not null default 'visit' check (touch_type in ('first', 'last', 'visit', 'click')),
  source text not null,            -- normalised channel: google | facebook | instagram | tiktok | referral | email | sms | direct | other
  medium text,
  campaign text,
  term text,
  content text,
  gclid text,
  gbraid text,
  wbraid text,
  fbclid text,
  ttclid text,
  msclkid text,
  referrer text,
  landing_path text,
  campaign_id uuid,                -- our campaigns.id when the click came from a campaign link
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index attribution_touches_customer_idx on attribution_touches (customer_id, occurred_at);
create index attribution_touches_lead_idx on attribution_touches (lead_id);
create index attribution_touches_anon_idx on attribution_touches (anonymous_id, occurred_at);

-- ─── Contacts: marketing fields on customers and leads ──────────────────────
alter table customers
  add column tags text[] not null default '{}',
  add column lifecycle_stage mkt_lifecycle_stage not null default 'customer',
  add column lead_score int not null default 0,
  add column birthday date,
  add column is_fleet boolean not null default false,
  add column fleet_account_id uuid references fleet_accounts (id) on delete set null,
  add column email_marketing_status mkt_email_status not null default 'subscribed',
  add column sms_marketing_consent_at timestamptz,
  add column sms_marketing_consent_version text,
  add column sms_marketing_opted_out_at timestamptz,
  add column consent_source_url text,
  add column first_touch_id uuid references attribution_touches (id) on delete set null,
  add column last_touch_id uuid references attribution_touches (id) on delete set null,
  add column first_touch_source text,
  add column last_touch_source text,
  add column last_marketing_sent_at timestamptz;
create index customers_tags_idx on customers using gin (tags);

alter table leads
  add column pipeline_stage_id uuid references pipeline_stages (id) on delete set null,
  add column lead_score int not null default 0,
  add column lost_reason text,
  add column first_touch_id uuid references attribution_touches (id) on delete set null,
  add column last_touch_id uuid references attribution_touches (id) on delete set null;

-- ─── Consent & suppression ──────────────────────────────────────────────────
create table contact_consent_events (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers (id) on delete set null,
  channel message_channel not null,
  purpose mkt_consent_purpose not null,
  action mkt_consent_action not null,
  method text not null,            -- form | keyword_stop | keyword_start | natural_language | unsubscribe_link | owner | import | bounce | complaint
  address text not null,           -- E.164 phone or lower-case email
  consent_text_version text,
  evidence jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index contact_consent_events_customer_idx on contact_consent_events (customer_id, created_at desc);
create index contact_consent_events_address_idx on contact_consent_events (address, created_at desc);

create table suppressions (
  id uuid primary key default gen_random_uuid(),
  channel message_channel not null,
  address text not null,
  scope text not null default 'marketing' check (scope in ('all', 'marketing')),
  reason text not null,            -- stop | unsubscribe | bounce | complaint | dnc | manual
  customer_id uuid references customers (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (channel, address, scope)
);

-- ─── Segments ───────────────────────────────────────────────────────────────
create table segments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  rules jsonb not null default '{"match":"all","conditions":[]}',
  member_count int not null default 0,
  refreshed_at timestamptz,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table segment_members (
  segment_id uuid not null references segments (id) on delete cascade,
  customer_id uuid not null references customers (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (segment_id, customer_id)
);
create index segment_members_customer_idx on segment_members (customer_id);

-- ─── Offers ─────────────────────────────────────────────────────────────────
create table offers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9-]{3,32}$'),
  name text not null,
  description text,
  kind mkt_offer_kind not null,
  value int not null check (value >= 0),   -- percent (0-100) or cents
  terms text,
  min_spend_cents int not null default 0 check (min_spend_cents >= 0),
  max_redemptions int check (max_redemptions > 0),
  per_customer_limit int not null default 1 check (per_customer_limit > 0),
  segment_id uuid references segments (id) on delete set null,
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (kind <> 'percent' or value <= 100),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table offer_redemptions (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references offers (id) on delete cascade,
  customer_id uuid references customers (id) on delete set null,
  work_order_id uuid references work_orders (id) on delete set null,
  invoice_id uuid references invoices (id) on delete set null,
  discount_cents int not null default 0 check (discount_cents >= 0),
  redeemed_at timestamptz not null default now()
);
create index offer_redemptions_offer_idx on offer_redemptions (offer_id, customer_id);

-- ─── Campaigns ──────────────────────────────────────────────────────────────
create table campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind mkt_campaign_kind not null,
  channel message_channel not null,
  status mkt_campaign_status not null default 'draft',
  segment_id uuid references segments (id) on delete set null,
  offer_id uuid references offers (id) on delete set null,
  trigger_event text,                              -- drip/lifecycle enrollment trigger
  exit_on text[] not null default '{booked,replied,unsubscribed}',
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  send_window_start_hour int not null default 9 check (send_window_start_hour between 0 and 23),
  send_window_end_hour int not null default 20 check (send_window_end_hour between 1 and 24),
  ab_test_percent int not null default 0 check (ab_test_percent between 0 and 100),
  ab_winner_metric text not null default 'click' check (ab_winner_metric in ('click', 'booking')),
  ab_decide_after_minutes int not null default 240 check (ab_decide_after_minutes >= 0),
  ab_winner_variant text,
  utm_campaign text,
  seasonal_key text,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (send_window_end_hour > send_window_start_hour)
);
create index campaigns_status_idx on campaigns (status, scheduled_at);

create table campaign_steps (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns (id) on delete cascade,
  step_order int not null default 1 check (step_order > 0),
  variant text not null default 'A' check (variant ~ '^[A-D]$'),
  delay_minutes int not null default 0 check (delay_minutes >= 0),
  subject text,
  body text not null,
  created_at timestamptz not null default now(),
  unique (campaign_id, step_order, variant)
);

create table campaign_enrollments (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns (id) on delete cascade,
  customer_id uuid not null references customers (id) on delete cascade,
  status mkt_enrollment_status not null default 'active',
  variant text,
  current_step int not null default 0,
  enrolled_at timestamptz not null default now(),
  next_step_at timestamptz,
  exited_at timestamptz,
  exit_reason text,
  unique (campaign_id, customer_id)
);
create index campaign_enrollments_due_idx on campaign_enrollments (next_step_at) where status = 'active';

create table campaign_sends (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns (id) on delete cascade,
  step_order int not null default 1,
  enrollment_id uuid references campaign_enrollments (id) on delete set null,
  customer_id uuid references customers (id) on delete set null,
  channel message_channel not null,
  variant text,                                     -- null = waiting for the A/B winner
  dedupe_key text not null unique,
  status mkt_send_status not null default 'scheduled',
  scheduled_for timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  message_id uuid references messages (id) on delete set null,
  detail text,
  opened_at timestamptz,
  clicked_at timestamptz,
  click_count int not null default 0,
  converted_at timestamptz,
  revenue_cents int not null default 0,
  created_at timestamptz not null default now()
);
create index campaign_sends_due_idx on campaign_sends (scheduled_for) where status = 'scheduled';
create index campaign_sends_campaign_idx on campaign_sends (campaign_id, status);
create index campaign_sends_customer_idx on campaign_sends (customer_id, sent_at desc);

alter table attribution_touches
  add constraint attribution_touches_campaign_fk foreign key (campaign_id) references campaigns (id) on delete set null;

create table short_links (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Za-z0-9_-]{4,32}$'),
  target_url text not null check (target_url ~ '^(https?://|/)'),
  campaign_id uuid references campaigns (id) on delete set null,
  utm_source text,
  utm_medium text,
  clicks int not null default 0,
  last_clicked_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table conversion_events (
  id uuid primary key default gen_random_uuid(),
  kind mkt_conversion_kind not null,
  customer_id uuid references customers (id) on delete set null,
  lead_id uuid references leads (id) on delete set null,
  appointment_id uuid references appointments (id) on delete set null,
  invoice_id uuid references invoices (id) on delete set null,
  anonymous_id text,
  value_cents int not null default 0,
  source text not null default 'direct',
  first_source text,
  first_touch_id uuid references attribution_touches (id) on delete set null,
  last_touch_id uuid references attribution_touches (id) on delete set null,
  campaign_id uuid references campaigns (id) on delete set null,
  dedupe_key text not null unique,
  metadata jsonb not null default '{}',
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index conversion_events_kind_idx on conversion_events (kind, occurred_at desc);
create index conversion_events_customer_idx on conversion_events (customer_id, occurred_at desc);

-- ─── Referrals & loyalty ────────────────────────────────────────────────────
create table referral_codes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null unique references customers (id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z0-9-]{4,32}$'),
  referrer_reward_cents int not null default 5000 check (referrer_reward_cents >= 0),
  referee_offer_id uuid references offers (id) on delete set null,
  uses int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table referrals (
  id uuid primary key default gen_random_uuid(),
  referral_code_id uuid not null references referral_codes (id) on delete cascade,
  referrer_customer_id uuid not null references customers (id) on delete cascade,
  referred_customer_id uuid references customers (id) on delete set null,
  lead_id uuid references leads (id) on delete set null,
  status mkt_referral_status not null default 'pending',
  invoice_id uuid references invoices (id) on delete set null,
  reward_cents int not null default 0,
  qualified_at timestamptz,
  rewarded_at timestamptz,
  created_at timestamptz not null default now(),
  check (referred_customer_id is null or referred_customer_id <> referrer_customer_id)
);
create unique index referrals_one_per_referred on referrals (referred_customer_id) where referred_customer_id is not null;

create table loyalty_accounts (
  customer_id uuid primary key references customers (id) on delete cascade,
  points_balance int not null default 0 check (points_balance >= 0),
  lifetime_points int not null default 0,
  lifetime_spend_cents int not null default 0,
  tier mkt_loyalty_tier not null default 'stock',
  tier_updated_at timestamptz,
  updated_at timestamptz not null default now()
);

create table loyalty_events (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers (id) on delete cascade,
  kind text not null check (kind in ('earn', 'redeem', 'adjust', 'referral_bonus', 'tier_change')),
  points int not null,
  invoice_id uuid references invoices (id) on delete set null,
  note text,
  dedupe_key text unique,
  created_at timestamptz not null default now()
);
create index loyalty_events_customer_idx on loyalty_events (customer_id, created_at desc);

-- ─── Settings ───────────────────────────────────────────────────────────────
create table marketing_settings (
  id int primary key default 1 check (id = 1),
  sender_name text not null default 'Lucky Diesel',
  sender_email text,
  reply_to_email text,
  postal_address text,
  sms_business_name text not null default 'Lucky Diesel',
  time_zone text not null default 'America/New_York',
  quiet_hours_start int not null default 21 check (quiet_hours_start between 0 and 23),  -- no marketing from this hour…
  quiet_hours_end int not null default 8 check (quiet_hours_end between 0 and 23),       -- …until this hour
  sms_max_per_week int not null default 2 check (sms_max_per_week >= 0),
  email_max_per_week int not null default 3 check (email_max_per_week >= 0),
  seasonal_toggles jsonb not null default '{"towing_season":true,"winter_diesel":true,"hurricane_prep":true}',
  winback_months int[] not null default '{6,12}',
  referrer_reward_cents int not null default 5000,
  referee_discount_cents int not null default 2500,
  loyalty_points_per_dollar int not null default 1 check (loyalty_points_per_dollar >= 0),
  vip_thresholds_cents jsonb not null default '{"stage_1":100000,"stage_2":500000,"full_build":1500000}',
  missed_call_text_back boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ─── Events (dyno days) ─────────────────────────────────────────────────────
create table events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,80}$'),
  name text not null,
  kind text not null default 'dyno_day' check (kind in ('dyno_day', 'open_house', 'tech_clinic', 'meet')),
  description text,
  location text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity int check (capacity > 0),
  price_cents int not null default 0 check (price_cents >= 0),
  registration_open boolean not null default true,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  customer_id uuid references customers (id) on delete set null,
  full_name text not null,
  email text,
  phone text,
  vehicle_label text,
  platform text,
  slot_at timestamptz,
  status text not null default 'registered' check (status in ('registered', 'waitlist', 'checked_in', 'cancelled', 'no_show')),
  waiver_signed_at timestamptz,
  media_consent boolean not null default false,
  horsepower int check (horsepower > 0),
  torque int check (torque > 0),
  created_at timestamptz not null default now()
);
create index event_registrations_event_idx on event_registrations (event_id, status);

-- ─── Calls (missed-call text-back) ──────────────────────────────────────────
create table marketing_call_events (
  id uuid primary key default gen_random_uuid(),
  call_sid text not null unique,
  from_number text not null,
  to_number text,
  call_status text not null,
  customer_id uuid references customers (id) on delete set null,
  texted_back_at timestamptz,
  message_id uuid references messages (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ─── Touch-ups ──────────────────────────────────────────────────────────────
create trigger segments_touch before update on segments for each row execute function touch_updated_at();
create trigger campaigns_touch before update on campaigns for each row execute function touch_updated_at();
create trigger marketing_settings_touch before update on marketing_settings for each row execute function touch_updated_at();

-- A read-friendly contact view. security_invoker keeps the caller's RLS in force.
create view marketing_contacts with (security_invoker = true) as
select
  c.id, c.full_name, c.email, c.phone, c.tags, c.lifecycle_stage, c.lead_score, c.birthday, c.is_fleet,
  c.fleet_account_id, c.email_marketing_status, c.sms_marketing_consent_at, c.sms_marketing_opted_out_at,
  c.sms_opted_out_at, c.first_touch_source, c.last_touch_source, c.source, c.created_at,
  la.tier as loyalty_tier, la.points_balance, coalesce(la.lifetime_spend_cents, 0) as lifetime_spend_cents,
  (select max(i.paid_at) from invoices i where i.customer_id = c.id and i.status = 'paid') as last_paid_at
from customers c
left join loyalty_accounts la on la.customer_id = c.id;

-- ─── RLS ────────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'fleet_accounts','pipeline_stages','tracking_visitors','attribution_touches','contact_consent_events','suppressions',
    'segments','segment_members','offers','offer_redemptions','campaigns','campaign_steps','campaign_enrollments',
    'campaign_sends','short_links','conversion_events','referral_codes','referrals','loyalty_accounts','loyalty_events',
    'marketing_settings','events','event_registrations','marketing_call_events'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy staff_read on %I for select to authenticated using (app.is_staff())', t);
  end loop;
end $$;

-- Admin writes everything except the append-only consent ledger and system logs.
do $$
declare t text;
begin
  foreach t in array array[
    'fleet_accounts','pipeline_stages','suppressions','segments','segment_members','offers','offer_redemptions',
    'campaigns','campaign_steps','campaign_enrollments','short_links','referral_codes','referrals',
    'loyalty_accounts','loyalty_events','marketing_settings','events','event_registrations'
  ] loop
    execute format('create policy admin_write on %I for all to authenticated using (app.is_admin()) with check (app.is_admin())', t);
  end loop;
end $$;

-- The consent ledger is append-only, even for admins (owner-recorded consent, e.g. a verbal opt-out).
create policy admin_insert_consent on contact_consent_events for insert to authenticated with check (app.is_admin());

-- Published events are public so the site can list dyno days.
create policy public_events on events for select to anon, authenticated using (published);

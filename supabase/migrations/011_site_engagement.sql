-- Site engagement & lead capture: partial quote forms, "heard about us", VIN,
-- QR placements, link-in-bio, web chat, waitlists, announcement bar, popups,
-- A/B tests, cookie consent log, call tracking numbers. Additive only.
-- Public endpoints write through the service role after validating input.

-- ─── Leads: self-reported source + VIN ──────────────────────────────────────
alter table leads
  add column heard_about text check (heard_about is null or char_length(heard_about) <= 60),
  add column vin text check (vin is null or vin ~ '^[A-HJ-NPR-Z0-9]{11,17}$');

-- ─── Short links: where the printed QR / link lives ─────────────────────────
alter table short_links
  add column placement text check (placement is null or char_length(placement) <= 60);

-- ─── Site-wide engagement settings (single row) ─────────────────────────────
create table site_engagement (
  id int primary key default 1 check (id = 1),
  -- {text, href, linkLabel, startsAt, endsAt, countdown}
  announcement jsonb,
  social_proof boolean not null default false,
  financing_url text check (financing_url is null or financing_url ~ '^https://'),
  -- [{service, platform, lowCents, highCents}]
  price_ranges jsonb not null default '[]',
  updated_at timestamptz not null default now()
);
insert into site_engagement (id) values (1) on conflict do nothing;
create trigger site_engagement_touch before update on site_engagement for each row execute function touch_updated_at();

-- ─── Page popups (time / scroll) ────────────────────────────────────────────
create table site_popups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  path_prefix text not null default '/' check (path_prefix ~ '^/[A-Za-z0-9/_-]{0,100}$'),
  trigger text not null default 'time' check (trigger in ('time', 'scroll')),
  trigger_value int not null default 30 check (trigger_value between 1 and 600),
  headline text not null check (char_length(headline) between 1 and 90),
  body text check (body is null or char_length(body) <= 240),
  cta_label text not null default 'See details' check (char_length(cta_label) between 1 and 30),
  cta_href text not null check (cta_href ~ '^/(?!/)'),
  active boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  views int not null default 0,
  clicks int not null default 0,
  created_at timestamptz not null default now()
);

-- ─── A/B tests ──────────────────────────────────────────────────────────────
create table ab_tests (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  slot text not null check (slot ~ '^[a-z0-9_]{2,40}$'),
  -- [{key: 'a', text: '...'}, {key: 'b', text: '...'}]
  variants jsonb not null,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);
create unique index ab_tests_one_active_per_slot on ab_tests (slot) where active;

create table ab_events (
  id bigint generated always as identity primary key,
  test_id uuid not null references ab_tests (id) on delete cascade,
  variant text not null check (variant ~ '^[a-z]$'),
  kind text not null check (kind in ('exposure', 'conversion')),
  visitor_id text not null check (visitor_id ~ '^[A-Za-z0-9_-]{8,64}$'),
  created_at timestamptz not null default now(),
  unique (test_id, visitor_id, kind)
);

-- ─── Partial quote forms (saved after step 1) ───────────────────────────────
create table partial_leads (
  id uuid primary key default gen_random_uuid(),
  session_key text not null unique check (session_key ~ '^[A-Za-z0-9_-]{16,64}$'),
  full_name text not null check (char_length(full_name) <= 80),
  email text not null check (char_length(email) <= 254),
  phone text not null check (char_length(phone) <= 20),
  platform text check (platform is null or char_length(platform) <= 20),
  service_id text check (service_id is null or char_length(service_id) <= 40),
  step int not null default 1 check (step between 1 and 3),
  remind_consent boolean not null default false,
  page_url text check (page_url is null or char_length(page_url) <= 500),
  ip text,
  customer_id uuid references customers (id) on delete set null,
  converted_lead_id uuid references leads (id) on delete set null,
  followed_up_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index partial_leads_open_idx on partial_leads (updated_at) where converted_lead_id is null and followed_up_at is null;

-- ─── Link-in-bio buttons (each backed by a tracked short link) ──────────────
create table bio_links (
  id uuid primary key default gen_random_uuid(),
  label text not null check (char_length(label) between 1 and 60),
  short_link_id uuid not null references short_links (id) on delete cascade,
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ─── Web chat ───────────────────────────────────────────────────────────────
create table chat_threads (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  visitor_name text not null check (char_length(visitor_name) between 1 and 80),
  email text check (email is null or char_length(email) <= 254),
  phone text check (phone is null or char_length(phone) <= 20),
  sms_consent boolean not null default false,
  customer_id uuid references customers (id) on delete set null,
  lead_id uuid references leads (id) on delete set null,
  status text not null default 'open' check (status in ('open', 'closed')),
  unread_by_shop int not null default 0 check (unread_by_shop >= 0),
  page_url text check (page_url is null or char_length(page_url) <= 500),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index chat_threads_recent_idx on chat_threads (last_message_at desc);

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references chat_threads (id) on delete cascade,
  sender text not null check (sender in ('visitor', 'shop', 'auto')),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index chat_messages_thread_idx on chat_messages (thread_id, created_at);

-- ─── "Notify me" waitlists ──────────────────────────────────────────────────
create table waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  topic text not null check (topic ~ '^[a-z0-9:_-]{2,120}$'),
  topic_label text not null check (char_length(topic_label) between 1 and 120),
  email text not null check (char_length(email) <= 254),
  full_name text check (full_name is null or char_length(full_name) <= 80),
  customer_id uuid references customers (id) on delete set null,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (topic, email)
);

-- ─── Cookie consent choices (evidence, anonymous) ───────────────────────────
create table site_consent_log (
  id bigint generated always as identity primary key,
  visitor_id text not null check (visitor_id ~ '^[A-Za-z0-9_-]{8,64}$'),
  analytics boolean not null,
  ads boolean not null,
  policy_version text not null check (char_length(policy_version) <= 40),
  created_at timestamptz not null default now()
);

-- ─── Call tracking numbers (number → source) ────────────────────────────────
create table tracking_numbers (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique check (phone ~ '^\+1[0-9]{10}$'),
  source text not null check (source ~ '^[a-z0-9_-]{2,40}$'),
  label text not null check (char_length(label) between 1 and 60),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ─── RLS: staff read, admin write. The public site reads through the server. ─
do $$
declare t text;
begin
  foreach t in array array[
    'site_engagement','site_popups','ab_tests','ab_events','partial_leads','bio_links','chat_threads',
    'chat_messages','waitlist_signups','site_consent_log','tracking_numbers'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy staff_read on %I for select to authenticated using (app.is_staff())', t);
    execute format('create policy admin_write on %I for all to authenticated using (app.is_admin()) with check (app.is_admin())', t);
  end loop;
end $$;

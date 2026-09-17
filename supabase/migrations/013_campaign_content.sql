-- Campaign content and send rules: email blocks, MMS, sender override, topics
-- (preference center), send-time optimization, newsletter autopilot, engagement
-- sunset, recipient-local quiet hours, daily caps, throttling, SMS cost, keywords.
-- Additive only.

-- ─── Campaign content ───────────────────────────────────────────────────────
alter table campaign_steps
  add column blocks jsonb not null default '[]' check (jsonb_typeof(blocks) = 'array'),
  add column media_url text check (media_url is null or media_url ~ '^https://');

alter table campaigns
  add column from_name text check (from_name is null or char_length(from_name) <= 80),
  add column topic text check (topic is null or topic in ('newsletter', 'offers', 'events', 'service')),
  add column send_time_optimized boolean not null default false,
  add column autopilot_key text;
create unique index campaigns_autopilot_key_idx on campaigns (autopilot_key) where autopilot_key is not null;

-- ─── Contacts: topic preferences and sunset ─────────────────────────────────
alter table customers
  add column email_topics_off text[] not null default '{}',
  add column sunset_notice_at timestamptz;

-- ─── Settings ───────────────────────────────────────────────────────────────
alter table marketing_settings
  add column recipient_local_time boolean not null default true,
  add column sms_max_per_day int not null default 1 check (sms_max_per_day between 0 and 10),
  add column email_max_per_day int not null default 1 check (email_max_per_day between 0 and 10),
  add column send_rate_per_minute int not null default 60 check (send_rate_per_minute between 1 and 6000),
  add column sms_segment_fee_millicents int not null default 830 check (sms_segment_fee_millicents between 0 and 100000),
  add column mms_fee_millicents int not null default 2000 check (mms_fee_millicents between 0 and 100000),
  add column sunset_days int not null default 180 check (sunset_days = 0 or sunset_days between 60 and 730),
  add column newsletter_autopilot boolean not null default false;

-- ─── SMS keywords (opt-in and auto-replies) ─────────────────────────────────
create table sms_keywords (
  id uuid primary key default gen_random_uuid(),
  keyword text not null unique check (keyword ~ '^[A-Z0-9]{2,20}$'),
  action text not null default 'reply' check (action in ('reply', 'opt_in')),
  reply text not null check (char_length(reply) between 1 and 320),
  active boolean not null default true,
  hits int not null default 0,
  last_hit_at timestamptz,
  created_at timestamptz not null default now()
);

insert into sms_keywords (keyword, action, reply) values
  ('DIESEL', 'opt_in', 'Lucky Diesel: you''re in for deals and dyno days. Up to 4 msgs/mo. Msg & data rates may apply. Reply HELP for help, STOP to cancel.'),
  ('HOURS', 'reply', 'Lucky Diesel: call (843) 995-9252 for today''s hours, or book online: luckydiesel.com/book'),
  ('BOOK', 'reply', 'Lucky Diesel: book your truck in here: luckydiesel.com/book'),
  ('PRICE', 'reply', 'Lucky Diesel: every truck is different. Get a free quote: luckydiesel.com/book')
on conflict (keyword) do nothing;

alter table sms_keywords enable row level security;
create policy staff_read on sms_keywords for select to authenticated using (app.is_staff());
create policy admin_write on sms_keywords for all to authenticated using (app.is_admin()) with check (app.is_admin());

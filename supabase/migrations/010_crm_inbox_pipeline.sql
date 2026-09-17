-- CRM: inbox threads, notes, reply snippets, speed-to-lead alerts, deal value,
-- assignment/snooze, quote expiry and automatic pipeline stage moves.
-- Additive only. Triggers never block shop work: failures raise a warning.

-- ─── Leads & jobs ───────────────────────────────────────────────────────────
alter table leads
  add column deal_value_cents int not null default 0 check (deal_value_cents >= 0),
  add column assigned_to uuid references profiles (id) on delete set null,
  add column snoozed_until timestamptz,
  add column last_activity_at timestamptz not null default now();
update leads set last_activity_at = coalesce(contacted_at, created_at);
create index leads_pipeline_stage_idx on leads (pipeline_stage_id);
create index leads_customer_idx on leads (customer_id);

alter table work_orders
  add column estimate_expires_at timestamptz;

-- ─── Inbox ──────────────────────────────────────────────────────────────────
-- One row per conversation (phone or email). Created on first action; the
-- messages themselves stay in `messages`.
create table inbox_threads (
  id uuid primary key default gen_random_uuid(),
  channel message_channel not null,
  address text not null check (char_length(address) between 3 and 320),
  customer_id uuid references customers (id) on delete set null,
  assigned_to uuid references profiles (id) on delete set null,
  snoozed_until timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (channel, address)
);

create table crm_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads (id) on delete cascade,
  thread_id uuid references inbox_threads (id) on delete cascade,
  author_id uuid references profiles (id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  check (lead_id is not null or thread_id is not null)
);
create index crm_notes_lead_idx on crm_notes (lead_id, created_at desc);
create index crm_notes_thread_idx on crm_notes (thread_id, created_at desc);

create table reply_snippets (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 60),
  body text not null check (char_length(body) between 1 and 1000),
  sort int not null default 0,
  created_at timestamptz not null default now()
);
insert into reply_snippets (title, body, sort) values
  ('Book a time', 'You can pick a time that works here: {{booking_link}}. Or call {{shop_phone}}.', 1),
  ('Price question', 'Every truck is a little different, so we quote after a quick look. Book a check-in here: {{booking_link}}', 2),
  ('Truck status', 'Checking on your truck now. We will text you an update shortly.', 3),
  ('Parts on order', 'Your parts are on order. We will reach out as soon as they land.', 4),
  ('Thanks', 'Thanks for choosing Lucky Diesel. Holler if you need anything.', 5);

-- Idempotency ledger for owner alerts and nudges (one per kind + subject).
create table crm_alerts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind ~ '^[a-z0-9_]{2,40}$'),
  subject_key text not null check (char_length(subject_key) between 1 and 400),
  detail text,
  sent_at timestamptz not null default now(),
  unique (kind, subject_key)
);
create index crm_alerts_sent_idx on crm_alerts (sent_at desc);

create table crm_settings (
  id int primary key default 1 check (id = 1),
  sla_first_minutes int not null default 5 check (sla_first_minutes between 1 and 1440),
  sla_backup_minutes int not null default 15 check (sla_backup_minutes between 1 and 1440),
  backup_phone text check (backup_phone is null or char_length(backup_phone) <= 40),
  backup_email text check (backup_email is null or char_length(backup_email) <= 320),
  hot_score int not null default 70 check (hot_score between 1 and 100),
  stale_hours int not null default 48 check (stale_hours between 1 and 2160),
  unanswered_hours int not null default 2 check (unanswered_hours between 1 and 168),
  quote_valid_days int not null default 14 check (quote_valid_days between 1 and 180),
  quote_nudge_days int not null default 3 check (quote_nudge_days between 1 and 60),
  auto_reply_enabled boolean not null default true,
  auto_reply_text text not null default 'Thanks for texting Lucky Diesel. We are closed right now and will reply first thing when we open.'
    check (char_length(auto_reply_text) between 10 and 320),
  updated_at timestamptz not null default now()
);
insert into crm_settings (id) values (1) on conflict do nothing;
create trigger crm_settings_touch before update on crm_settings for each row execute function touch_updated_at();

-- ─── Automatic stage moves ──────────────────────────────────────────────────
-- Stage keys that match a lead status keep the two in sync, inside the lead's
-- current pipeline (default 'leads'). New leads start in that pipeline's 'new'.
create or replace function app.crm_stage_for(p_current uuid, p_key text) returns uuid
language sql stable security definer set search_path = public as $$
  select s.id from pipeline_stages s
  where s.key = p_key
    and s.pipeline = coalesce((select c.pipeline from pipeline_stages c where c.id = p_current), 'leads')
  limit 1
$$;

create or replace function app.crm_lead_sync() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_key text;
  v_stage uuid;
begin
  if tg_op = 'INSERT' then
    if new.pipeline_stage_id is null then
      new.pipeline_stage_id := app.crm_stage_for(null, new.status::text);
    end if;
    return new;
  end if;

  if new.status is distinct from old.status and new.pipeline_stage_id is not distinct from old.pipeline_stage_id then
    v_stage := app.crm_stage_for(old.pipeline_stage_id, new.status::text);
    if v_stage is not null then new.pipeline_stage_id := v_stage; end if;
    new.last_activity_at := now();
  elsif new.pipeline_stage_id is distinct from old.pipeline_stage_id and new.status is not distinct from old.status then
    select key into v_key from pipeline_stages where id = new.pipeline_stage_id;
    if v_key in ('new', 'contacted', 'booked', 'won', 'lost') then
      new.status := v_key::lead_status;
      if v_key in ('booked', 'won') and new.converted_at is null then new.converted_at := now(); end if;
      if v_key = 'contacted' and new.contacted_at is null then new.contacted_at := now(); end if;
    end if;
    new.last_activity_at := now();
  end if;
  return new;
exception when others then
  raise warning 'crm_lead_sync: %', sqlerrm;
  return new;
end $$;

create trigger leads_crm_sync before insert or update of status, pipeline_stage_id on leads
  for each row execute function app.crm_lead_sync();

-- Open leads a job belongs to: the linked lead, else the customer's open leads from the last 180 days.
create or replace function app.crm_move_open_leads(p_lead uuid, p_customer uuid, p_key text, p_statuses text[]) returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    select l.id, l.pipeline_stage_id from leads l
    where l.status::text = any (p_statuses)
      and ((p_lead is not null and l.id = p_lead)
        or (p_lead is null and l.customer_id = p_customer and l.created_at > now() - interval '180 days'))
  loop
    update leads set pipeline_stage_id = coalesce(app.crm_stage_for(r.pipeline_stage_id, p_key), pipeline_stage_id), last_activity_at = now()
    where id = r.id;
  end loop;
end $$;

create or replace function app.crm_work_order_sync() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_days int;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then return new; end if;
  if new.status = 'awaiting_approval' and new.estimate_expires_at is null then
    select quote_valid_days into v_days from crm_settings where id = 1;
    new.estimate_expires_at := now() + make_interval(days => coalesce(v_days, 14));
  end if;
  return new;
exception when others then
  raise warning 'crm_work_order_sync: %', sqlerrm;
  return new;
end $$;

create trigger work_orders_crm_sync before insert or update of status on work_orders
  for each row execute function app.crm_work_order_sync();

create or replace function app.crm_work_order_moves() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then return null; end if;
  if new.status = 'awaiting_approval' then
    perform app.crm_move_open_leads(new.lead_id, new.customer_id, 'quoted', array['new', 'contacted']);
  elsif new.status in ('approved', 'in_progress', 'waiting_parts', 'quality_check') then
    perform app.crm_move_open_leads(new.lead_id, new.customer_id, 'in_shop', array['new', 'contacted', 'booked']);
  end if;
  return null;
exception when others then
  raise warning 'crm_work_order_moves: %', sqlerrm;
  return null;
end $$;

create trigger work_orders_crm_moves after insert or update of status on work_orders
  for each row execute function app.crm_work_order_moves();

-- Invoice created → deal value; invoice paid → won with the paid amount.
create or replace function app.crm_invoice_sync() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_lead uuid;
begin
  select lead_id into v_lead from work_orders where id = new.work_order_id;
  if tg_op = 'INSERT' then
    update leads set deal_value_cents = new.total_cents
    where deal_value_cents = 0 and status in ('new', 'contacted', 'booked')
      and ((v_lead is not null and id = v_lead) or (v_lead is null and customer_id = new.customer_id and created_at > now() - interval '180 days'));
  elsif new.status = 'paid' and old.status is distinct from 'paid' then
    update leads set status = 'won', converted_at = coalesce(converted_at, now()), deal_value_cents = greatest(deal_value_cents, new.total_cents)
    where status in ('new', 'contacted', 'booked')
      and ((v_lead is not null and id = v_lead) or (v_lead is null and customer_id = new.customer_id and created_at > now() - interval '180 days'));
  end if;
  return null;
exception when others then
  raise warning 'crm_invoice_sync: %', sqlerrm;
  return null;
end $$;

create trigger invoices_crm_sync after insert or update of status on invoices
  for each row execute function app.crm_invoice_sync();

-- Any customer conversation counts as deal activity (keeps stale alerts honest).
create or replace function app.crm_message_activity() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.customer_id is not null and (new.direction = 'inbound' or new.automation_key is null or new.automation_key = 'inbox_reply') then
    update leads set last_activity_at = now() where customer_id = new.customer_id and status in ('new', 'contacted', 'booked');
  end if;
  return null;
exception when others then
  raise warning 'crm_message_activity: %', sqlerrm;
  return null;
end $$;

create trigger messages_crm_activity after insert on messages
  for each row execute function app.crm_message_activity();

revoke all on function app.crm_stage_for(uuid, text) from public;
revoke all on function app.crm_move_open_leads(uuid, uuid, text, text[]) from public;

-- ─── RLS ────────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['inbox_threads', 'crm_notes', 'reply_snippets', 'crm_alerts', 'crm_settings'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy staff_read on %I for select to authenticated using (app.is_staff())', t);
  end loop;
  foreach t in array array['inbox_threads', 'crm_notes', 'reply_snippets', 'crm_settings'] loop
    execute format('create policy admin_write on %I for all to authenticated using (app.is_admin()) with check (app.is_admin())', t);
  end loop;
end $$;
-- crm_alerts is written by the server (service role) only.

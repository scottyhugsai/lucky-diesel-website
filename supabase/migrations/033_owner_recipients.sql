-- Owner alert recipients: several people can receive owner alerts (new lead,
-- booking, approval, daily summary, negative review, marketing alerts), each
-- one addable/removable with its own email/SMS switches.
-- shop_settings.owner_email / owner_phone stay as the fallback when this table
-- holds no usable row.

create table if not exists owner_recipients (
  id uuid primary key default gen_random_uuid(),
  label text not null check (length(btrim(label)) between 1 and 80),
  email text check (email is null or length(email) <= 254),
  phone text check (phone is null or length(phone) <= 30),
  notify_email boolean not null default true,
  notify_sms boolean not null default true,
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  constraint owner_recipients_needs_contact check (
    nullif(btrim(coalesce(email, '')), '') is not null
    or nullif(btrim(coalesce(phone, '')), '') is not null
  )
);

create index if not exists owner_recipients_order_idx on owner_recipients (active, sort, created_at);

-- Backfill the existing single owner contact so nothing regresses.
insert into owner_recipients (label, email, phone, sort)
select 'Lucky Diesel — owner', nullif(btrim(coalesce(s.owner_email, '')), ''), nullif(btrim(coalesce(s.owner_phone, '')), ''), 0
from shop_settings s
where s.id = 1
  and (nullif(btrim(coalesce(s.owner_email, '')), '') is not null or nullif(btrim(coalesce(s.owner_phone, '')), '') is not null)
  and not exists (select 1 from owner_recipients);

-- ─── RLS: admins write, staff read ──────────────────────────────────────────
alter table owner_recipients enable row level security;
create policy admin_write on owner_recipients for all to authenticated
  using (app.is_admin()) with check (app.is_admin());
create policy staff_read on owner_recipients for select to authenticated
  using (app.is_staff());

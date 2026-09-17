-- Audience data: truck usage, sold trucks, CSV imports, anonymized contacts,
-- and the revoke-all consent switch. Additive only.

-- ─── Trucks: how they're used, and whether the customer still owns them ─────
alter table vehicles
  add column usage text[] not null default '{}'
    check (usage <@ array['towing', 'daily', 'work', 'show', 'fleet', 'offroad']::text[]),
  add column sold_at timestamptz;
create index vehicles_unsold_idx on vehicles (customer_id) where sold_at is null;

-- ─── Contacts: set when a data-deletion request anonymized the record ───────
alter table customers
  add column anonymized_at timestamptz;

-- ─── Consent: one opt-out revokes every purpose on that address ─────────────
alter table marketing_settings
  add column revoke_all_on_opt_out boolean not null default false;

-- ─── CSV imports (audit trail for imported consent) ─────────────────────────
create table contact_imports (
  id uuid primary key default gen_random_uuid(),
  file_name text not null check (char_length(file_name) <= 200),
  email_basis text not null check (email_basis in ('none', 'column', 'all')),
  basis_note text check (char_length(basis_note) <= 300),
  total_rows int not null default 0 check (total_rows >= 0),
  created_count int not null default 0 check (created_count >= 0),
  updated_count int not null default 0 check (updated_count >= 0),
  skipped_count int not null default 0 check (skipped_count >= 0),
  email_opt_ins int not null default 0 check (email_opt_ins >= 0),
  issues jsonb not null default '[]',
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index contact_imports_created_idx on contact_imports (created_at desc);

alter table contact_imports enable row level security;
create policy admin_read on contact_imports for select to authenticated using (app.is_admin());
create policy admin_insert on contact_imports for insert to authenticated with check (app.is_admin());

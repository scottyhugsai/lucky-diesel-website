-- Site control panel: the owner edits the public website from /admin/site.
--
-- One table holds every editable block. The *shape* of a block (its fields,
-- limits and shipped defaults) lives in code — lib/site-content/registry — so
-- the database only stores values and never has to be migrated when copy moves.
--
-- Draft and published are separate columns: the site reads `published`, the
-- admin edits `draft`, and an admin previewing the site reads `draft` instead.

create table if not exists site_blocks (
  key text not null check (length(key) between 1 and 120),
  -- 'all' applies to every design; a design id overrides it for that design only.
  design text not null default 'all' check (design in ('all', 'v1', 'v2', 'v3', 'v4')),
  draft jsonb not null default '{}'::jsonb,
  published jsonb,
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  primary key (key, design)
);

create index if not exists site_blocks_published_idx on site_blocks (key) where published is not null;

-- Photos for the site, in the same public bucket the gallery uses (prefix `site/`).
create table if not exists site_media (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 120),
  alt_text text check (alt_text is null or length(alt_text) <= 200),
  url text not null,
  storage_path text not null unique,
  width int not null check (width > 0 and width <= 20000),
  height int not null check (height > 0 and height <= 20000),
  bytes int check (bytes is null or bytes > 0),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

create index if not exists site_media_recent_idx on site_media (created_at desc);

-- Who changed what. Append-only: nothing may update or delete a row.
create table if not exists site_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete set null,
  actor_email text,
  action text not null check (action in ('save', 'publish', 'revert', 'discard', 'upload', 'delete')),
  entity text not null check (entity in ('block', 'product', 'media')),
  entity_key text not null,
  summary text not null check (length(summary) <= 300),
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create index if not exists site_audit_log_recent_idx on site_audit_log (created_at desc);
create index if not exists site_audit_log_entity_idx on site_audit_log (entity, entity_key, created_at desc);

-- ─── RLS ────────────────────────────────────────────────────────────────────
alter table site_blocks enable row level security;
alter table site_media enable row level security;
alter table site_audit_log enable row level security;

-- Visitors read published content only. RLS is row-level, so the `draft` column
-- is withheld with a column grant: an anonymous reader can never select it.
create policy site_blocks_public_read on site_blocks for select to anon, authenticated
  using (published is not null);
create policy site_blocks_admin_read on site_blocks for select to authenticated
  using (app.is_admin());
create policy site_blocks_admin_write on site_blocks for all to authenticated
  using (app.is_admin()) with check (app.is_admin());

revoke select on site_blocks from anon;
grant select (key, design, published, published_at, updated_at) on site_blocks to anon;

-- Media is in a public bucket already; the rows are safe to read.
create policy site_media_public_read on site_media for select to anon, authenticated using (true);
create policy site_media_admin_write on site_media for all to authenticated
  using (app.is_admin()) with check (app.is_admin());

-- The audit trail is admins-only, and append-only even for them.
create policy site_audit_admin_read on site_audit_log for select to authenticated
  using (app.is_admin());
create policy site_audit_admin_insert on site_audit_log for insert to authenticated
  with check (app.is_admin());

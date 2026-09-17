-- Marketing ops (builder B8): AI spend cap, 10DLC helper profile, sender DNS
-- check cache, asset library fields, template library, ops checklists,
-- integration-health alerts and cron run log. Additive only.

-- ─── Settings ───────────────────────────────────────────────────────────────
alter table marketing_settings
  add column if not exists ai_monthly_cap_usd numeric(10, 2) not null default 25 check (ai_monthly_cap_usd >= 0 and ai_monthly_cap_usd <= 5000),
  add column if not exists tendlc_profile jsonb not null default '{}',
  add column if not exists sender_dns_check jsonb;

-- ─── Asset library (on the 009 creative_assets table) ───────────────────────
alter table creative_assets
  add column if not exists asset_title text check (asset_title is null or char_length(asset_title) <= 120),
  add column if not exists asset_tags text[] not null default '{}',
  add column if not exists asset_license text not null default 'unknown'
    check (asset_license in ('owned', 'customer_release', 'stock', 'ai_generated', 'manufacturer', 'unknown')),
  add column if not exists asset_license_note text check (asset_license_note is null or char_length(asset_license_note) <= 300),
  add column if not exists asset_consent text not null default 'not_needed'
    check (asset_consent in ('not_needed', 'release_on_file', 'pending', 'no_release')),
  add column if not exists uploaded_by uuid references profiles (id) on delete set null;
create index if not exists creative_assets_tags_idx on creative_assets using gin (asset_tags);

-- ─── Template library (versioned: each save is a new row) ───────────────────
create table marketing_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null check (template_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(template_key) <= 60),
  version int not null default 1 check (version > 0),
  name text not null check (char_length(name) between 1 and 80),
  channel text not null check (channel in ('sms', 'email', 'social', 'review_reply', 'ad')),
  subject text check (subject is null or char_length(subject) <= 200),
  body text not null check (char_length(body) between 1 and 5000),
  tags text[] not null default '{}',
  compliance_status text not null default 'pass' check (compliance_status in ('pass', 'warn', 'block')),
  compliance_issues jsonb not null default '[]',
  archived boolean not null default false,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (template_key, version)
);
create index marketing_templates_key_idx on marketing_templates (template_key, version desc);

-- ─── Ops checklists ─────────────────────────────────────────────────────────
create table ops_checklist_ticks (
  id uuid primary key default gen_random_uuid(),
  checklist text not null check (checklist in ('launch', 'weekly', 'monthly')),
  period text not null check (period ~ '^(once|\d{4}-W\d{2}|\d{4}-\d{2})$'),
  item text not null check (item ~ '^[a-z0-9_]{1,40}$'),
  done_by uuid references profiles (id) on delete set null,
  done_at timestamptz not null default now(),
  unique (checklist, period, item)
);

-- ─── Integration health ─────────────────────────────────────────────────────
create table ops_alerts (
  key text primary key check (char_length(key) <= 80),
  severity text not null default 'warn' check (severity in ('warn', 'bad')),
  title text not null,
  detail text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_alerted_at timestamptz,
  resolved_at timestamptz
);

create table ops_cron_runs (
  id uuid primary key default gen_random_uuid(),
  job text not null check (job in ('marketing', 'automations', 'content')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean,
  errors jsonb not null default '[]'
);
create index ops_cron_runs_job_idx on ops_cron_runs (job, started_at desc);

-- ─── RLS: owner only ────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['marketing_templates', 'ops_checklist_ticks', 'ops_alerts', 'ops_cron_runs'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy admin_all on %I for all to authenticated using (app.is_admin()) with check (app.is_admin())', t);
  end loop;
end $$;

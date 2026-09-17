-- Marketing content engine (part B): AI creative, paid ads, social, reputation,
-- SEO/listings, landing pages and lead magnets. Everything is a draft until a
-- marketing_approvals row approves it. Platform tokens are AES-GCM ciphertext
-- and are never selectable by signed-in users (column grants below).
-- Status/kind columns are text + check constraints (no new enums) so part A's
-- migration can land in any order without type collisions.

-- ─── AI generation ─────────────────────────────────────────────────────────
create table ai_prompt_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  version int not null default 1 check (version > 0),
  kind text not null check (kind in ('ad_copy','image','social_caption','email','review_reply','landing_copy','seo','assistant','plan')),
  system_prompt text not null,
  user_template text not null,
  output_schema jsonb not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (key, version)
);

create table ai_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('ad_copy','image','social_caption','email','review_reply','landing_copy','seo','assistant','plan')),
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed')),
  generator text not null default 'demo' check (generator in ('demo','ai')),
  model_id text,
  prompt_key text,
  prompt_version int,
  input jsonb not null default '{}',
  output jsonb,
  input_tokens int,
  output_tokens int,
  cost_usd numeric(10, 5) not null default 0,
  error text,
  requested_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index ai_generation_jobs_created_idx on ai_generation_jobs (created_at desc);

create table brand_voice (
  id int primary key default 1 check (id = 1),
  tone text not null default 'Straight-talking Charleston diesel techs. Confident, plain, never hype.',
  do_rules text[] not null default '{}',
  dont_rules text[] not null default '{}',
  banned_phrases text[] not null default '{}',
  approved_claims text[] not null default '{}',
  hashtags text[] not null default '{}',
  default_cta text not null default 'Book a bay',
  updated_at timestamptz not null default now()
);

-- ─── Creative ──────────────────────────────────────────────────────────────
create table creative_assets (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'image' check (kind in ('image','video')),
  source text not null check (source in ('upload','ai','shopify','gallery','build','job_media','template')),
  url text,
  storage_path text,
  mime text,
  width int,
  height int,
  alt_text text,
  sha256 text,
  ai_generation_id uuid references ai_generation_jobs (id) on delete set null,
  -- Owner photos can show plates, VINs or faces: blur before any public use.
  needs_privacy_review boolean not null default false,
  privacy_note text,
  is_sample boolean not null default false,
  created_at timestamptz not null default now()
);

create table landing_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null,
  template text not null default 'offer' check (template in ('offer','event','service','lead_magnet')),
  blocks jsonb not null default '[]',
  offer jsonb,
  form jsonb not null default '{}',
  utm_default jsonb not null default '{}',
  seo_description text,
  lead_magnet_id uuid,
  published boolean not null default false,
  published_at timestamptz,
  generator text not null default 'demo' check (generator in ('demo','ai','manual')),
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table lead_magnets (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null,
  description text not null,
  format text not null default 'checklist' check (format in ('checklist','guide')),
  sections jsonb not null default '[]',
  email_subject text not null,
  published boolean not null default false,
  downloads int not null default 0,
  is_sample boolean not null default false,
  created_at timestamptz not null default now()
);
alter table landing_pages add constraint landing_pages_lead_magnet_fk
  foreign key (lead_magnet_id) references lead_magnets (id) on delete set null;

create table ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  platform text not null check (platform in ('meta','google','tiktok','lsa')),
  objective text not null default 'leads' check (objective in ('leads','traffic','calls','awareness','sales')),
  audience jsonb not null default '{}',
  daily_budget_cents int not null default 0 check (daily_budget_cents >= 0),
  starts_on date,
  ends_on date,
  status text not null default 'draft' check (status in ('draft','pending_approval','approved','scheduled','live','paused','completed','rejected','archived')),
  landing_page_id uuid references landing_pages (id) on delete set null,
  utm_campaign text,
  simulated boolean not null default true,
  generator text not null default 'demo' check (generator in ('demo','ai','manual')),
  notes text,
  is_sample boolean not null default false,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create table budget_guards (
  id uuid primary key default gen_random_uuid(),
  platform text not null unique check (platform in ('all','meta','google','tiktok','lsa')),
  max_daily_cents int not null check (max_daily_cents >= 0),
  max_monthly_cents int not null check (max_monthly_cents >= 0),
  max_campaign_days int not null default 30 check (max_campaign_days > 0),
  auto_pause_cpl_cents int,
  pacing_tolerance numeric(4, 2) not null default 1.20 check (pacing_tolerance >= 1),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table ad_creatives (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references ad_campaigns (id) on delete set null,
  name text not null,
  goal text not null default 'leads' check (goal in ('leads','bookings','traffic','awareness','sales')),
  platform text not null check (platform in ('meta','google_pmax','google_search','tiktok')),
  subject_kind text not null check (subject_kind in ('product','build','offer','season','dyno','review','general')),
  subject_ref text,
  audience text,
  status text not null default 'draft' check (status in ('draft','pending_approval','approved','scheduled','live','paused','completed','rejected','archived')),
  generator text not null default 'demo' check (generator in ('demo','ai')),
  ai_generation_id uuid references ai_generation_jobs (id) on delete set null,
  landing_url text,
  is_sample boolean not null default false,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table ad_creative_variants (
  id uuid primary key default gen_random_uuid(),
  creative_id uuid not null references ad_creatives (id) on delete cascade,
  label text not null,
  hook text,
  angle text,
  headline text not null,
  long_headline text,
  primary_text text not null,
  description text,
  cta text not null,
  format text not null default '1:1' check (format in ('1:1','4:5','9:16','1.91:1')),
  image_template text not null check (image_template in ('dyno','product','offer','seasonal','review','before_after','photo')),
  image_params jsonb not null default '{}',
  image_asset_id uuid references creative_assets (id) on delete set null,
  compliance_status text not null default 'pass' check (compliance_status in ('pass','warn','block')),
  compliance_issues jsonb not null default '[]',
  generator text not null default 'demo' check (generator in ('demo','ai')),
  created_at timestamptz not null default now()
);
create index ad_creative_variants_creative_idx on ad_creative_variants (creative_id);

create table marketing_approvals (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('ad_creative','ad_campaign','social_post','review_reply','landing_page','seo_content')),
  subject_id uuid not null,
  payload_hash text not null,
  decision text not null default 'pending' check (decision in ('pending','approved','rejected','changes_requested')),
  requested_by uuid references profiles (id) on delete set null,
  decided_by uuid references profiles (id) on delete set null,
  -- The approver confirmed they read the compliance warnings (required to publish 'warn' content).
  warnings_acknowledged boolean not null default false,
  notes text,
  requested_at timestamptz not null default now(),
  decided_at timestamptz
);
create index marketing_approvals_subject_idx on marketing_approvals (subject_type, subject_id, requested_at desc);
create index marketing_approvals_pending_idx on marketing_approvals (decision) where decision = 'pending';

create table channel_connections (
  id uuid primary key default gen_random_uuid(),
  platform text not null unique check (platform in ('meta_ads','google_ads','tiktok_ads','lsa','instagram','facebook','gbp','tiktok')),
  status text not null default 'not_connected' check (status in ('not_connected','demo','connected','expired','error','revoked')),
  account_name text,
  external_account_id text,
  scopes text[] not null default '{}',
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_key_id text,
  token_expires_at timestamptz,
  last_error text,
  connected_by uuid references profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table ad_publications (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references ad_creative_variants (id) on delete cascade,
  campaign_id uuid references ad_campaigns (id) on delete set null,
  connection_id uuid references channel_connections (id) on delete set null,
  approval_id uuid references marketing_approvals (id) on delete set null,
  platform text not null,
  mode text not null default 'demo' check (mode in ('demo','live')),
  simulated boolean not null default true,
  external_ids jsonb not null default '{}',
  status_on_platform text not null default 'PAUSED',
  publish_attempt_key text not null unique,
  request_preview jsonb not null default '{}',
  error text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);

create table ad_metrics_daily (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references ad_publications (id) on delete cascade,
  date date not null,
  impressions int not null default 0,
  clicks int not null default 0,
  spend_cents int not null default 0,
  leads int not null default 0,
  conversions int not null default 0,
  conversion_value_cents int not null default 0,
  simulated boolean not null default true,
  unique (publication_id, date)
);

-- ─── Social + calendar ─────────────────────────────────────────────────────
create table social_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  caption text not null,
  hashtags text[] not null default '{}',
  link_url text,
  asset_ids uuid[] not null default '{}',
  image_template text check (image_template in ('dyno','product','offer','seasonal','review','before_after','photo')),
  image_params jsonb not null default '{}',
  pillar text,
  source_type text not null default 'manual' check (source_type in ('build','dyno_run','product','review','manual','pillar','plan')),
  source_id text,
  status text not null default 'draft' check (status in ('draft','pending_approval','approved','scheduled','published','failed','rejected')),
  scheduled_for timestamptz,
  published_at timestamptz,
  generator text not null default 'demo' check (generator in ('demo','ai','manual')),
  ai_generation_id uuid references ai_generation_jobs (id) on delete set null,
  compliance_status text not null default 'pass' check (compliance_status in ('pass','warn','block')),
  compliance_issues jsonb not null default '[]',
  needs_privacy_review boolean not null default false,
  privacy_note text,
  is_sample boolean not null default false,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index social_posts_schedule_idx on social_posts (status, scheduled_for);
-- One auto-draft per source (build, dyno run, pillar date).
create unique index social_posts_source_idx on social_posts (source_type, source_id, coalesce(pillar, '')) where source_id is not null;

create table social_post_targets (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references social_posts (id) on delete cascade,
  platform text not null check (platform in ('instagram','facebook','gbp','tiktok')),
  connection_id uuid references channel_connections (id) on delete set null,
  caption_override text,
  platform_options jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending','scheduled','published','simulated','failed','draft_handoff')),
  simulated boolean not null default true,
  external_id text,
  permalink text,
  published_at timestamptz,
  error text,
  attempts int not null default 0,
  unique (post_id, platform)
);

create table content_calendar_items (
  id uuid primary key default gen_random_uuid(),
  scheduled_for timestamptz not null,
  kind text not null check (kind in ('social_post','ad_campaign','ad_creative','email','landing_page','seo','pillar','event','season')),
  title text not null,
  pillar text,
  ref_type text,
  ref_id uuid,
  status text not null default 'planned' check (status in ('idea','planned','drafted','approved','done','skipped')),
  notes text,
  generator text not null default 'demo' check (generator in ('demo','ai','manual')),
  is_sample boolean not null default false,
  created_at timestamptz not null default now()
);
create index content_calendar_items_when_idx on content_calendar_items (scheduled_for);

-- ─── Reputation ────────────────────────────────────────────────────────────
create table reviews (
  id uuid primary key default gen_random_uuid(),
  -- 'sample' rows are fictional demo data and must never be shown publicly.
  source text not null check (source in ('google','facebook','manual','internal','sample')),
  external_id text,
  rating int not null check (rating between 1 and 5),
  body text,
  author_name text not null,
  reviewed_at timestamptz not null default now(),
  replied boolean not null default false,
  customer_id uuid references customers (id) on delete set null,
  owner_alerted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (source, external_id)
);
create index reviews_recent_idx on reviews (reviewed_at desc);

create table review_replies (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references reviews (id) on delete cascade,
  draft_text text not null,
  final_text text,
  status text not null default 'pending_approval' check (status in ('draft','pending_approval','approved','posted','simulated','rejected')),
  generator text not null default 'demo' check (generator in ('demo','ai','manual')),
  ai_generation_id uuid references ai_generation_jobs (id) on delete set null,
  compliance_status text not null default 'pass' check (compliance_status in ('pass','warn','block')),
  compliance_issues jsonb not null default '[]',
  posted_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

create table nps_responses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers (id) on delete set null,
  invoice_id uuid unique references invoices (id) on delete set null,
  token_hash text not null unique,
  score int check (score between 0 and 10),
  comment text,
  channel text check (channel in ('sms','email')),
  -- The Google review link goes to every customer regardless of score (no gating).
  review_link_sent boolean not null default true,
  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  owner_alerted_at timestamptz,
  is_sample boolean not null default false
);

-- ─── SEO + listings ────────────────────────────────────────────────────────
create table seo_content (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('build_page','blog_post','faq')),
  title text not null,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  summary text not null default '',
  body jsonb not null default '[]',
  faq jsonb not null default '[]',
  meta_description text,
  source_type text check (source_type in ('build','dyno_run','work_order','manual')),
  source_id text,
  status text not null default 'draft' check (status in ('draft','pending_approval','approved','published','rejected')),
  generator text not null default 'demo' check (generator in ('demo','ai','manual')),
  compliance_status text not null default 'pass' check (compliance_status in ('pass','warn','block')),
  compliance_issues jsonb not null default '[]',
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, slug)
);

create table listings (
  id uuid primary key default gen_random_uuid(),
  directory text not null unique,
  category text not null check (category in ('core','maps','directory','diesel','social')),
  url text,
  status text not null default 'not_started' check (status in ('not_started','claimed','verified','needs_update','not_applicable')),
  nap jsonb not null default '{}',
  nap_consistent boolean,
  notes text,
  sort int not null default 0,
  last_checked_at timestamptz,
  updated_at timestamptz not null default now()
);

-- ─── updated_at ────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['brand_voice','landing_pages','ad_campaigns','budget_guards','ad_creatives','channel_connections','social_posts','seo_content','listings'] loop
    execute format('create trigger touch_%1$s before update on %1$I for each row execute function touch_updated_at()', t);
  end loop;
end $$;

-- ─── RLS: admin writes, staff reads, clients nothing ───────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'ai_prompt_templates','ai_generation_jobs','brand_voice','creative_assets','landing_pages','lead_magnets',
    'ad_campaigns','budget_guards','ad_creatives','ad_creative_variants','marketing_approvals','channel_connections',
    'ad_publications','ad_metrics_daily','social_posts','social_post_targets','content_calendar_items',
    'reviews','review_replies','nps_responses','seo_content','listings'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy staff_read on %I for select to authenticated using (app.is_staff())', t);
    execute format('create policy admin_write on %I for all to authenticated using (app.is_admin()) with check (app.is_admin())', t);
  end loop;
end $$;

-- Public: published landing/offer pages and lead magnets only.
create policy public_landing_pages on landing_pages for select to anon, authenticated using (published);
create policy public_lead_magnets on lead_magnets for select to anon, authenticated using (published);

-- Tokens: ciphertext columns are readable and writable by the service role only.
revoke all on channel_connections from anon, authenticated;
grant select (id, platform, status, account_name, external_account_id, scopes, token_expires_at, last_error, connected_by, updated_at)
  on channel_connections to authenticated;

-- SEO, local listings & content (M13): public blog/FAQ/service-area pages,
-- image alt text, shop closures banner, local PR + brand tasks.
-- Additive: new columns have defaults or are nullable. The seo_content kind
-- check is widened (not narrowed) to allow service-area pages.

-- ─── seo_content: service-area pages, platform for related links ───────────
alter table seo_content drop constraint if exists seo_content_kind_check;
alter table seo_content add constraint seo_content_kind_check check (kind in ('build_page','blog_post','faq','area_page'));
alter table seo_content add column if not exists area text check (area is null or area ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
alter table seo_content add column if not exists platform text check (platform is null or platform in ('duramax','powerstroke','cummins'));
alter table seo_content add column if not exists published_at timestamptz;
create index if not exists seo_content_public_idx on seo_content (kind, status, published_at desc) where status = 'published' and not is_sample;

-- ─── Image SEO ─────────────────────────────────────────────────────────────
alter table gallery_items add column if not exists alt_text text check (alt_text is null or char_length(alt_text) <= 200);

-- ─── Holiday / special closures (site banner; GBP push needs the owner) ────
create table shop_closures (
  id uuid primary key default gen_random_uuid(),
  label text not null check (char_length(label) between 1 and 80),
  message text check (message is null or char_length(message) <= 200),
  starts_on date not null,
  ends_on date not null,
  closed boolean not null default true,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create index shop_closures_dates_idx on shop_closures (ends_on, starts_on);

-- ─── Local PR, backlink and brand-disambiguation tasks ─────────────────────
create table seo_tasks (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  category text not null check (category in ('pr','brand')),
  title text not null,
  hint text,
  url text check (url is null or url ~ '^https://'),
  status text not null default 'todo' check (status in ('todo','done','skip')),
  repeat_days int check (repeat_days is null or repeat_days > 0),
  notes text check (notes is null or char_length(notes) <= 500),
  done_at timestamptz,
  sort int not null default 0,
  updated_at timestamptz not null default now()
);
create trigger touch_seo_tasks before update on seo_tasks for each row execute function touch_updated_at();

insert into seo_tasks (key, category, title, hint, repeat_days, sort) values
  ('brand_search_check', 'brand', 'Search “Lucky Diesel” results', 'Check Google and Maps for the Oklahoma Lucky Diesel; note any mix-ups.', 90, 10),
  ('brand_schema_sameas', 'brand', 'Confirm schema links', 'Site schema lists our Instagram, Facebook and TikTok only.', 90, 20),
  ('brand_listing_city', 'brand', 'City in every listing', 'Every listing shows Charleston, SC.', 90, 30),
  ('brand_wrong_reviews', 'brand', 'Flag misattributed reviews', 'Report reviews meant for the other Lucky Diesel.', 90, 40),
  ('pr_chamber', 'pr', 'Join local chamber', 'Charleston Metro Chamber or a town chamber directory link.', null, 110),
  ('pr_sponsor', 'pr', 'Sponsor a local event', 'Truck show, school team or charity ride with a site link.', null, 120),
  ('pr_suppliers', 'pr', 'Installer listing from brands', 'Ask part brands we install for a dealer-locator link.', null, 130),
  ('pr_local_news', 'pr', 'Pitch local news', 'Dyno day or community story to local outlets.', null, 140),
  ('pr_clubs', 'pr', 'Truck club partners', 'Local diesel clubs and forums: shop page or resource link.', null, 150)
on conflict (key) do nothing;

-- ─── RLS ───────────────────────────────────────────────────────────────────
alter table shop_closures enable row level security;
create policy public_read on shop_closures for select to anon, authenticated using (true);
create policy admin_write on shop_closures for all to authenticated using (app.is_admin()) with check (app.is_admin());

alter table seo_tasks enable row level security;
create policy staff_read on seo_tasks for select to authenticated using (app.is_staff());
create policy admin_write on seo_tasks for all to authenticated using (app.is_admin()) with check (app.is_admin());

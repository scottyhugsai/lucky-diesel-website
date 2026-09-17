-- Public photo gallery, managed from /admin/gallery.
create table gallery_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  caption text,
  category text not null default 'builds' check (category in ('builds', 'shop', 'dyno', 'parts', 'events')),
  platform text check (platform in ('duramax', 'powerstroke', 'cummins')),
  vehicle_label text,
  image_url text not null,
  storage_path text,
  width int not null default 1600 check (width > 0),
  height int not null default 1200 check (height > 0),
  build_id uuid references builds (id) on delete set null,
  sort int not null default 0,
  published boolean not null default true,
  is_sample boolean not null default false,
  created_at timestamptz not null default now()
);
create index gallery_items_order_idx on gallery_items (published, sort, created_at desc);

alter table gallery_items enable row level security;
create policy public_gallery on gallery_items for select to anon, authenticated using (published);
create policy staff_read_gallery on gallery_items for select to authenticated using (app.is_staff());
create policy admin_write_gallery on gallery_items for all to authenticated using (app.is_admin()) with check (app.is_admin());

-- Public bucket: gallery photos are meant to be seen by everyone. Only admins upload.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gallery', 'gallery', true, 20971520, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy gallery_admin_write on storage.objects for all to authenticated
  using (bucket_id = 'gallery' and app.is_admin())
  with check (bucket_id = 'gallery' and app.is_admin());

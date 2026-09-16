-- Private bucket for inspection photos/videos, dyno sheets and tune files.
-- Objects are addressed as work-orders/<work_order_id>/<file> or vehicles/<vehicle_id>/<file>.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media', 'media', false, 104857600,
  array['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/quicktime','application/pdf']
)
on conflict (id) do nothing;

create policy media_staff_all on storage.objects for all to authenticated
  using (bucket_id = 'media' and app.is_staff())
  with check (bucket_id = 'media' and app.is_staff());

create policy media_client_read on storage.objects for select to authenticated
  using (
    bucket_id = 'media' and (
      ((storage.foldername(name))[1] = 'work-orders' and app.owns_work_order(((storage.foldername(name))[2])::uuid))
      or ((storage.foldername(name))[1] = 'vehicles' and app.owns_vehicle(((storage.foldername(name))[2])::uuid))
    )
  );

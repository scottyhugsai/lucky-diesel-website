-- GoTrue writes app_metadata in a follow-up UPDATE after creating the user,
-- so the insert trigger alone always saw no role. Keep profiles.role in sync
-- with app_metadata.role, which only the service role can set.

create or replace function sync_profile_role() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.raw_app_meta_data ->> 'role') is not null
     and (new.raw_app_meta_data ->> 'role') is distinct from (old.raw_app_meta_data ->> 'role') then
    update profiles set role = (new.raw_app_meta_data ->> 'role')::app_role where id = new.id;
  end if;
  return new;
end $$;

create trigger on_auth_user_role_changed after update of raw_app_meta_data on auth.users
  for each row execute function sync_profile_role();

update profiles p
set role = (u.raw_app_meta_data ->> 'role')::app_role
from auth.users u
where u.id = p.id and (u.raw_app_meta_data ->> 'role') is not null;

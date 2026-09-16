-- Row-level security. The database is the last line of defence:
-- server code also checks roles, but a bug there must not leak data.

create schema if not exists app;

create or replace function app.user_role() returns app_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and active
$$;

create or replace function app.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(app.user_role() in ('admin', 'employee'), false)
$$;

create or replace function app.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(app.user_role() = 'admin', false)
$$;

create or replace function app.my_customer_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from customers where profile_id = auth.uid()
$$;

create or replace function app.owns_work_order(wo uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from work_orders w where w.id = wo and w.customer_id = app.my_customer_id())
$$;

create or replace function app.owns_vehicle(v uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from vehicles x where x.id = v and x.customer_id = app.my_customer_id())
$$;

grant usage on schema app to authenticated, anon;
grant execute on all functions in schema app to authenticated, anon;

-- Enable RLS everywhere.
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','customers','vehicles','leads','work_orders','work_order_events','appointments',
    'inspections','inspection_items','line_items','media','approvals','acknowledgements',
    'time_entries','work_order_notes','part_requests','tune_records','dyno_runs','build_items',
    'invoices','payments','messages','automations','automation_runs','builds','shop_settings','audit_log'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- ─── Staff: read everything operational ─────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','customers','vehicles','leads','work_orders','work_order_events','appointments',
    'inspections','inspection_items','line_items','media','approvals','acknowledgements',
    'time_entries','work_order_notes','part_requests','tune_records','dyno_runs','build_items',
    'invoices','payments','messages','automations','automation_runs','builds','shop_settings'
  ] loop
    execute format('create policy staff_read on %I for select to authenticated using (app.is_staff())', t);
  end loop;
end $$;

-- ─── Admin: write everything ────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','customers','vehicles','leads','work_orders','appointments',
    'inspections','inspection_items','line_items','media','work_order_notes','part_requests',
    'tune_records','dyno_runs','build_items','invoices','payments','automations','builds','shop_settings'
  ] loop
    execute format('create policy admin_write on %I for all to authenticated using (app.is_admin()) with check (app.is_admin())', t);
  end loop;
end $$;

create policy admin_read_audit on audit_log for select to authenticated using (app.is_admin());

-- ─── Employees: the shop-floor writes ───────────────────────────────────────
create policy employee_update_work_orders on work_orders for update to authenticated
  using (app.user_role() = 'employee') with check (app.user_role() = 'employee');

do $$
declare t text;
begin
  foreach t in array array[
    'inspections','inspection_items','media','work_order_notes','part_requests',
    'tune_records','dyno_runs','build_items','line_items'
  ] loop
    execute format(
      'create policy employee_write on %I for all to authenticated using (app.user_role() = ''employee'') with check (app.user_role() = ''employee'')', t
    );
  end loop;
end $$;

create policy employee_own_time on time_entries for all to authenticated
  using (tech_id = auth.uid() and app.is_staff())
  with check (tech_id = auth.uid() and app.is_staff());

-- ─── Clients: only their own records ────────────────────────────────────────
create policy self_profile on profiles for select to authenticated using (id = auth.uid());

create policy client_customer on customers for select to authenticated using (profile_id = auth.uid());
create policy client_vehicles on vehicles for select to authenticated using (customer_id = app.my_customer_id());
create policy client_work_orders on work_orders for select to authenticated
  using (customer_id = app.my_customer_id() and status <> 'cancelled');
create policy client_wo_events on work_order_events for select to authenticated using (app.owns_work_order(work_order_id));
create policy client_appointments on appointments for select to authenticated using (customer_id = app.my_customer_id());
create policy client_inspections on inspections for select to authenticated
  using (status = 'sent' and app.owns_work_order(work_order_id));
create policy client_inspection_items on inspection_items for select to authenticated
  using (exists (select 1 from inspections i where i.id = inspection_id and i.status = 'sent' and app.owns_work_order(i.work_order_id)));
create policy client_line_items on line_items for select to authenticated using (app.owns_work_order(work_order_id));
create policy client_media on media for select to authenticated
  using ((work_order_id is not null and app.owns_work_order(work_order_id)) or (vehicle_id is not null and app.owns_vehicle(vehicle_id)));
create policy client_approvals on approvals for select to authenticated using (app.owns_work_order(work_order_id));
create policy client_acks on acknowledgements for select to authenticated using (app.owns_work_order(work_order_id));
create policy client_notes on work_order_notes for select to authenticated
  using (internal = false and app.owns_work_order(work_order_id));
create policy client_tunes on tune_records for select to authenticated using (app.owns_vehicle(vehicle_id));
create policy client_dyno on dyno_runs for select to authenticated using (app.owns_vehicle(vehicle_id));
create policy client_build on build_items for select to authenticated using (app.owns_vehicle(vehicle_id));
create policy client_invoices on invoices for select to authenticated using (customer_id = app.my_customer_id());
create policy client_payments on payments for select to authenticated
  using (exists (select 1 from invoices i where i.id = invoice_id and i.customer_id = app.my_customer_id()));
create policy client_messages on messages for select to authenticated using (customer_id = app.my_customer_id());

-- ─── Public ─────────────────────────────────────────────────────────────────
create policy public_builds on builds for select to anon, authenticated using (published);

-- Client-initiated writes (approvals, signatures, bookings, payments) go through
-- server actions that verify ownership and then use the service role.

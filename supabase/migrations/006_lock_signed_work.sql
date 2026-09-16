-- Employees may add and edit *pending* estimate lines, but once a customer has
-- approved or declined a line, or the job is billed, only an admin can change it.
-- Otherwise a tech session could edit a signed price straight through the API.

drop policy if exists employee_write on line_items;

create or replace function app.work_order_is_billed(wo uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from work_orders w where w.id = wo and w.status in ('invoiced', 'paid'))
$$;
grant execute on function app.work_order_is_billed(uuid) to authenticated;

create policy employee_insert_lines on line_items for insert to authenticated
  with check (app.user_role() = 'employee' and approval = 'pending' and not app.work_order_is_billed(work_order_id));

create policy employee_update_lines on line_items for update to authenticated
  using (app.user_role() = 'employee' and approval = 'pending' and not app.work_order_is_billed(work_order_id))
  with check (app.user_role() = 'employee' and approval = 'pending' and not app.work_order_is_billed(work_order_id));

create policy employee_delete_lines on line_items for delete to authenticated
  using (app.user_role() = 'employee' and approval = 'pending' and not app.work_order_is_billed(work_order_id));

-- Employees can't push a job into billing states directly either.
drop policy if exists employee_update_work_orders on work_orders;
create policy employee_update_work_orders on work_orders for update to authenticated
  using (app.user_role() = 'employee' and status not in ('invoiced', 'paid'))
  with check (app.user_role() = 'employee' and status not in ('invoiced', 'paid'));

-- Add CTP total + usage trigger (no NEW.user_id anywhere)
set check_function_bodies = off;

-- Column for accumulating “Cost To Produce”
alter table public.plant_batches
  add column if not exists ctp_total numeric(12,2) not null default 0;

-- Prefer latest lot cost; else fallback to item.unit_cost; else 0
create or replace function public.fn_item_effective_unit_cost(p_item_id uuid)
returns numeric
language sql
stable
as $$
  with latest_lot as (
    select unit_cost
    from public.inventory_item_lots
    where item_id = p_item_id
      and unit_cost is not null
    order by coalesce(received_at, created_at) desc nulls last
    limit 1
  )
  select coalesce(
    (select unit_cost from latest_lot),
    (select unit_cost from public.inventory_items where id = p_item_id),
    0
  );
$$;

-- Drop any previous “usage side-effect” triggers/functions to avoid conflicts
drop trigger if exists trg_inventory_usage_qty_and_diary on public.inventory_item_usages;
drop trigger if exists trg_inv_usage_side_effects          on public.inventory_item_usages;
drop function if exists public.fn_inventory_usage_qty_and_diary();
drop function if exists public.fn_inv_usage_side_effects();

-- New CTP-only trigger function (does NOT touch inventory qty — keep your existing qty trigger intact)
create or replace function public.fn_ctp_usage_apply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cost  numeric;
  v_delta numeric;
begin
  if (tg_op = 'INSERT') then
    v_cost  := fn_item_effective_unit_cost(NEW.item_id);
    v_delta := coalesce(NEW.qty,0) * coalesce(v_cost,0);

    update public.plant_batches pb
      set ctp_total = coalesce(pb.ctp_total,0) + v_delta
      where pb.id = NEW.plant_batch_id;

    return NEW;

  elsif (tg_op = 'DELETE') then
    v_cost  := fn_item_effective_unit_cost(OLD.item_id);
    v_delta := coalesce(OLD.qty,0) * coalesce(v_cost,0);

    update public.plant_batches pb
      set ctp_total = greatest(0, coalesce(pb.ctp_total,0) - v_delta)
      where pb.id = OLD.plant_batch_id;

    return OLD;

  elsif (tg_op = 'UPDATE') then
    -- remove old
    v_cost  := fn_item_effective_unit_cost(coalesce(OLD.item_id, NEW.item_id));
    v_delta := coalesce(OLD.qty,0) * coalesce(v_cost,0);
    update public.plant_batches pb
      set ctp_total = greatest(0, coalesce(pb.ctp_total,0) - v_delta)
      where pb.id = OLD.plant_batch_id;

    -- apply new
    v_cost  := fn_item_effective_unit_cost(NEW.item_id);
    v_delta := coalesce(NEW.qty,0) * coalesce(v_cost,0);
    update public.plant_batches pb
      set ctp_total = coalesce(pb.ctp_total,0) + v_delta
      where pb.id = NEW.plant_batch_id;

    return NEW;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_ctp_usage_ins_upd_del on public.inventory_item_usages;
create trigger trg_ctp_usage_ins_upd_del
after insert or update or delete on public.inventory_item_usages
for each row
execute function public.fn_ctp_usage_apply();